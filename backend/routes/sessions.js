const express = require('express');
const { db } = require('../db');
const { requireCoach, requireAuth } = require('../middleware/auth');

const router = express.Router();

// Coach creates a session
router.post('/', requireCoach, (req, res) => {
  const { date, match_day_type, color_day, duration_minutes, notes } = req.body;
  if (!date || !match_day_type || !color_day || !duration_minutes) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  // Calculate week number from date
  const d = new Date(date);
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);

  const stmt = db.prepare(`
    INSERT INTO sessions (date, match_day_type, color_day, duration_minutes, week, notes, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(date, match_day_type, color_day, parseInt(duration_minutes), week, notes || null, req.user.id);
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(session);
});

// Get all sessions
router.get('/', requireAuth, (req, res) => {
  const sessions = db.prepare('SELECT * FROM sessions ORDER BY date DESC').all();
  res.json(sessions);
});

// Get single session
router.get('/:id', requireAuth, (req, res) => {
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Sesión no encontrada' });
  res.json(session);
});

// Update session (coach only)
router.put('/:id', requireCoach, (req, res) => {
  const { match_day_type, color_day, duration_minutes, notes } = req.body;
  db.prepare(`
    UPDATE sessions SET match_day_type=?, color_day=?, duration_minutes=?, notes=?
    WHERE id=?
  `).run(match_day_type, color_day, parseInt(duration_minutes), notes || null, req.params.id);
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  res.json(session);
});

// Delete session (coach only)
router.delete('/:id', requireCoach, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
