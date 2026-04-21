const express = require('express');
const { pool } = require('../db');
const { requireCoach, requireAuth } = require('../middleware/auth');

const router = express.Router();

// ── Math helpers ──────────────────────────────────────────────────────────────

function avg(arr) {
  if (!arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function round(value, digits = 2) {
  if (value == null || Number.isNaN(value)) return null;
  return Math.round(value * 10 ** digits) / 10 ** digits;
}

function stdev(arr) {
  if (arr.length < 2) return 0;
  const mean = avg(arr);
  return Math.sqrt(arr.reduce((s, x) => s + (x - mean) ** 2, 0) / arr.length);
}

function calcMonotony(srpeArr) {
  if (!srpeArr.length) return null;
  const sd = stdev(srpeArr);
  if (sd === 0) return null;
  return avg(srpeArr) / sd;
}

function calcAcuteChronic(playerRPERows, referenceDate = new Date()) {
  const ref = typeof referenceDate === 'string' ? new Date(`${referenceDate}T12:00:00`) : new Date(referenceDate);
  const referenceDay = ref.toISOString().split('T')[0];
  const days7  = new Date(ref.getTime() -  7 * 86400000).toISOString().split('T')[0];
  const days28 = new Date(ref.getTime() - 28 * 86400000).toISOString().split('T')[0];

  const acute   = playerRPERows.filter(r => r.date >= days7  && r.date <= referenceDay && r.srpe != null).map(r => r.srpe);
  const chronic = playerRPERows.filter(r => r.date >= days28 && r.date <= referenceDay && r.srpe != null).map(r => r.srpe);

  const acuteAvg   = avg(acute);
  const chronicAvg = avg(chronic);
  if (!acuteAvg || !chronicAvg) return null;
  return round(acuteAvg / chronicAvg, 2);
}

function weekKeyFromDate(dateStr) {
  const monday = getMonday(new Date(`${dateStr}T12:00:00`));
  return monday.toISOString().split('T')[0];
}

function buildWeeklyMeans(rows, valueField) {
  const buckets = new Map();
  for (const row of rows) {
    if (row[valueField] == null) continue;
    const key = weekKeyFromDate(row.date);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(row[valueField]);
  }
  return Array.from(buckets.entries())
    .map(([weekStart, values]) => ({ weekStart, mean: avg(values), values }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

function calcWeeklyAcRatio(rows, valueField, currentWeekStart) {
  const weeks = buildWeeklyMeans(rows, valueField);
  const current  = weeks.find(w => w.weekStart === currentWeekStart);
  const previous = weeks.filter(w => w.weekStart < currentWeekStart && w.mean != null).slice(-3);
  if (!current?.mean || !previous.length) return null;
  const baseline = avg(previous.map(w => w.mean).filter(v => v != null));
  return baseline ? round(current.mean / baseline, 2) : null;
}

function calcWeeklyMetrics(values) {
  if (!values.length) return { mean: null, total: null, monotony: null, stress: null, variability: null };
  const mean        = avg(values);
  const total       = values.reduce((s, v) => s + v, 0);
  const variability = values.length > 1 ? stdev(values) : null;
  const monotony    = variability ? mean / variability : null;
  const stress      = monotony ? total * monotony : null;
  return { mean: round(mean, 2), total: round(total, 2), monotony: round(monotony, 2), stress: round(stress, 2), variability: round(variability, 2) };
}

function buildDateRange(startDate, endDate) {
  const dates = [];
  const current = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function dayDiff(fromDate, toDate) {
  return Math.round((new Date(`${toDate}T12:00:00`) - new Date(`${fromDate}T12:00:00`)) / 86400000);
}

function formatRelativeMatchDay(diff) {
  if (diff === 0) return 'MD';
  return diff > 0 ? `MD+${diff}` : `MD${diff}`;
}

function enrichWithMatchContext(rows, matchDates) {
  if (!matchDates.length) return rows.map(row => ({ ...row, relative_match_day: null }));
  return rows.map(row => {
    let bestDiff = null;
    for (const matchDate of matchDates) {
      const diff = dayDiff(matchDate, row.date);
      if (bestDiff == null || Math.abs(diff) < Math.abs(bestDiff) || (Math.abs(diff) === Math.abs(bestDiff) && diff > bestDiff)) {
        bestDiff = diff;
      }
    }
    return { ...row, relative_match_day: bestDiff == null ? null : formatRelativeMatchDay(bestDiff) };
  });
}

function getMonday(d) {
  const copy = new Date(d);
  const day = copy.getDay();
  copy.setDate(copy.getDate() - day + (day === 0 ? -6 : 1));
  copy.setHours(12, 0, 0, 0);
  return copy;
}

function getWeekNumber(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

// ── Async DB helpers ──────────────────────────────────────────────────────────

async function getAvailableWeeks() {
  const { rows } = await pool.query(`
    SELECT DISTINCT date FROM (
      SELECT date FROM sessions
      UNION SELECT date FROM wellness
      UNION SELECT date FROM rpe
    ) t ORDER BY date DESC
  `);

  const map = new Map();
  for (const row of rows) {
    const weekStart = weekKeyFromDate(row.date);
    if (map.has(weekStart)) continue;
    map.set(weekStart, {
      week_start: weekStart,
      week_end: new Date(new Date(`${weekStart}T12:00:00`).getTime() + 6 * 86400000).toISOString().split('T')[0],
      week_number: getWeekNumber(new Date(`${weekStart}T12:00:00`)),
    });
  }
  return Array.from(map.values()).sort((a, b) => b.week_start.localeCompare(a.week_start));
}

async function getTeamScatter(since, until) {
  const wellnessQ = until
    ? pool.query(`SELECT w.player_id, u.name, ROUND(AVG(w.wellness_score)::numeric,1) as ws FROM wellness w JOIN users u ON w.player_id=u.id WHERE w.date>=$1 AND w.date<=$2 GROUP BY w.player_id, u.name`, [since, until])
    : pool.query(`SELECT w.player_id, u.name, ROUND(AVG(w.wellness_score)::numeric,1) as ws FROM wellness w JOIN users u ON w.player_id=u.id WHERE w.date>=$1 GROUP BY w.player_id, u.name`, [since]);

  const rpeQ = until
    ? pool.query(`SELECT player_id, ROUND(AVG(rpe)::numeric,2) as rpe FROM rpe WHERE date>=$1 AND date<=$2 GROUP BY player_id`, [since, until])
    : pool.query(`SELECT player_id, ROUND(AVG(rpe)::numeric,2) as rpe FROM rpe WHERE date>=$1 GROUP BY player_id`, [since]);

  const [{ rows: wellnessRows }, { rows: rpeRows }] = await Promise.all([wellnessQ, rpeQ]);

  const rpeMap = Object.fromEntries(rpeRows.map(r => [r.player_id, r.rpe]));
  const scatter = wellnessRows
    .filter(w => rpeMap[w.player_id] != null)
    .map(w => ({ name: w.name, ws: parseFloat(w.ws), rpe: parseFloat(rpeMap[w.player_id]) }));

  const avgWS  = avg(scatter.map(d => d.ws));
  const avgRPE = avg(scatter.map(d => d.rpe));
  return { scatter, avgWS: Math.round(avgWS || 0), avgRPE: Math.round((avgRPE || 0) * 10) / 10 };
}

async function buildWeeklyPlayerReport(currentWeekStart) {
  const currentWeekEnd = new Date(new Date(`${currentWeekStart}T12:00:00`).getTime() + 6 * 86400000).toISOString().split('T')[0];
  const baselineSince  = new Date(new Date(`${currentWeekStart}T12:00:00`).getTime() - 35 * 86400000).toISOString().split('T')[0];

  const { rows: players } = await pool.query("SELECT id, name FROM users WHERE role='player' ORDER BY name");

  const report = await Promise.all(players.map(async player => {
    const [{ rows: wellnessRows }, { rows: rpeRows }] = await Promise.all([
      pool.query('SELECT date, wellness_score FROM wellness WHERE player_id=$1 AND date>=$2 AND date<=$3 ORDER BY date', [player.id, baselineSince, currentWeekEnd]),
      pool.query('SELECT date, rpe, srpe FROM rpe WHERE player_id=$1 AND date>=$2 AND date<=$3 ORDER BY date', [player.id, baselineSince, currentWeekEnd]),
    ]);

    const cwWs   = wellnessRows.filter(r => r.date >= currentWeekStart && r.date <= currentWeekEnd && r.wellness_score != null).map(r => parseFloat(r.wellness_score));
    const cwRpe  = rpeRows.filter(r => r.date >= currentWeekStart && r.date <= currentWeekEnd && r.rpe != null).map(r => parseFloat(r.rpe));
    const cwSrpe = rpeRows.filter(r => r.date >= currentWeekStart && r.date <= currentWeekEnd && r.srpe != null).map(r => parseFloat(r.srpe));

    const wsMetrics  = calcWeeklyMetrics(cwWs);
    const rpeMetrics = calcWeeklyMetrics(cwSrpe);

    return {
      player_id: player.id,
      player_name: player.name,
      wellness: {
        ws:          wsMetrics.mean != null ? round(wsMetrics.mean, 1) : null,
        ac:          calcWeeklyAcRatio(wellnessRows.map(r => ({ ...r, wellness_score: parseFloat(r.wellness_score) })), 'wellness_score', currentWeekStart),
        monotony:    wsMetrics.monotony,
        stress:      wsMetrics.stress != null ? round(wsMetrics.stress, 0) : null,
        variability: wsMetrics.variability,
      },
      load: {
        rpe:        cwRpe.length ? round(avg(cwRpe), 1) : null,
        ac:         calcWeeklyAcRatio(rpeRows.map(r => ({ ...r, srpe: parseFloat(r.srpe) })), 'srpe', currentWeekStart),
        monotony:   rpeMetrics.monotony,
        stress:     rpeMetrics.stress != null ? round(rpeMetrics.stress, 0) : null,
        variability: rpeMetrics.variability,
        total_srpe: rpeMetrics.total != null ? round(rpeMetrics.total, 0) : null,
      },
    };
  }));

  const avgMetric = sel => { const vals = report.map(sel).filter(v => v != null); return vals.length ? round(avg(vals), 2) : null; };
  return {
    week_start:  currentWeekStart,
    week_end:    currentWeekEnd,
    week_number: getWeekNumber(new Date(`${currentWeekStart}T12:00:00`)),
    team: {
      wellness_ws: avgMetric(r => r.wellness.ws),
      wellness_ac: avgMetric(r => r.wellness.ac),
      load_rpe:    avgMetric(r => r.load.rpe),
      load_ac:     avgMetric(r => r.load.ac),
    },
    rows: report,
  };
}

// ── Team overview ─────────────────────────────────────────────────────────────

router.get('/team', requireCoach, async (req, res) => {
  try {
    const { days = 14, week_start } = req.query;
    const currentWeekStart = week_start || getMonday(new Date()).toISOString().split('T')[0];
    const since = week_start
      ? week_start
      : new Date(Date.now() - parseInt(days) * 86400000).toISOString().split('T')[0];
    const until = week_start
      ? new Date(new Date(`${week_start}T12:00:00`).getTime() + 6 * 86400000).toISOString().split('T')[0]
      : null;

    const sessionsQ = until
      ? pool.query('SELECT * FROM sessions WHERE date>=$1 AND date<=$2 ORDER BY date', [since, until])
      : pool.query('SELECT * FROM sessions WHERE date>=$1 ORDER BY date', [since]);

    const wellnessQ = until
      ? pool.query(`SELECT w.date, ROUND(AVG(w.wellness_score)::numeric,1) as avg_ws, ROUND(AVG(w.fatiga)::numeric,2) as avg_fatiga, ROUND(AVG(w.sueno_calidad)::numeric,2) as avg_sueno, ROUND(AVG(w.estres)::numeric,2) as avg_estres, ROUND(AVG(w.motivacion)::numeric,2) as avg_motivacion, ROUND(AVG(w.dano_muscular)::numeric,2) as avg_dano, COUNT(*) as responses FROM wellness w WHERE w.date>=$1 AND w.date<=$2 GROUP BY w.date ORDER BY w.date`, [since, until])
      : pool.query(`SELECT w.date, ROUND(AVG(w.wellness_score)::numeric,1) as avg_ws, ROUND(AVG(w.fatiga)::numeric,2) as avg_fatiga, ROUND(AVG(w.sueno_calidad)::numeric,2) as avg_sueno, ROUND(AVG(w.estres)::numeric,2) as avg_estres, ROUND(AVG(w.motivacion)::numeric,2) as avg_motivacion, ROUND(AVG(w.dano_muscular)::numeric,2) as avg_dano, COUNT(*) as responses FROM wellness w WHERE w.date>=$1 GROUP BY w.date ORDER BY w.date`, [since]);

    const rpeQ = until
      ? pool.query(`SELECT r.date, ROUND(AVG(r.rpe)::numeric,2) as avg_rpe, ROUND(AVG(r.srpe)::numeric,1) as avg_srpe, COUNT(*) as responses FROM rpe r WHERE r.date>=$1 AND r.date<=$2 GROUP BY r.date ORDER BY r.date`, [since, until])
      : pool.query(`SELECT r.date, ROUND(AVG(r.rpe)::numeric,2) as avg_rpe, ROUND(AVG(r.srpe)::numeric,1) as avg_srpe, COUNT(*) as responses FROM rpe r WHERE r.date>=$1 GROUP BY r.date ORDER BY r.date`, [since]);

    const matchDatesQ = pool.query(`SELECT DISTINCT date FROM sessions WHERE is_match=1 OR match_day_type IN ('MD','MD(H)','MD(A)') ORDER BY date`);

    const [{ rows: sessions }, { rows: wellnessByDate }, { rows: rpeByDate }, { rows: matchDatesRows }] =
      await Promise.all([sessionsQ, wellnessQ, rpeQ, matchDatesQ]);

    const matchDates = matchDatesRows.map(r => r.date);
    const dateMap = {};

    if (until) {
      for (const date of buildDateRange(since, until)) {
        dateMap[date] = { date, avg_ws: null, avg_rpe: null, avg_srpe: null, responses_w: 0, responses_r: 0 };
      }
    }
    for (const s of sessions) {
      dateMap[s.date] = { ...s, avg_ws: null, avg_rpe: null, avg_srpe: null, responses_w: 0, responses_r: 0 };
    }
    for (const w of wellnessByDate) {
      if (!dateMap[w.date]) dateMap[w.date] = { date: w.date };
      Object.assign(dateMap[w.date], {
        avg_ws: w.avg_ws, avg_fatiga: w.avg_fatiga, avg_sueno: w.avg_sueno,
        avg_estres: w.avg_estres, avg_motivacion: w.avg_motivacion, avg_dano: w.avg_dano,
        responses_w: parseInt(w.responses, 10),
      });
    }
    for (const r of rpeByDate) {
      if (!dateMap[r.date]) dateMap[r.date] = { date: r.date };
      Object.assign(dateMap[r.date], { avg_rpe: r.avg_rpe, avg_srpe: r.avg_srpe, responses_r: parseInt(r.responses, 10) });
    }

    const timeline = enrichWithMatchContext(
      Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date)),
      matchDates
    );

    const { rows: [{ c: total_players }] } = await pool.query("SELECT COUNT(*) as c FROM users WHERE role='player'");

    const [scatterData, weeklyReport, availableWeeks] = await Promise.all([
      getTeamScatter(since, until),
      buildWeeklyPlayerReport(currentWeekStart),
      getAvailableWeeks(),
    ]);

    res.json({
      timeline,
      sessions,
      scatter: scatterData,
      total_players: parseInt(total_players, 10),
      available_weeks: availableWeeks,
      weekly_report: weeklyReport,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error cargando dashboard del equipo' });
  }
});

// ── My evolution (player own data) ───────────────────────────────────────────

router.get('/me', requireAuth, async (req, res) => {
  if (req.user.role !== 'player') return res.status(403).json({ error: 'Solo para jugadores' });
  return getPlayerDetail(req.user.id, res);
});

// ── Player detail ─────────────────────────────────────────────────────────────

async function getPlayerDetail(id, res) {
  try {
    const { rows: [player] } = await pool.query('SELECT id, name FROM users WHERE id=$1 AND role=$2', [id, 'player']);
    if (!player) return res.status(404).json({ error: 'Jugador no encontrado' });

    const since60 = new Date(Date.now() - 60 * 86400000).toISOString().split('T')[0];

    const [{ rows: wellnessRows }, { rows: rpeRows }] = await Promise.all([
      pool.query(`SELECT w.*, s.match_day_type, s.color_day FROM wellness w LEFT JOIN sessions s ON w.session_id=s.id WHERE w.player_id=$1 AND w.date>=$2 ORDER BY w.date`, [id, since60]),
      pool.query(`SELECT r.*, s.match_day_type, s.color_day, s.duration_minutes FROM rpe r LEFT JOIN sessions s ON r.session_id=s.id WHERE r.player_id=$1 AND r.date>=$2 ORDER BY r.date`, [id, since60]),
    ]);

    const rpeFloat = rpeRows.map(r => ({ ...r, srpe: r.srpe != null ? parseFloat(r.srpe) : null, rpe: parseInt(r.rpe, 10) }));
    const wsFloat  = wellnessRows.map(w => ({ ...w, wellness_score: parseFloat(w.wellness_score) }));

    const ac = calcAcuteChronic(rpeFloat);
    const startOfWeek = getMonday(new Date()).toISOString().split('T')[0];
    const weekRPE  = rpeFloat.filter(r => r.date >= startOfWeek && r.srpe != null).map(r => r.srpe);
    const monotony = calcMonotony(weekRPE);
    const totalLoad = weekRPE.reduce((a, b) => a + b, 0);
    const stress    = monotony ? Math.round(totalLoad * monotony) : null;
    const variability = weekRPE.length > 1 ? Math.round(stdev(weekRPE)) : null;

    const scatter = wsFloat.map(w => {
      const r = rpeFloat.find(r => r.date === w.date);
      return { date: w.date, ws: w.wellness_score, rpe: r ? r.rpe : null, srpe: r ? r.srpe : null };
    }).filter(d => d.rpe !== null);

    res.json({
      player,
      wellness: wsFloat,
      rpe: rpeFloat,
      metrics: { ac, monotony: monotony ? round(monotony, 2) : null, stress, variability, totalLoad },
      scatter,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error cargando datos del jugador' });
  }
}

router.get('/player/:id', requireCoach, (req, res) => {
  getPlayerDetail(req.params.id, res);
});

// ── Players list with latest status ──────────────────────────────────────────

router.get('/players', requireCoach, async (req, res) => {
  try {
    const selectedDate = req.query.date || new Date().toISOString().split('T')[0];
    const since28 = new Date(new Date(`${selectedDate}T12:00:00`).getTime() - 28 * 86400000).toISOString().split('T')[0];

    const [{ rows: players }, { rows: dateBoundsRows }] = await Promise.all([
      pool.query("SELECT id, name FROM users WHERE role='player' ORDER BY name"),
      pool.query(`SELECT MIN(date) as min_date, MAX(date) as max_date FROM (SELECT date FROM wellness UNION ALL SELECT date FROM rpe) t`),
    ]);

    const dateBounds = dateBoundsRows[0];

    const result = await Promise.all(players.map(async p => {
      const [{ rows: [ws] }, { rows: [rpeRow] }, { rows: rpeRows28 }] = await Promise.all([
        pool.query('SELECT wellness_score, fatiga, dano_muscular, molestias_zonas, enfermedad, sensacion_proximo, entrenamiento_previo, otros_comentarios, observaciones FROM wellness WHERE player_id=$1 AND date=$2', [p.id, selectedDate]),
        pool.query('SELECT rpe, srpe FROM rpe WHERE player_id=$1 AND date=$2', [p.id, selectedDate]),
        pool.query('SELECT date, srpe FROM rpe WHERE player_id=$1 AND date>=$2 AND date<=$3 AND srpe IS NOT NULL', [p.id, since28, selectedDate]),
      ]);

      const rpeFloat = rpeRows28.map(r => ({ ...r, srpe: parseFloat(r.srpe) }));
      const ac = calcAcuteChronic(rpeFloat, selectedDate);

      return {
        ...p,
        today_ws:   ws ? Math.round(parseFloat(ws.wellness_score)) : null,
        today_rpe:  rpeRow ? parseInt(rpeRow.rpe, 10) : null,
        today_srpe: rpeRow ? parseFloat(rpeRow.srpe) : null,
        ac,
        submitted_wellness: !!ws,
        submitted_rpe:      !!rpeRow,
        today_molestias:            ws?.molestias_zonas || null,
        today_enfermedad:           ws?.enfermedad || null,
        today_sensacion:            ws?.sensacion_proximo || null,
        today_entrenamiento_previo: ws?.entrenamiento_previo ?? null,
        today_comentarios:          ws?.otros_comentarios || ws?.observaciones || null,
      };
    }));

    res.json({
      selected_date: selectedDate,
      min_date: dateBounds?.min_date || null,
      max_date: dateBounds?.max_date || selectedDate,
      players: result,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error cargando lista de jugadores' });
  }
});

module.exports = router;
