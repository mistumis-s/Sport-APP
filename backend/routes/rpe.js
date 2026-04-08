const express = require('express');
const { db } = require('../db');
const { requireAuth, requireCoach } = require('../middleware/auth');

const router = express.Router();

// Player submits RPE
router.post('/', requireAuth, (req, res) => {
  const { session_id, date, rpe, comentarios } = req.body;
  const player_id = req.user.id;

  if (date === undefined || rpe === undefined) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  // Check duplicate for same session or same day
  const existing = db.prepare('SELECT id FROM rpe WHERE player_id = ? AND date = ?').get(player_id, date);
  if (existing) {
    return res.status(409).json({ error: 'Ya enviaste el RPE de hoy' });
  }

  // Get session duration for sRPE
  let srpe = null;
  if (session_id) {
    const session = db.prepare('SELECT duration_minutes FROM sessions WHERE id = ?').get(session_id);
    if (session) srpe = parseInt(rpe) * session.duration_minutes;
  }

  const stmt = db.prepare(`
    INSERT INTO rpe (player_id, session_id, date, rpe, srpe, comentarios)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(player_id, session_id || null, date, parseInt(rpe), srpe, comentarios || null);
  res.status(201).json({ id: result.lastInsertRowid, srpe });
});

// Coach: get all RPE for a date
router.get('/date/:date', requireCoach, (req, res) => {
  const rows = db.prepare(`
    SELECT r.*, u.name as player_name, s.duration_minutes
    FROM rpe r JOIN users u ON r.player_id = u.id
    LEFT JOIN sessions s ON r.session_id = s.id
    WHERE r.date = ?
    ORDER BY u.name
  `).all(req.params.date);
  res.json(rows);
});

// Coach: get RPE for a player
router.get('/player/:id', requireCoach, (req, res) => {
  const { limit = 30 } = req.query;
  const rows = db.prepare(`
    SELECT r.*, s.match_day_type, s.color_day, s.duration_minutes
    FROM rpe r
    LEFT JOIN sessions s ON r.session_id = s.id
    WHERE r.player_id = ?
    ORDER BY r.date DESC LIMIT ?
  `).all(req.params.id, parseInt(limit));
  res.json(rows);
});

// Player: check if already submitted today
router.get('/today', requireAuth, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const existing = db.prepare('SELECT id, rpe, srpe FROM rpe WHERE player_id = ? AND date = ?').get(req.user.id, today);
  res.json({ submitted: !!existing, data: existing || null });
});

module.exports = router;
