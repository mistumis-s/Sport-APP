const express = require('express');
const { requireCoach, requireAuth } = require('../middleware/auth');
const dbService = require('../src/services/dbService');
const { SessionSchema } = require('../src/validation/sessionSchema');

const router = express.Router();
const DEFAULT_TEAM_ID = 1;

function getTeamId(req) {
  const rawTeamId = req.query.teamId ?? req.body?.team_id ?? req.body?.teamId;
  const parsed = Number(rawTeamId);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_TEAM_ID;
}

function getValidationMessage(error) {
  return error?.issues?.[0]?.message || 'Datos invalidados por el contrato';
}

function buildSessionPayload(req, fallback = {}) {
  return {
    team_id: getTeamId(req),
    date: req.body.date || fallback.date || null,
    match_day_type: req.body.match_day_type ?? fallback.match_day_type,
    is_match: req.body.is_match == null ? Boolean(fallback.is_match) : Boolean(req.body.is_match),
    color_day: req.body.color_day ?? fallback.color_day,
    duration_minutes: req.body.duration_minutes == null ? Number(fallback.duration_minutes) : Number(req.body.duration_minutes),
    notes: req.body.notes == null ? (fallback.notes ?? null) : (req.body.notes?.trim() ? req.body.notes.trim() : null),
    created_by: req.user.id,
  };
}

router.post('/', requireCoach, (req, res) => {
  try {
    const parsed = SessionSchema.safeParse(buildSessionPayload(req));
    if (!parsed.success) {
      return res.status(400).json({ error: getValidationMessage(parsed.error) });
    }

    const session = dbService.createSession(parsed.data);
    return res.status(session.updated_existing ? 200 : 201).json(session);
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo guardar la sesion' });
  }
});

router.get('/', requireAuth, (req, res) => {
  try {
    const sessions = dbService.listSessionsByTeam(getTeamId(req));
    return res.json(sessions);
  } catch (error) {
    return res.status(500).json({ error: 'No se pudieron cargar las sesiones' });
  }
});

router.get('/:id', requireAuth, (req, res) => {
  try {
    const session = dbService.getSessionById(Number(req.params.id), getTeamId(req));
    if (!session) return res.status(404).json({ error: 'Sesion no encontrada' });
    return res.json(session);
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo cargar la sesion' });
  }
});

router.put('/:id', requireCoach, (req, res) => {
  try {
    const teamId = getTeamId(req);
    const existing = dbService.getSessionById(Number(req.params.id), teamId);
    if (!existing) return res.status(404).json({ error: 'Sesion no encontrada' });

    const parsed = SessionSchema.safeParse(buildSessionPayload(req, existing));
    if (!parsed.success) {
      return res.status(400).json({ error: getValidationMessage(parsed.error) });
    }

    const updated = dbService.updateSession(Number(req.params.id), parsed.data);
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo actualizar la sesion' });
  }
});

router.delete('/:id', requireCoach, (req, res) => {
  try {
    const result = dbService.deleteSession(Number(req.params.id), getTeamId(req));
    if (!result.changes) return res.status(404).json({ error: 'Sesion no encontrada' });
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo eliminar la sesion' });
  }
});

module.exports = router;
