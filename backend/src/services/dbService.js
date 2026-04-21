const { pool, calcWellnessScore } = require('../../db');

function getWeekNumber(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  return Math.ceil(((date - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
}

async function getPlayersByTeam(teamId) {
  if (!teamId) throw new Error('teamId is required');
  const { rows } = await pool.query(`
    SELECT u.id, u.name, u.created_at, tm.team_id, tm.role
    FROM team_memberships tm
    JOIN users u ON u.id = tm.user_id
    WHERE tm.team_id = $1 AND tm.role = 'player'
    ORDER BY u.name
  `, [teamId]);
  return rows;
}

async function createSession(sessionData) {
  const {
    team_id, date, match_day_type, color_day, duration_minutes,
    notes = null, is_match = false, created_by = null,
  } = sessionData;

  if (!team_id) throw new Error('team_id is required');
  if (!date || !match_day_type || !color_day || !duration_minutes) {
    throw new Error('date, match_day_type, color_day and duration_minutes are required');
  }

  const week = getWeekNumber(date);

  const { rows: [existing] } = await pool.query(`
    SELECT id FROM sessions WHERE team_id = $1 AND date = $2 ORDER BY id DESC LIMIT 1
  `, [team_id, date]);

  if (existing) {
    await pool.query(`
      UPDATE sessions
      SET match_day_type=$1, is_match=$2, color_day=$3, duration_minutes=$4, week=$5, notes=$6, created_by=$7
      WHERE id=$8 AND team_id=$9
    `, [match_day_type, is_match ? 1 : 0, color_day, parseInt(duration_minutes, 10), week, notes, created_by, existing.id, team_id]);
    return { ...(await getSessionById(existing.id, team_id)), updated_existing: true };
  }

  const { rows: [row] } = await pool.query(`
    INSERT INTO sessions (team_id, date, match_day_type, is_match, color_day, duration_minutes, week, notes, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id
  `, [team_id, date, match_day_type, is_match ? 1 : 0, color_day, parseInt(duration_minutes, 10), week, notes, created_by]);

  return { ...(await getSessionById(row.id, team_id)), updated_existing: false };
}

async function listSessionsByTeam(teamId) {
  if (!teamId) throw new Error('teamId is required');
  const { rows } = await pool.query('SELECT * FROM sessions WHERE team_id=$1 ORDER BY date DESC', [teamId]);
  return rows;
}

async function getSessionById(sessionId, teamId) {
  if (!teamId) throw new Error('teamId is required');
  const { rows: [row] } = await pool.query('SELECT * FROM sessions WHERE id=$1 AND team_id=$2', [sessionId, teamId]);
  return row || null;
}

async function updateSession(sessionId, sessionData) {
  const {
    team_id, date, match_day_type, color_day, duration_minutes,
    notes = null, is_match = false, created_by = null,
  } = sessionData;

  if (!team_id) throw new Error('team_id is required');
  if (!date || !match_day_type || !color_day || !duration_minutes) {
    throw new Error('date, match_day_type, color_day and duration_minutes are required');
  }

  const week = getWeekNumber(date);
  await pool.query(`
    UPDATE sessions
    SET date=$1, match_day_type=$2, is_match=$3, color_day=$4, duration_minutes=$5, week=$6, notes=$7, created_by=$8
    WHERE id=$9 AND team_id=$10
  `, [date, match_day_type, is_match ? 1 : 0, color_day, parseInt(duration_minutes, 10), week, notes, created_by, sessionId, team_id]);

  return getSessionById(sessionId, team_id);
}

async function deleteSession(sessionId, teamId) {
  if (!teamId) throw new Error('teamId is required');
  const result = await pool.query('DELETE FROM sessions WHERE id=$1 AND team_id=$2', [sessionId, teamId]);
  return { rowCount: result.rowCount };
}

async function playerBelongsToTeam(playerId, teamId) {
  if (!teamId) throw new Error('teamId is required');
  const { rows: [row] } = await pool.query(`
    SELECT 1 FROM team_memberships WHERE user_id=$1 AND team_id=$2 AND role='player' LIMIT 1
  `, [playerId, teamId]);
  return !!row;
}

async function getWellnessSubmission(playerId, date, teamId) {
  if (!teamId) throw new Error('teamId is required');
  const { rows: [row] } = await pool.query(`
    SELECT w.id, w.wellness_score
    FROM wellness w
    LEFT JOIN sessions s ON s.id = w.session_id
    WHERE w.player_id = $1 AND w.date = $2
      AND (
        s.team_id = $3
        OR (
          w.session_id IS NULL
          AND EXISTS (
            SELECT 1 FROM team_memberships tm
            WHERE tm.user_id = w.player_id AND tm.team_id = $4 AND tm.role = 'player'
          )
        )
      )
    LIMIT 1
  `, [playerId, date, teamId, teamId]);
  return row || null;
}

async function createWellness(wellnessData) {
  const {
    player_id, session_id = null, date, fatiga, sueno_calidad, sueno_horas,
    estres, motivacion, dano_muscular, molestias_zonas = [], enfermedad = null,
    sensacion_proximo = null, entrenamiento_previo = null, otros_comentarios = null,
  } = wellnessData;

  if (!player_id) throw new Error('player_id is required');

  const ws = calcWellnessScore({ fatiga, sueno_calidad, estres, motivacion, dano_muscular });
  const molestias = Array.isArray(molestias_zonas) && molestias_zonas.length ? JSON.stringify(molestias_zonas) : null;
  const previo = entrenamiento_previo == null ? null : (entrenamiento_previo ? 1 : 0);

  const { rows: [row] } = await pool.query(`
    INSERT INTO wellness (
      player_id, session_id, date, fatiga, sueno_calidad, sueno_horas, estres,
      motivacion, dano_muscular, molestias_zonas, enfermedad, sensacion_proximo,
      entrenamiento_previo, otros_comentarios, wellness_score
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id
  `, [player_id, session_id, date, fatiga, sueno_calidad, sueno_horas, estres,
      motivacion, dano_muscular, molestias, enfermedad, sensacion_proximo,
      previo, otros_comentarios, ws]);

  return { id: row.id, wellness_score: Math.round(ws * 10) / 10 };
}

async function getWellnessByDate(teamId, date) {
  if (!teamId) throw new Error('teamId is required');
  const { rows } = await pool.query(`
    SELECT w.*, u.name AS player_name
    FROM wellness w
    JOIN users u ON u.id = w.player_id
    JOIN team_memberships tm ON tm.user_id = u.id
    LEFT JOIN sessions s ON s.id = w.session_id
    WHERE tm.team_id = $1 AND tm.role = 'player' AND w.date = $2
      AND (s.team_id = $3 OR w.session_id IS NULL)
    ORDER BY u.name
  `, [teamId, date, teamId]);
  return rows;
}

async function getWellnessByPlayer(playerId, teamId, limit = 30) {
  if (!teamId) throw new Error('teamId is required');
  const { rows } = await pool.query(`
    SELECT w.*, s.match_day_type, s.color_day
    FROM wellness w
    JOIN team_memberships tm ON tm.user_id = w.player_id
    LEFT JOIN sessions s ON s.id = w.session_id
    WHERE w.player_id = $1 AND tm.team_id = $2 AND tm.role = 'player'
      AND (s.team_id = $3 OR w.session_id IS NULL)
    ORDER BY w.date DESC
    LIMIT $4
  `, [playerId, teamId, teamId, limit]);
  return rows;
}

async function getRpeSubmission(playerId, date, teamId) {
  if (!teamId) throw new Error('teamId is required');
  const { rows: [row] } = await pool.query(`
    SELECT r.id, r.rpe, r.srpe
    FROM rpe r
    LEFT JOIN sessions s ON s.id = r.session_id
    WHERE r.player_id = $1 AND r.date = $2
      AND (
        s.team_id = $3
        OR (
          r.session_id IS NULL
          AND EXISTS (
            SELECT 1 FROM team_memberships tm
            WHERE tm.user_id = r.player_id AND tm.team_id = $4 AND tm.role = 'player'
          )
        )
      )
    LIMIT 1
  `, [playerId, date, teamId, teamId]);
  return row || null;
}

async function createRpe(rpeData) {
  const { team_id, player_id, session_id = null, date, rpe, comentarios = null } = rpeData;
  if (!player_id) throw new Error('player_id is required');

  let srpe = null;
  if (session_id) {
    const session = await getSessionById(session_id, team_id);
    if (session) srpe = Number(rpe) * Number(session.duration_minutes);
  }

  const { rows: [row] } = await pool.query(`
    INSERT INTO rpe (player_id, session_id, date, rpe, srpe, comentarios)
    VALUES ($1,$2,$3,$4,$5,$6) RETURNING id
  `, [player_id, session_id, date, Number(rpe), srpe, comentarios]);

  return { id: row.id, srpe };
}

async function getRpeByDate(teamId, date) {
  if (!teamId) throw new Error('teamId is required');
  const { rows } = await pool.query(`
    SELECT r.*, u.name AS player_name, s.duration_minutes
    FROM rpe r
    JOIN users u ON u.id = r.player_id
    JOIN team_memberships tm ON tm.user_id = u.id
    LEFT JOIN sessions s ON s.id = r.session_id
    WHERE tm.team_id = $1 AND tm.role = 'player' AND r.date = $2
      AND (s.team_id = $3 OR r.session_id IS NULL)
    ORDER BY u.name
  `, [teamId, date, teamId]);
  return rows;
}

async function getRpeByPlayer(playerId, teamId, limit = 30) {
  if (!teamId) throw new Error('teamId is required');
  const { rows } = await pool.query(`
    SELECT r.*, s.match_day_type, s.color_day, s.duration_minutes
    FROM rpe r
    JOIN team_memberships tm ON tm.user_id = r.player_id
    LEFT JOIN sessions s ON s.id = r.session_id
    WHERE r.player_id = $1 AND tm.team_id = $2 AND tm.role = 'player'
      AND (s.team_id = $3 OR r.session_id IS NULL)
    ORDER BY r.date DESC
    LIMIT $4
  `, [playerId, teamId, teamId, limit]);
  return rows;
}

async function listFixturesByTeam(teamId) {
  if (!teamId) throw new Error('teamId is required');
  const { rows } = await pool.query('SELECT * FROM fixtures WHERE team_id=$1 ORDER BY match_date ASC', [teamId]);
  return rows;
}

async function createFixture(fixtureData) {
  const { team_id, date, opponent = null, location = 'home' } = fixtureData;
  if (!team_id) throw new Error('team_id is required');
  if (!date) throw new Error('date is required');

  const { rows: [existing] } = await pool.query(
    'SELECT * FROM fixtures WHERE team_id=$1 AND match_date=$2 ORDER BY id DESC LIMIT 1',
    [team_id, date]
  );

  if (existing) {
    await pool.query('UPDATE fixtures SET opponent=$1, location=$2 WHERE id=$3', [opponent, location, existing.id]);
    const { rows: [updated] } = await pool.query('SELECT * FROM fixtures WHERE id=$1', [existing.id]);
    return { ...updated, updated_existing: true };
  }

  const { rows: [row] } = await pool.query(
    'INSERT INTO fixtures (team_id, match_date, opponent, location) VALUES ($1,$2,$3,$4) RETURNING id',
    [team_id, date, opponent, location]
  );
  const { rows: [created] } = await pool.query('SELECT * FROM fixtures WHERE id=$1', [row.id]);
  return { ...created, updated_existing: false };
}

async function getNearestFixture(teamId, date) {
  if (!teamId) throw new Error('teamId is required');
  if (!date) throw new Error('date is required');

  const { rows: [fixture] } = await pool.query(`
    SELECT
      id, team_id, match_date, opponent, location,
      (match_date::date - $1::date) AS diff_days
    FROM fixtures
    WHERE team_id = $2
    ORDER BY ABS(match_date::date - $1::date) ASC, match_date ASC
    LIMIT 1
  `, [date, teamId]);

  if (!fixture) return null;
  const diff = parseInt(fixture.diff_days, 10);
  const label = diff === 0 ? 'MD' : diff > 0 ? `MD+${diff}` : `MD${diff}`;
  return { ...fixture, diff_days: diff, relative_match_day: label };
}

module.exports = {
  getPlayersByTeam, createSession, listSessionsByTeam, getSessionById,
  updateSession, deleteSession, playerBelongsToTeam, getWellnessSubmission,
  createWellness, getWellnessByDate, getWellnessByPlayer, getRpeSubmission,
  createRpe, getRpeByDate, getRpeByPlayer, listFixturesByTeam, createFixture,
  getNearestFixture,
};
