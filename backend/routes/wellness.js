const express = require('express');
const { db, calcWellnessScore } = require('../db');
const { requireAuth, requireCoach } = require('../middleware/auth');

const router = express.Router();

// Player submits wellness
router.post('/', requireAuth, (req, res) => {
  const {
    session_id, date, fatiga, sueno_calidad, sueno_horas, estres, motivacion, dano_muscular,
    molestias_zonas, enfermedad, sensacion_proximo, entrenamiento_previo, otros_comentarios
  } = req.body;
  const player_id = req.user.id;

  if (!date || !fatiga || !sueno_calidad || !sueno_horas || !estres || !motivacion || !dano_muscular) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  // Check duplicate for same day
  const existing = db.prepare('SELECT id FROM wellness WHERE player_id = ? AND date = ?').get(player_id, date);
  if (existing) {
    return res.status(409).json({ error: 'Ya enviaste el Wellness de hoy' });
  }

  const ws = calcWellnessScore({ fatiga, sueno_calidad, estres, motivacion, dano_muscular });

  const stmt = db.prepare(`
    INSERT INTO wellness (
      player_id, session_id, date, fatiga, sueno_calidad, sueno_horas,
      estres, motivacion, dano_muscular,
      molestias_zonas, enfermedad, sensacion_proximo, entrenamiento_previo, otros_comentarios,
      wellness_score
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    player_id, session_id || null, date,
    parseInt(fatiga), parseInt(sueno_calidad), parseFloat(sueno_horas),
    parseInt(estres), parseInt(motivacion), parseInt(dano_muscular),
    Array.isArray(molestias_zonas) && molestias_zonas.length ? JSON.stringify(molestias_zonas) : null,
    enfermedad || null,
    sensacion_proximo || null,
    entrenamiento_previo != null ? (entrenamiento_previo ? 1 : 0) : null,
    otros_comentarios || null,
    ws
  );

  res.status(201).json({ id: result.lastInsertRowid, wellness_score: Math.round(ws * 10) / 10 });
});

// Coach: get all wellness for a date
router.get('/date/:date', requireCoach, (req, res) => {
  const rows = db.prepare(`
    SELECT w.*, u.name as player_name
    FROM wellness w JOIN users u ON w.player_id = u.id
    WHERE w.date = ?
    ORDER BY u.name
  `).all(req.params.date);
  res.json(rows);
});

// Coach: get wellness for a player
router.get('/player/:id', requireCoach, (req, res) => {
  const { limit = 30 } = req.query;
  const rows = db.prepare(`
    SELECT w.*, s.match_day_type, s.color_day
    FROM wellness w
    LEFT JOIN sessions s ON w.session_id = s.id
    WHERE w.player_id = ?
    ORDER BY w.date DESC LIMIT ?
  `).all(req.params.id, parseInt(limit));
  res.json(rows);
});

// Player: check if already submitted today
router.get('/today', requireAuth, (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const existing = db.prepare('SELECT id, wellness_score FROM wellness WHERE player_id = ? AND date = ?').get(req.user.id, today);
  res.json({ submitted: !!existing, data: existing || null });
});

module.exports = router;
