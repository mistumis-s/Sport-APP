const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');
const { requireCoach } = require('../middleware/auth');

const router = express.Router();
const SECRET = process.env.JWT_SECRET || 'sport_secret_2024';

router.post('/player', async (req, res) => {
  const { name, pin } = req.body;
  if (!name || !pin) return res.status(400).json({ error: 'Faltan datos' });

  const { rows: [user] } = await pool.query(
    'SELECT * FROM users WHERE name=$1 AND role=$2',
    [name.toUpperCase(), 'player']
  );
  if (!user) return res.status(401).json({ error: 'Jugador no encontrado' });
  if (user.pin !== pin) return res.status(401).json({ error: 'PIN incorrecto' });

  const token = jwt.sign({ id: user.id, name: user.name, role: 'player' }, SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name, role: 'player' } });
});

router.post('/coach', async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Faltan datos' });

  const { rows: [user] } = await pool.query('SELECT * FROM users WHERE role=$1', ['coach']);
  if (!user) return res.status(401).json({ error: 'Coach no encontrado' });

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Contraseña incorrecta' });

  const token = jwt.sign({ id: user.id, name: user.name, role: 'coach' }, SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name, role: 'coach' } });
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
    FROM users u
    WHERE u.role = 'player'
    ORDER BY u.name
  `);
  res.json(rows);
});

router.post('/coach/players', requireCoach, async (req, res) => {
  const normalizedName = String(req.body.name || '').trim().toUpperCase();
  const normalizedPin  = String(req.body.pin  || '').trim();

  if (!normalizedName) return res.status(400).json({ error: 'El nombre es obligatorio' });
  if (!/^\d{4}$/.test(normalizedPin)) return res.status(400).json({ error: 'El PIN debe tener 4 cifras' });

  const { rows: [existing] } = await pool.query(
    "SELECT id FROM users WHERE role='player' AND name=$1",
    [normalizedName]
  );
  if (existing) return res.status(409).json({ error: 'Ya existe un jugador con ese nombre' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [u] } = await client.query(
      "INSERT INTO users (name, role, pin, team) VALUES ($1, 'player', $2, 'DH ÉLITE') RETURNING id, name, pin, created_at",
      [normalizedName, normalizedPin]
    );
    const { rows: [team] } = await client.query("SELECT id FROM teams WHERE name='DH ÉLITE' LIMIT 1");
    if (team) {
      await client.query(
        'INSERT INTO team_memberships (user_id, team_id, role) VALUES ($1, $2, $3)',
        [u.id, team.id, 'player']
      );
    }
    await client.query('COMMIT');
    res.status(201).json(u);
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
    "SELECT id, name FROM users WHERE id=$1 AND role='player'",
    [id]
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
