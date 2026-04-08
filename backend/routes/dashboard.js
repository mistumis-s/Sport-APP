const express = require('express');
const { db } = require('../db');
const { requireCoach } = require('../middleware/auth');

const router = express.Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

function avg(arr) {
  if (!arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function round(value, digits = 2) {
  if (value == null || Number.isNaN(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
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
  // acute = avg sRPE last 7 days, chronic = avg sRPE last 28 days
  const ref = typeof referenceDate === 'string' ? new Date(`${referenceDate}T12:00:00`) : new Date(referenceDate);
  const referenceDay = ref.toISOString().split('T')[0];
  const days7 = new Date(ref.getTime() - 7 * 86400000).toISOString().split('T')[0];
  const days28 = new Date(ref.getTime() - 28 * 86400000).toISOString().split('T')[0];

  const acute = playerRPERows.filter(r => r.date >= days7 && r.date <= referenceDay && r.srpe != null).map(r => r.srpe);
  const chronic = playerRPERows.filter(r => r.date >= days28 && r.date <= referenceDay && r.srpe != null).map(r => r.srpe);

  const acuteAvg = avg(acute);
  const chronicAvg = avg(chronic);
  if (!acuteAvg || !chronicAvg) return null;
  return Math.round((acuteAvg / chronicAvg) * 100) / 100;
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
  const current = weeks.find(week => week.weekStart === currentWeekStart);
  const previous = weeks
    .filter(week => week.weekStart < currentWeekStart && week.mean != null)
    .slice(-3);

  if (!current?.mean || !previous.length) return null;
  const baseline = avg(previous.map(week => week.mean).filter(value => value != null));
  if (!baseline) return null;
  return round(current.mean / baseline, 2);
}

function calcWeeklyMetrics(values) {
  if (!values.length) {
    return { mean: null, total: null, monotony: null, stress: null, variability: null };
  }

  const mean = avg(values);
  const total = values.reduce((sum, value) => sum + value, 0);
  const variability = values.length > 1 ? stdev(values) : null;
  const monotony = variability ? mean / variability : null;
  const stress = monotony ? total * monotony : null;

  return {
    mean: round(mean, 2),
    total: round(total, 2),
    monotony: round(monotony, 2),
    stress: round(stress, 2),
    variability: round(variability, 2),
  };
}

function buildWeeklyPlayerReport(currentWeekStart) {
  const players = db.prepare("SELECT id, name FROM users WHERE role='player' ORDER BY name").all();
  const report = players.map(player => {
    const wellnessRows = db.prepare(`
      SELECT date, wellness_score
      FROM wellness
      WHERE player_id = ? AND date >= ?
      ORDER BY date
    `).all(player.id, new Date(new Date(`${currentWeekStart}T12:00:00`).getTime() - 35 * 86400000).toISOString().split('T')[0]);

    const rpeRows = db.prepare(`
      SELECT date, rpe, srpe
      FROM rpe
      WHERE player_id = ? AND date >= ?
      ORDER BY date
    `).all(player.id, new Date(new Date(`${currentWeekStart}T12:00:00`).getTime() - 35 * 86400000).toISOString().split('T')[0]);

    const currentWeekWs = wellnessRows.filter(row => row.date >= currentWeekStart && row.wellness_score != null).map(row => row.wellness_score);
    const currentWeekRpe = rpeRows.filter(row => row.date >= currentWeekStart && row.rpe != null).map(row => row.rpe);
    const currentWeekSrpe = rpeRows.filter(row => row.date >= currentWeekStart && row.srpe != null).map(row => row.srpe);

    const wsMetrics = calcWeeklyMetrics(currentWeekWs);
    const rpeMetrics = calcWeeklyMetrics(currentWeekSrpe);

    return {
      player_id: player.id,
      player_name: player.name,
      wellness: {
        ws: wsMetrics.mean != null ? round(wsMetrics.mean, 0) : null,
        ac: calcWeeklyAcRatio(wellnessRows, 'wellness_score', currentWeekStart),
        monotony: wsMetrics.monotony,
        stress: wsMetrics.stress != null ? round(wsMetrics.stress, 0) : null,
        variability: wsMetrics.variability,
      },
      load: {
        rpe: currentWeekRpe.length ? round(avg(currentWeekRpe), 0) : null,
        ac: calcWeeklyAcRatio(rpeRows, 'srpe', currentWeekStart),
        monotony: rpeMetrics.monotony,
        stress: rpeMetrics.stress != null ? round(rpeMetrics.stress, 0) : null,
        variability: rpeMetrics.variability,
        total_srpe: rpeMetrics.total != null ? round(rpeMetrics.total, 0) : null,
      }
    };
  });

  const avgMetric = (selector) => {
    const values = report.map(selector).filter(value => value != null);
    return values.length ? round(avg(values), 2) : null;
  };

  return {
    week_start: currentWeekStart,
    week_end: new Date(new Date(`${currentWeekStart}T12:00:00`).getTime() + 6 * 86400000).toISOString().split('T')[0],
    week_number: getWeekNumber(new Date(`${currentWeekStart}T12:00:00`)),
    team: {
      wellness_ws: avgMetric(row => row.wellness.ws),
      wellness_ac: avgMetric(row => row.wellness.ac),
      load_rpe: avgMetric(row => row.load.rpe),
      load_ac: avgMetric(row => row.load.ac),
    },
    rows: report
  };
}

function getAvailableWeeks() {
  const weeks = db.prepare(`
    SELECT DISTINCT date
    FROM (
      SELECT date FROM sessions
      UNION
      SELECT date FROM wellness
      UNION
      SELECT date FROM rpe
    )
    ORDER BY date DESC
  `).all();

  const map = new Map();
  for (const row of weeks) {
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

// ── Team overview ─────────────────────────────────────────────────────────────

router.get('/team', requireCoach, (req, res) => {
  const { days = 14, week_start } = req.query;
  const since = new Date(Date.now() - parseInt(days) * 86400000).toISOString().split('T')[0];
  const currentWeekStart = week_start || getMonday(new Date()).toISOString().split('T')[0];

  // Sessions in range
  const sessions = db.prepare('SELECT * FROM sessions WHERE date >= ? ORDER BY date').all(since);

  // Avg wellness per session date
  const wellnessByDate = db.prepare(`
    SELECT w.date,
           ROUND(AVG(w.wellness_score),1) as avg_ws,
           ROUND(AVG(w.fatiga),2) as avg_fatiga,
           ROUND(AVG(w.sueno_calidad),2) as avg_sueno,
           ROUND(AVG(w.estres),2) as avg_estres,
           ROUND(AVG(w.motivacion),2) as avg_motivacion,
           ROUND(AVG(w.dano_muscular),2) as avg_dano,
           COUNT(*) as responses
    FROM wellness w
    WHERE w.date >= ?
    GROUP BY w.date ORDER BY w.date
  `).all(since);

  // Avg RPE / sRPE per session date
  const rpeByDate = db.prepare(`
    SELECT r.date,
           ROUND(AVG(r.rpe),2) as avg_rpe,
           ROUND(AVG(r.srpe),1) as avg_srpe,
           COUNT(*) as responses
    FROM rpe r
    WHERE r.date >= ?
    GROUP BY r.date ORDER BY r.date
  `).all(since);

  // Merge sessions + metrics by date
  const dateMap = {};
  for (const s of sessions) {
    dateMap[s.date] = { ...s, avg_ws: null, avg_rpe: null, avg_srpe: null, responses_w: 0, responses_r: 0 };
  }
  for (const w of wellnessByDate) {
    if (!dateMap[w.date]) dateMap[w.date] = { date: w.date };
    Object.assign(dateMap[w.date], {
      avg_ws: w.avg_ws, avg_fatiga: w.avg_fatiga, avg_sueno: w.avg_sueno,
      avg_estres: w.avg_estres, avg_motivacion: w.avg_motivacion, avg_dano: w.avg_dano,
      responses_w: w.responses
    });
  }
  for (const r of rpeByDate) {
    if (!dateMap[r.date]) dateMap[r.date] = { date: r.date };
    Object.assign(dateMap[r.date], { avg_rpe: r.avg_rpe, avg_srpe: r.avg_srpe, responses_r: r.responses });
  }

  const timeline = Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));

  // Total players
  const total_players = db.prepare("SELECT COUNT(*) as c FROM users WHERE role='player'").get().c;

  res.json({
    timeline,
    total_players,
    available_weeks: getAvailableWeeks(),
    weekly_report: buildWeeklyPlayerReport(currentWeekStart)
  });
});

// ── Player detail ─────────────────────────────────────────────────────────────

router.get('/player/:id', requireCoach, (req, res) => {
  const { id } = req.params;
  const player = db.prepare('SELECT id, name FROM users WHERE id = ? AND role = ?').get(id, 'player');
  if (!player) return res.status(404).json({ error: 'Jugador no encontrado' });

  // Last 60 days data (enough for date picker + 28d averages)
  const since60 = new Date(Date.now() - 60 * 86400000).toISOString().split('T')[0];

  const wellnessRows = db.prepare(`
    SELECT w.*, s.match_day_type, s.color_day
    FROM wellness w LEFT JOIN sessions s ON w.session_id = s.id
    WHERE w.player_id = ? AND w.date >= ?
    ORDER BY w.date
  `).all(id, since60);

  const rpeRows = db.prepare(`
    SELECT r.*, s.match_day_type, s.color_day, s.duration_minutes
    FROM rpe r LEFT JOIN sessions s ON r.session_id = s.id
    WHERE r.player_id = ? AND r.date >= ?
    ORDER BY r.date
  `).all(id, since60);

  // A/C ratio
  const ac = calcAcuteChronic(rpeRows);

  // Current week metrics
  const startOfWeek = getMonday(new Date()).toISOString().split('T')[0];
  const weekRPE = rpeRows.filter(r => r.date >= startOfWeek && r.srpe != null).map(r => r.srpe);
  const monotony = calcMonotony(weekRPE);
  const totalLoad = weekRPE.reduce((a, b) => a + b, 0);
  const stress = monotony ? Math.round(totalLoad * monotony) : null;
  const variability = weekRPE.length > 1 ? Math.round(stdev(weekRPE)) : null;

  // WS scatter data (WS vs RPE per day)
  const scatter = wellnessRows.map(w => {
    const rpe = rpeRows.find(r => r.date === w.date);
    return { date: w.date, ws: w.wellness_score, rpe: rpe ? rpe.rpe : null, srpe: rpe ? rpe.srpe : null };
  }).filter(d => d.rpe !== null);

  res.json({
    player,
    wellness: wellnessRows,
    rpe: rpeRows,
    metrics: { ac, monotony: monotony ? Math.round(monotony * 100) / 100 : null, stress, variability, totalLoad },
    scatter
  });
});

// ── Players list with latest status ──────────────────────────────────────────

router.get('/players', requireCoach, (req, res) => {
  const selectedDate = req.query.date || new Date().toISOString().split('T')[0];
  const players = db.prepare("SELECT id, name FROM users WHERE role='player' ORDER BY name").all();
  const dateBounds = db.prepare(`
    SELECT MIN(date) as min_date, MAX(date) as max_date
    FROM (
      SELECT date FROM wellness
      UNION ALL
      SELECT date FROM rpe
    )
  `).get();

  const result = players.map(p => {
    const ws = db.prepare('SELECT wellness_score, fatiga, dano_muscular, molestias_zonas, enfermedad, sensacion_proximo, entrenamiento_previo, otros_comentarios, observaciones FROM wellness WHERE player_id=? AND date=?').get(p.id, selectedDate);
    const rpe = db.prepare('SELECT rpe, srpe FROM rpe WHERE player_id=? AND date=?').get(p.id, selectedDate);

    // Last 28 days relative to the selected date for AC
    const since28 = new Date(new Date(`${selectedDate}T12:00:00`).getTime() - 28 * 86400000).toISOString().split('T')[0];
    const rpeRows = db.prepare('SELECT date, srpe FROM rpe WHERE player_id=? AND date>=? AND date<=? AND srpe IS NOT NULL').all(p.id, since28, selectedDate);
    const ac = calcAcuteChronic(rpeRows, selectedDate);

    return {
      ...p,
      today_ws: ws ? Math.round(ws.wellness_score) : null,
      today_rpe: rpe ? rpe.rpe : null,
      today_srpe: rpe ? rpe.srpe : null,
      ac,
      submitted_wellness: !!ws,
      submitted_rpe: !!rpe,
      today_molestias: ws?.molestias_zonas || null,
      today_enfermedad: ws?.enfermedad || null,
      today_sensacion: ws?.sensacion_proximo || null,
      today_entrenamiento_previo: ws?.entrenamiento_previo ?? null,
      today_comentarios: ws?.otros_comentarios || ws?.observaciones || null,
    };
  });

  res.json({
    selected_date: selectedDate,
    min_date: dateBounds?.min_date || null,
    max_date: dateBounds?.max_date || selectedDate,
    players: result
  });
});

// ── WS vs RPE scatter (team) ──────────────────────────────────────────────────

router.get('/scatter', requireCoach, (req, res) => {
  const { week } = req.query;
  let wellnessQ, rpeQ;
  if (week) {
    wellnessQ = db.prepare(`
      SELECT w.player_id, u.name, ROUND(AVG(w.wellness_score),1) as ws
      FROM wellness w JOIN users u ON w.player_id=u.id
      JOIN sessions s ON w.session_id=s.id
      WHERE s.week=? GROUP BY w.player_id
    `).all(parseInt(week));
    rpeQ = db.prepare(`
      SELECT r.player_id, ROUND(AVG(r.rpe),2) as rpe
      FROM rpe r JOIN sessions s ON r.session_id=s.id
      WHERE s.week=? GROUP BY r.player_id
    `).all(parseInt(week));
  } else {
    const since7 = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    wellnessQ = db.prepare(`
      SELECT w.player_id, u.name, ROUND(AVG(w.wellness_score),1) as ws
      FROM wellness w JOIN users u ON w.player_id=u.id
      WHERE w.date>=? GROUP BY w.player_id
    `).all(since7);
    rpeQ = db.prepare(`
      SELECT player_id, ROUND(AVG(rpe),2) as rpe
      FROM rpe WHERE date>=? GROUP BY player_id
    `).all(since7);
  }

  const rpeMap = Object.fromEntries(rpeQ.map(r => [r.player_id, r.rpe]));
  const scatter = wellnessQ
    .filter(w => rpeMap[w.player_id] != null)
    .map(w => ({ name: w.name, ws: w.ws, rpe: rpeMap[w.player_id] }));

  // Team averages for quadrant lines
  const avgWS = avg(scatter.map(d => d.ws));
  const avgRPE = avg(scatter.map(d => d.rpe));

  res.json({ scatter, avgWS: Math.round(avgWS || 0), avgRPE: Math.round((avgRPE || 0) * 10) / 10 });
});

function getMonday(d) {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = copy.getDate() - day + (day === 0 ? -6 : 1);
  copy.setDate(diff);
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

module.exports = router;
