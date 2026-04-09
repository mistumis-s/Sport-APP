const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db');
const { requireCoach } = require('../middleware/auth');

const router = express.Router();
const SECRET = process.env.JWT_SECRET || 'sport_secret_2024';

// Player login — selects name + enters PIN
router.post('/player', (req, res) => {
  const { name, pin } = req.body;
  if (!name || !pin) return res.status(400).json({ error: 'Faltan datos' });

  const user = db.prepare('SELECT * FROM users WHERE name = ? AND role = ?').get(name.toUpperCase(), 'player');
  if (!user) return res.status(401).json({ error: 'Jugador no encontrado' });
  if (user.pin !== pin) return res.status(401).json({ error: 'PIN incorrecto' });

  const token = jwt.sign({ id: user.id, name: user.name, role: 'player' }, SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name, role: 'player' } });
});

// Coach login — username + password
router.post('/coach', (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Faltan datos' });

  const user = db.prepare('SELECT * FROM users WHERE role = ?').get('coach');
  if (!user) return res.status(401).json({ error: 'Coach no encontrado' });

  const valid = bcrypt.compareSync(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Contraseña incorrecta' });

  const token = jwt.sign({ id: user.id, name: user.name, role: 'coach' }, SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name, role: 'coach' } });
});

// Get all players (for selector in login)
router.get('/players', (req, res) => {
  const players = db.prepare('SELECT id, name FROM users WHERE role = ? ORDER BY name').all('player');
  res.json(players);
});

// Coach: manage squad
router.get('/coach/players', requireCoach, (req, res) => {
  const players = db.prepare(`
    SELECT
      u.id,
      u.name,
      u.pin,
      u.created_at,
      (SELECT COUNT(*) FROM wellness w WHERE w.player_id = u.id) as wellness_entries,
      (SELECT COUNT(*) FROM rpe r WHERE r.player_id = u.id) as rpe_entries
    FROM users u
    WHERE u.role = 'player'
    ORDER BY u.name
  `).all();

  res.json(players);
});

router.post('/coach/players', requireCoach, (req, res) => {
  const { name, pin } = req.body;
  const normalizedName = String(name || '').trim().toUpperCase();
  const normalizedPin = String(pin || '').trim();

  if (!normalizedName) return res.status(400).json({ error: 'El nombre es obligatorio' });
  if (!/^\d{4}$/.test(normalizedPin)) return res.status(400).json({ error: 'El PIN debe tener 4 cifras' });

  const existing = db.prepare("SELECT id FROM users WHERE role = 'player' AND name = ?").get(normalizedName);
  if (existing) return res.status(409).json({ error: 'Ya existe un jugador con ese nombre' });

  const result = db.prepare("INSERT INTO users (name, role, pin, team) VALUES (?, 'player', ?, ?)").run(normalizedName, normalizedPin, 'DH ÉLITE');
  const player = db.prepare("SELECT id, name, pin, created_at FROM users WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json(player);
});

router.delete('/coach/players/:id', requireCoach, (req, res) => {
  const { id } = req.params;
  const player = db.prepare("SELECT id, name FROM users WHERE id = ? AND role = 'player'").get(id);
  if (!player) return res.status(404).json({ error: 'Jugador no encontrado' });

  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM wellness WHERE player_id = ?').run(id);
    db.prepare('DELETE FROM rpe WHERE player_id = ?').run(id);
    db.prepare("DELETE FROM users WHERE id = ? AND role = 'player'").run(id);
    db.exec('COMMIT');
    res.json({ ok: true, deleted: player });
  } catch (error) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: 'No se pudo eliminar el jugador' });
  }
});

module.exports = router;
module.exports.SECRET = SECRET;
