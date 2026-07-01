const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db');

const router = express.Router();

function requireAdmin(req, res, next) {
  const configuredKey = process.env.ADMIN_API_KEY;
  if (!configuredKey) return res.status(503).json({ error: 'Admin API no configurada' });

  const providedKey = req.headers['x-admin-key'];
  if (!providedKey || providedKey !== configuredKey) {
    return res.status(401).json({ error: 'Clave admin invalida' });
  }

  next();
}

function generatePassword() {
  return crypto.randomBytes(9).toString('base64url');
}

async function createCoach(client, { teamId, teamName, coachName, coachEmail, coachPassword }) {
  const normalizedName = String(coachName || '').trim();
  const normalizedEmail = String(coachEmail || '').trim().toLowerCase();
  const temporaryPassword = String(coachPassword || '').trim() || generatePassword();

  if (!normalizedName) {
    const error = new Error('coach_name es obligatorio');
    error.statusCode = 400;
    throw error;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    const error = new Error('coach_email no es valido');
    error.statusCode = 400;
    throw error;
  }

  const { rows: [existingCoach] } = await client.query(
    'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
    [normalizedEmail]
  );
  if (existingCoach) {
    const error = new Error('Ya existe un usuario con ese email');
    error.statusCode = 409;
    throw error;
  }

  const passwordHash = bcrypt.hashSync(temporaryPassword, 10);
  const { rows: [coach] } = await client.query(
    `INSERT INTO users (name, email, role, password, team, must_change_password)
     VALUES ($1, $2, 'coach', $3, $4, 1)
     RETURNING id, name, email, role, must_change_password`,
    [normalizedName.toUpperCase(), normalizedEmail, passwordHash, teamName]
  );

  await client.query(
    'INSERT INTO team_memberships (user_id, team_id, role) VALUES ($1, $2, $3)',
    [coach.id, teamId, 'coach']
  );

  return {
    coach,
    credentials: {
      email: coach.email,
      temporary_password: temporaryPassword,
    },
  };
}

router.post('/teams', requireAdmin, async (req, res) => {
  const teamName = String(req.body.team_name || '').trim();
  const clubName = String(req.body.club_name || teamName).trim();
  const category = String(req.body.category || '').trim() || null;
  const coachName = String(req.body.coach_name || '').trim();
  const coachEmail = String(req.body.coach_email || '').trim().toLowerCase();
  const temporaryPassword = String(req.body.coach_password || '').trim() || generatePassword();

  if (!teamName) return res.status(400).json({ error: 'team_name es obligatorio' });
  if (!coachName) return res.status(400).json({ error: 'coach_name es obligatorio' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(coachEmail)) {
    return res.status(400).json({ error: 'coach_email no es valido' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [existingTeam] } = await client.query(
      'SELECT id FROM teams WHERE LOWER(name) = LOWER($1) LIMIT 1',
      [teamName]
    );
    if (existingTeam) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Ya existe un equipo con ese nombre' });
    }

    const { rows: [team] } = await client.query(
      'INSERT INTO teams (name, club_name, category) VALUES ($1, $2, $3) RETURNING id, name, club_name, category',
      [teamName, clubName, category]
    );

    const { coach, credentials } = await createCoach(client, {
      teamId: team.id,
      teamName: team.name,
      coachName,
      coachEmail,
      coachPassword: temporaryPassword,
    });

    await client.query('COMMIT');
    return res.status(201).json({
      team,
      coach,
      credentials,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    return res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'No se pudo crear el equipo' });
  } finally {
    client.release();
  }
});

router.post('/teams/:teamId/coaches', requireAdmin, async (req, res) => {
  const teamId = Number(req.params.teamId);
  if (!Number.isInteger(teamId) || teamId <= 0) {
    return res.status(400).json({ error: 'teamId no es valido' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [team] } = await client.query(
      'SELECT id, name FROM teams WHERE id=$1 LIMIT 1',
      [teamId]
    );
    if (!team) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Equipo no encontrado' });
    }

    const result = await createCoach(client, {
      teamId: team.id,
      teamName: team.name,
      coachName: req.body.coach_name,
      coachEmail: req.body.coach_email,
      coachPassword: req.body.coach_password,
    });

    await client.query('COMMIT');
    return res.status(201).json({ team, ...result });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    return res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'No se pudo crear el entrenador' });
  } finally {
    client.release();
  }
});

router.get('/teams', requireAdmin, async (_, res) => {
  const { rows } = await pool.query(`
    SELECT
      t.id,
      t.name,
      t.club_name,
      t.category,
      t.created_at,
      COUNT(*) FILTER (WHERE tm.role = 'coach') AS coaches,
      COUNT(*) FILTER (WHERE tm.role = 'player') AS players
    FROM teams t
    LEFT JOIN team_memberships tm ON tm.team_id = t.id
    GROUP BY t.id
    ORDER BY t.created_at DESC
  `);
  res.json(rows);
});

router.get('/coaches', requireAdmin, async (_, res) => {
  const { rows } = await pool.query(`
    SELECT
      u.id,
      u.name,
      u.email,
      u.must_change_password,
      u.created_at,
      COALESCE(
        json_agg(
          json_build_object('id', t.id, 'name', t.name, 'category', t.category)
          ORDER BY t.name
        ) FILTER (WHERE t.id IS NOT NULL),
        '[]'
      ) AS teams
    FROM users u
    LEFT JOIN team_memberships tm ON tm.user_id = u.id AND tm.role = 'coach'
    LEFT JOIN teams t ON t.id = tm.team_id
    WHERE u.role = 'coach'
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `);
  res.json(rows);
});

router.post('/coaches/:coachId/reset-password', requireAdmin, async (req, res) => {
  const coachId = Number(req.params.coachId);
  if (!Number.isInteger(coachId) || coachId <= 0) {
    return res.status(400).json({ error: 'coachId no es valido' });
  }

  const temporaryPassword = String(req.body.password || '').trim() || generatePassword();
  if (temporaryPassword.length < 8) {
    return res.status(400).json({ error: 'La contrasena debe tener al menos 8 caracteres' });
  }

  const passwordHash = bcrypt.hashSync(temporaryPassword, 10);
  const { rows: [coach] } = await pool.query(
    `UPDATE users
     SET password=$1, must_change_password=1
     WHERE id=$2 AND role='coach'
     RETURNING id, name, email, role, must_change_password`,
    [passwordHash, coachId]
  );

  if (!coach) return res.status(404).json({ error: 'Entrenador no encontrado' });

  res.json({
    coach,
    credentials: {
      email: coach.email,
      temporary_password: temporaryPassword,
    },
  });
});

module.exports = router;
