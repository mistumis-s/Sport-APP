const express = require('express');
const { requireAuth, requireCoach } = require('../middleware/auth');
const dbService = require('../src/services/dbService');
const { WellnessSchema } = require('../src/validation/wellnessSchema');

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

function buildWellnessPayload(req) {
  return {
    team_id: getTeamId(req),
    player_id: req.user.id,
    session_id: req.body.session_id == null || req.body.session_id === '' ? null : Number(req.body.session_id),
    date: req.body.date,
    fatiga: Number(req.body.fatiga),
    sueno_calidad: Number(req.body.sueno_calidad),
    sueno_horas: Number(req.body.sueno_horas),
    estres: Number(req.body.estres),
    motivacion: Number(req.body.motivacion),
    dano_muscular: Number(req.body.dano_muscular),
    molestias_zonas: Array.isArray(req.body.molestias_zonas) ? req.body.molestias_zonas : [],
    enfermedad: req.body.enfermedad?.trim() || null,
    sensacion_proximo: req.body.sensacion_proximo?.trim() || null,
    entrenamiento_previo: req.body.entrenamiento_previo == null ? null : Boolean(req.body.entrenamiento_previo),
    otros_comentarios: req.body.otros_comentarios?.trim() || null,
  };
}

router.post('/', requireAuth, (req, res) => {
  try {
    const parsed = WellnessSchema.safeParse(buildWellnessPayload(req));
    if (!parsed.success) {
      return res.status(400).json({ error: getValidationMessage(parsed.error) });
    }

    if (!dbService.playerBelongsToTeam(parsed.data.player_id, parsed.data.team_id)) {
      return res.status(403).json({ error: 'El jugador no pertenece al equipo solicitado' });
    }

    const existing = dbService.getWellnessSubmission(parsed.data.player_id, parsed.data.date, parsed.data.team_id);
    if (existing) {
      return res.status(409).json({ error: 'Ya enviaste el Wellness de hoy' });
    }

    const created = dbService.createWellness(parsed.data);
    return res.status(201).json(created);
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo guardar el Wellness' });
  }
});

router.get('/date/:date', requireCoach, (req, res) => {
  try {
    const rows = dbService.getWellnessByDate(getTeamId(req), req.params.date);
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo cargar el Wellness del equipo' });
  }
});

router.get('/player/:id', requireCoach, (req, res) => {
  try {
    const teamId = getTeamId(req);
    const playerId = Number(req.params.id);
    const limit = Number.parseInt(req.query.limit, 10) || 30;
    const player = dbService.getPlayersByTeam(teamId).find((item) => item.id === playerId);

    if (!player) {
      return res.status(404).json({ error: 'Jugador no encontrado en el equipo' });
    }

    const rows = dbService.getWellnessByPlayer(playerId, teamId, limit);
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo cargar el historial de Wellness' });
  }
});

router.get('/today', requireAuth, (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const existing = dbService.getWellnessSubmission(req.user.id, today, getTeamId(req));
    return res.json({ submitted: !!existing, data: existing || null });
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo comprobar el Wellness de hoy' });
  }
});

module.exports = router;
