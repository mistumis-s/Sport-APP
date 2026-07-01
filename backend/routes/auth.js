const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const { requireAuth, requireCoach } = require('../middleware/auth');

const router = express.Router();
const SECRET = process.env.JWT_SECRET || 'sport_secret_2024';

router.post('/player', async (req, res) => {
  const { email, password, name, pin, team_id, team_code } = req.body;
  if ((!email || !password) && (!name || !pin)) return res.status(400).json({ error: 'Faltan datos' });

  const normalizedCode = String(team_code || '').trim().toUpperCase();
  const { rows: [user] } = normalizedCode && name
    ? await pool.query(`
        SELECT u.*, tm.team_id
        FROM users u
        JOIN team_memberships tm ON tm.user_id = u.id
        JOIN teams t ON t.id = tm.team_id
        WHERE t.access_code=$1 AND tm.role='player' AND u.name=$2 AND u.role='player'
        LIMIT 1
      `, [normalizedCode, name.toUpperCase()])
    : team_id && name
    ? await pool.query(`
        SELECT u.*, tm.team_id
        FROM users u
        JOIN team_memberships tm ON tm.user_id = u.id
        WHERE tm.team_id=$1 AND tm.role='player' AND u.name=$2 AND u.role='player'
        LIMIT 1
      `, [team_id, name.toUpperCase()])
    : email
    ? await pool.query('SELECT * FROM users WHERE LOWER(email)=LOWER($1) AND role=$2', [email, 'player'])
    : await pool.query('SELECT * FROM users WHERE name=$1 AND role=$2', [name.toUpperCase(), 'player']);
  if (!user) return res.status(401).json({ error: 'Jugador no encontrado' });
  if (email) {
    const valid = bcrypt.compareSync(password, user.password || '');
    if (!valid) return res.status(401).json({ error: 'Contrasena incorrecta' });
  } else if (user.pin !== pin) {
    return res.status(401).json({ error: 'PIN incorrecto' });
  }

  const { rows: [membership] } = await pool.query(
    "SELECT team_id FROM team_memberships WHERE user_id=$1 AND role='player' ORDER BY team_id LIMIT 1",
    [user.id]
  );

  const token = jwt.sign(
    {
      id: user.id,
      name: user.name,
      role: 'player',
      team_id: user.team_id || membership?.team_id || null,
      must_change_password: Boolean(user.must_change_password),
    },
    SECRET,
    { expiresIn: '7d' }
  );
  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: 'player',
      team_id: user.team_id || membership?.team_id || null,
      must_change_password: Boolean(user.must_change_password),
    },
  });
});

router.post('/coach', async (req, res) => {
  const { email, password } = req.body;
  if (!password) return res.status(400).json({ error: 'Faltan datos' });

  const { rows: [user] } = email
    ? await pool.query('SELECT * FROM users WHERE role=$1 AND LOWER(email)=LOWER($2)', ['coach', email])
    : await pool.query('SELECT * FROM users WHERE role=$1 ORDER BY id LIMIT 1', ['coach']);
  if (!user) return res.status(401).json({ error: 'Coach no encontrado' });

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Contrasena incorrecta' });

  const { rows: memberships } = await pool.query(
    `SELECT tm.team_id, t.name, t.access_code, t.club_name, t.category
     FROM team_memberships tm
     JOIN teams t ON t.id = tm.team_id
     WHERE tm.user_id=$1 AND tm.role='coach'
     ORDER BY t.name`,
    [user.id]
  );
  const membership = memberships[0];

  const token = jwt.sign(
    {
      id: user.id,
      name: user.name,
      role: 'coach',
      team_id: membership?.team_id || null,
      must_change_password: Boolean(user.must_change_password),
    },
    SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: 'coach',
      team_id: membership?.team_id || null,
      teams: memberships,
      must_change_password: Boolean(user.must_change_password),
    },
  });
});

router.post('/switch-team', requireCoach, async (req, res) => {
  const teamId = Number(req.body.team_id);
  if (!Number.isInteger(teamId) || teamId <= 0) return res.status(400).json({ error: 'Equipo no valido' });

  const { rows: [membership] } = await pool.query(`
    SELECT tm.team_id, t.name, t.access_code, t.club_name, t.category
    FROM team_memberships tm
    JOIN teams t ON t.id = tm.team_id
    WHERE tm.user_id=$1 AND tm.role='coach' AND tm.team_id=$2
    LIMIT 1
  `, [req.user.id, teamId]);
  if (!membership) return res.status(403).json({ error: 'No perteneces a ese equipo' });

  const { rows: memberships } = await pool.query(`
    SELECT tm.team_id, t.name, t.access_code, t.club_name, t.category
    FROM team_memberships tm
    JOIN teams t ON t.id = tm.team_id
    WHERE tm.user_id=$1 AND tm.role='coach'
    ORDER BY t.name
  `, [req.user.id]);

  const { rows: [user] } = await pool.query('SELECT id, name, email, must_change_password FROM users WHERE id=$1', [req.user.id]);
  const token = jwt.sign(
    {
      id: user.id,
      name: user.name,
      role: 'coach',
      team_id: membership.team_id,
      must_change_password: Boolean(user.must_change_password),
    },
    SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: 'coach',
      team_id: membership.team_id,
      teams: memberships,
      must_change_password: Boolean(user.must_change_password),
    },
  });
});

