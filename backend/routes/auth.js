const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db');

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

module.exports = router;
module.exports.SECRET = SECRET;
