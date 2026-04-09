const express = require('express');
const { requireAuth, requireCoach } = require('../middleware/auth');
const dbService = require('../src/services/dbService');

const router = express.Router();
const DEFAULT_TEAM_ID = 1;

function getTeamId(req) {
  const rawTeamId = req.query.teamId ?? req.body?.team_id ?? req.body?.teamId;
  const parsed = Number(rawTeamId);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_TEAM_ID;
}

router.get('/', requireAuth, (req, res) => {
  try {
    const fixtures = dbService.listFixturesByTeam(getTeamId(req));
    return res.json(fixtures);
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo cargar el calendario' });
  }
});

router.post('/', requireCoach, (req, res) => {
  try {
    const fixture = dbService.createFixture({
      team_id: getTeamId(req),
      date: req.body.date,
      opponent: req.body.opponent || null,
      location: req.body.location || 'home',
    });

    return res.status(fixture.updated_existing ? 200 : 201).json(fixture);
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo guardar el partido en el calendario' });
  }
});

router.get('/nearest', requireAuth, (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const teamId = getTeamId(req);
    const fixture = dbService.getNearestFixture(teamId, date);

    return res.json({
      date,
      team_id: teamId,
      fixture,
    });
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo calcular el partido mas cercano' });
  }
});

module.exports = router;
