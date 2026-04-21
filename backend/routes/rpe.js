const express = require('express');
const { requireAuth, requireCoach } = require('../middleware/auth');
const dbService = require('../src/services/dbService');
const { RpeSchema } = require('../src/validation/rpeSchema');

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

function buildRpePayload(req) {
  return {
    team_id: getTeamId(req),
    player_id: req.user.id,
    session_id: req.body.session_id == null || req.body.session_id === '' ? null : Number(req.body.session_id),
    date: req.body.date,
    rpe: Number(req.body.rpe),
    comentarios: req.body.comentarios?.trim() || null,
  };
}

router.post('/', requireAuth, async (req, res) => {
  try {
    const parsed = RpeSchema.safeParse(buildRpePayload(req));
    if (!parsed.success) return res.status(400).json({ error: getValidationMessage(parsed.error) });

    if (!await dbService.playerBelongsToTeam(parsed.data.player_id, parsed.data.team_id)) {
      return res.status(403).json({ error: 'El jugador no pertenece al equipo solicitado' });
    }

    const existing = await dbService.getRpeSubmission(parsed.data.player_id, parsed.data.date, parsed.data.team_id);
    if (existing) return res.status(409).json({ error: 'Ya enviaste el RPE de hoy' });

    const created = await dbService.createRpe(parsed.data);
    return res.status(201).json(created);
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo guardar el RPE' });
  }
});

router.get('/date/:date', requireCoach, async (req, res) => {
  try {
    const rows = await dbService.getRpeByDate(getTeamId(req), req.params.date);
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo cargar el RPE del equipo' });
  }
});

router.get('/player/:id', requireCoach, async (req, res) => {
  try {
    const teamId = getTeamId(req);
    const playerId = Number(req.params.id);
    const limit = Number.parseInt(req.query.limit, 10) || 30;
    const players = await dbService.getPlayersByTeam(teamId);
    const player = players.find(p => p.id === playerId);
    if (!player) return res.status(404).json({ error: 'Jugador no encontrado en el equipo' });
    const rows = await dbService.getRpeByPlayer(playerId, teamId, limit);
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo cargar el historial de RPE' });
  }
});

router.get('/today', requireAuth, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const existing = await dbService.getRpeSubmission(req.user.id, today, getTeamId(req));
    return res.json({ submitted: !!existing, data: existing || null });
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo comprobar el RPE de hoy' });
  }
});

module.exports = router;
