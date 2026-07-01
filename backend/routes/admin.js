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

    const { rows: [existingCoach] } = await client.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
      [coachEmail]
    );
    if (existingCoach) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
    }

    const { rows: [team] } = await client.query(
      'INSERT INTO teams (name, club_name, category) VALUES ($1, $2, $3) RETURNING id, name, club_name, category',
      [teamName, clubName, category]
    );

    const passwordHash = bcrypt.hashSync(temporaryPassword, 10);
    const { rows: [coach] } = await client.query(
      `INSERT INTO users (name, email, role, password, team)
       VALUES ($1, $2, 'coach', $3, $4)
       RETURNING id, name, email, role`,
      [coachName.toUpperCase(), coachEmail, passwordHash, teamName]
    );

    await client.query(
      'INSERT INTO team_memberships (user_id, team_id, role) VALUES ($1, $2, $3)',
      [coach.id, team.id, 'coach']
    );

    await client.query('COMMIT');
    return res.status(201).json({
      team,
      coach,
      credentials: {
        email: coach.email,
        temporary_password: temporaryPassword,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    return res.status(500).json({ error: 'No se pudo crear el equipo' });
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

module.exports = router;