router.post('/change-password', requireAuth, async (req, res) => {
  const currentPassword = String(req.body.current_password || '');
  const newPassword = String(req.body.new_password || '');

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Faltan datos' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'La nueva contrasena debe tener al menos 8 caracteres' });
  }
  if (currentPassword === newPassword) {
    return res.status(400).json({ error: 'La nueva contrasena debe ser distinta' });
  }

  const { rows: [user] } = await pool.query('SELECT * FROM users WHERE id=$1', [req.user.id]);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  const valid = bcrypt.compareSync(currentPassword, user.password);
  if (!valid) return res.status(401).json({ error: 'Contrasena actual incorrecta' });

  const passwordHash = bcrypt.hashSync(newPassword, 10);
  await pool.query(
    'UPDATE users SET password=$1, must_change_password=0 WHERE id=$2',
    [passwordHash, user.id]
  );

  const { rows: memberships } = user.role === 'coach'
    ? await pool.query(`
        SELECT tm.team_id, t.name, t.access_code, t.club_name, t.category
        FROM team_memberships tm
        JOIN teams t ON t.id = tm.team_id
        WHERE tm.user_id=$1 AND tm.role='coach'
        ORDER BY t.name
      `, [user.id])
    : { rows: [] };

  const token = jwt.sign(
    {
      id: user.id,
      name: user.name,
      role: user.role,
      team_id: req.user.team_id || null,
      must_change_password: false,
    },
    SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      team_id: req.user.team_id || null,
      teams: user.role === 'coach' ? memberships : undefined,
      must_change_password: false,
    },
  });
});

router.get('/players', async (req, res) => {
  const { rows } = await pool.query("SELECT id, name FROM users WHERE role='player' ORDER BY name");
  res.json(rows);
});

router.get('/coach/players', requireCoach, async (req, res) => {
  const { rows } = await pool.query(`
    SELECT
      u.id, u.name, u.pin, u.created_at,
      (SELECT COUNT(*) FROM wellness w WHERE w.player_id = u.id) as wellness_entries,
      (SELECT COUNT(*) FROM rpe r WHERE r.player_id = u.id) as rpe_entries
    FROM team_memberships tm
    JOIN users u ON u.id = tm.user_id
    WHERE tm.role = 'player' AND tm.team_id = $1
    ORDER BY u.name
  `, [req.user.team_id]);
  res.json(rows);
});

router.post('/coach/players', requireCoach, async (req, res) => {
  const normalizedName = String(req.body.name || '').trim().toUpperCase();
  const normalizedPin = String(req.body.pin || '').trim();

  if (!normalizedName) return res.status(400).json({ error: 'El nombre es obligatorio' });
  if (!/^\d{4,6}$/.test(normalizedPin)) return res.status(400).json({ error: 'El PIN debe tener entre 4 y 6 cifras' });

  const { rows: [existing] } = await pool.query(
    `SELECT u.id
     FROM users u
     JOIN team_memberships tm ON tm.user_id = u.id
     WHERE u.role='player' AND u.name=$1 AND tm.team_id=$2`,
    [normalizedName, req.user.team_id]
  );
  if (existing) return res.status(409).json({ error: 'Ya existe un jugador con ese nombre' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [team] } = await client.query('SELECT id, name FROM teams WHERE id=$1 LIMIT 1', [req.user.team_id]);
    if (!team) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Equipo no encontrado para este entrenador' });
    }

    const { rows: [u] } = await client.query(
      "INSERT INTO users (name, role, pin, team, must_change_password) VALUES ($1, 'player', $2, $3, 0) RETURNING id, name, pin, created_at",
      [normalizedName, normalizedPin, team.name]
    );
    await client.query(
      'INSERT INTO team_memberships (user_id, team_id, role) VALUES ($1, $2, $3)',
      [u.id, team.id, 'player']
    );
    await client.query('COMMIT');
    res.status(201).json({
      player: u,
      credentials: {
        name: u.name,
        pin: u.pin,
      },
    });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'No se pudo crear el jugador' });
  } finally {
    client.release();
  }
});

router.delete('/coach/players/:id', requireCoach, async (req, res) => {
  const { id } = req.params;
  const { rows: [player] } = await pool.query(
    `SELECT u.id, u.name
     FROM users u
     JOIN team_memberships tm ON tm.user_id = u.id
     WHERE u.id=$1 AND u.role='player' AND tm.team_id=$2`,
    [id, req.user.team_id]
  );
  if (!player) return res.status(404).json({ error: 'Jugador no encontrado' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM wellness WHERE player_id=$1', [id]);
    await client.query('DELETE FROM rpe WHERE player_id=$1', [id]);
    await client.query('DELETE FROM team_memberships WHERE user_id=$1', [id]);
    await client.query("DELETE FROM users WHERE id=$1 AND role='player'", [id]);
    await client.query('COMMIT');
    res.json({ ok: true, deleted: player });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'No se pudo eliminar el jugador' });
  } finally {
    client.release();
  }
});

module.exports = router;
module.exports.SECRET = SECRET;
