const { db, calcWellnessScore } = require('../../db');

function getWeekNumber(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  return Math.ceil(((date - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
}

function formatRelativeMatchDay(diff) {
  if (diff === 0) return 'MD';
  return diff > 0 ? `MD+${diff}` : `MD${diff}`;
}

function getPlayersByTeam(teamId) {
  if (!teamId) {
    throw new Error('teamId is required');
  }

  return db.prepare(`
    SELECT
      u.id,
      u.name,
      u.created_at,
      tm.team_id,
      tm.role
    FROM team_memberships tm
    JOIN users u ON u.id = tm.user_id
    WHERE tm.team_id = ?
      AND tm.role = 'player'
    ORDER BY u.name
  `).all(teamId);
}

function createSession(sessionData) {
  const {
    team_id,
    date,
    match_day_type,
    color_day,
    duration_minutes,
    notes = null,
    is_match = false,
    created_by = null,
  } = sessionData;

  if (!team_id) throw new Error('team_id is required');
  if (!date || !match_day_type || !color_day || !duration_minutes) {
    throw new Error('date, match_day_type, color_day and duration_minutes are required');
  }

  const week = getWeekNumber(date);

  const existing = db.prepare(`
    SELECT id
    FROM sessions
    WHERE team_id = ? AND date = ?
    ORDER BY id DESC
    LIMIT 1
  `).get(team_id, date);

  if (existing) {
    db.prepare(`
      UPDATE sessions
      SET
        match_day_type = ?,
        is_match = ?,
        color_day = ?,
        duration_minutes = ?,
        week = ?,
        notes = ?,
        created_by = ?
      WHERE id = ? AND team_id = ?
    `).run(
      match_day_type,
      is_match ? 1 : 0,
      color_day,
      parseInt(duration_minutes, 10),
      week,
      notes,
      created_by,
      existing.id,
      team_id
    );

    return {
      ...getSessionById(existing.id, team_id),
      updated_existing: true,
    };
  }

  const result = db.prepare(`
    INSERT INTO sessions (
      team_id,
      date,
      match_day_type,
      is_match,
      color_day,
      duration_minutes,
      week,
      notes,
      created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    team_id,
    date,
    match_day_type,
    is_match ? 1 : 0,
    color_day,
    parseInt(duration_minutes, 10),
    week,
    notes,
    created_by
  );

  return {
    ...getSessionById(result.lastInsertRowid, team_id),
    updated_existing: false,
  };
}

function getNearestFixture(teamId, date) {
  if (!teamId) {
    throw new Error('teamId is required');
  }

  if (!date) {
    throw new Error('date is required');
  }

  const fixture = db.prepare(`
    SELECT
      id,
      team_id,
      match_date,
      opponent,
      location,
      CAST(ROUND(julianday(match_date) - julianday(?)) AS INTEGER) AS diff_days
    FROM fixtures
    WHERE team_id = ?
    ORDER BY ABS(julianday(match_date) - julianday(?)) ASC, match_date ASC
    LIMIT 1
  `).get(date, teamId, date);

  if (!fixture) return null;

  return {
    ...fixture,
    relative_match_day: formatRelativeMatchDay(fixture.diff_days),
  };
}

function listSessionsByTeam(teamId) {
  if (!teamId) throw new Error('teamId is required');

  return db.prepare(`
    SELECT *
    FROM sessions
    WHERE team_id = ?
    ORDER BY date DESC
  `).all(teamId);
}

function getSessionById(sessionId, teamId) {
  if (!teamId) throw new Error('teamId is required');

  return db.prepare(`
    SELECT *
    FROM sessions
    WHERE id = ? AND team_id = ?
  `).get(sessionId, teamId);
}

function updateSession(sessionId, sessionData) {
  const {
    team_id,
    date,
    match_day_type,
    color_day,
    duration_minutes,
    notes = null,
    is_match = false,
    created_by = null,
  } = sessionData;

  if (!team_id) throw new Error('team_id is required');
  if (!date || !match_day_type || !color_day || !duration_minutes) {
    throw new Error('date, match_day_type, color_day and duration_minutes are required');
  }

  const week = getWeekNumber(date);

  db.prepare(`
    UPDATE sessions
    SET
      date = ?,
      match_day_type = ?,
      is_match = ?,
      color_day = ?,
      duration_minutes = ?,
      week = ?,
      notes = ?,
      created_by = ?
    WHERE id = ? AND team_id = ?
  `).run(
    date,
    match_day_type,
    is_match ? 1 : 0,
    color_day,
    parseInt(duration_minutes, 10),
    week,
    notes,
    created_by,
    sessionId,
    team_id
  );

  return getSessionById(sessionId, team_id);
}

function deleteSession(sessionId, teamId) {
  if (!teamId) throw new Error('teamId is required');

  return db.prepare(`
    DELETE FROM sessions
    WHERE id = ? AND team_id = ?
  `).run(sessionId, teamId);
}

function playerBelongsToTeam(playerId, teamId) {
  if (!teamId) throw new Error('teamId is required');

  return db.prepare(`
    SELECT 1
    FROM team_memberships
    WHERE user_id = ? AND team_id = ? AND role = 'player'
    LIMIT 1
  `).get(playerId, teamId);
}

function getWellnessSubmission(playerId, date, teamId) {
  if (!teamId) throw new Error('teamId is required');

  return db.prepare(`
    SELECT w.id, w.wellness_score
    FROM wellness w
    LEFT JOIN sessions s ON s.id = w.session_id
    WHERE w.player_id = ?
      AND w.date = ?
      AND (
        s.team_id = ?
        OR (
          w.session_id IS NULL
          AND EXISTS (
            SELECT 1
            FROM team_memberships tm
            WHERE tm.user_id = w.player_id
              AND tm.team_id = ?
              AND tm.role = 'player'
          )
        )
      )
    LIMIT 1
  `).get(playerId, date, teamId, teamId);
}

function createWellness(wellnessData) {
  const {
    team_id,
    player_id,
    session_id = null,
    date,
    fatiga,
    sueno_calidad,
    sueno_horas,
    estres,
    motivacion,
    dano_muscular,
    molestias_zonas = [],
    enfermedad = null,
    sensacion_proximo = null,
    entrenamiento_previo = null,
    otros_comentarios = null,
  } = wellnessData;

  if (!team_id) throw new Error('team_id is required');
  if (!player_id) throw new Error('player_id is required');

  const ws = calcWellnessScore({ fatiga, sueno_calidad, estres, motivacion, dano_muscular });

  const result = db.prepare(`
    INSERT INTO wellness (
      player_id,
      session_id,
      date,
      fatiga,
      sueno_calidad,
      sueno_horas,
      estres,
      motivacion,
      dano_muscular,
      molestias_zonas,
      enfermedad,
      sensacion_proximo,
      entrenamiento_previo,
      otros_comentarios,
      wellness_score
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    player_id,
    session_id,
    date,
    fatiga,
    sueno_calidad,
    sueno_horas,
    estres,
    motivacion,
    dano_muscular,
    Array.isArray(molestias_zonas) && molestias_zonas.length ? JSON.stringify(molestias_zonas) : null,
    enfermedad,
    sensacion_proximo,
    entrenamiento_previo == null ? null : (entrenamiento_previo ? 1 : 0),
    otros_comentarios,
    ws
  );

  return {
    id: result.lastInsertRowid,
    wellness_score: Math.round(ws * 10) / 10,
  };
}

function getWellnessByDate(teamId, date) {
  if (!teamId) throw new Error('teamId is required');

  return db.prepare(`
    SELECT w.*, u.name AS player_name
    FROM wellness w
    JOIN users u ON u.id = w.player_id
    JOIN team_memberships tm ON tm.user_id = u.id
    LEFT JOIN sessions s ON s.id = w.session_id
    WHERE tm.team_id = ?
      AND tm.role = 'player'
      AND w.date = ?
      AND (s.team_id = ? OR w.session_id IS NULL)
    ORDER BY u.name
  `).all(teamId, date, teamId);
}

function getWellnessByPlayer(playerId, teamId, limit = 30) {
  if (!teamId) throw new Error('teamId is required');

  return db.prepare(`
    SELECT w.*, s.match_day_type, s.color_day
    FROM wellness w
    JOIN team_memberships tm ON tm.user_id = w.player_id
    LEFT JOIN sessions s ON s.id = w.session_id
    WHERE w.player_id = ?
      AND tm.team_id = ?
      AND tm.role = 'player'
      AND (s.team_id = ? OR w.session_id IS NULL)
    ORDER BY w.date DESC
    LIMIT ?
  `).all(playerId, teamId, teamId, limit);
}

function getRpeSubmission(playerId, date, teamId) {
  if (!teamId) throw new Error('teamId is required');

  return db.prepare(`
    SELECT r.id, r.rpe, r.srpe
    FROM rpe r
    LEFT JOIN sessions s ON s.id = r.session_id
    WHERE r.player_id = ?
      AND r.date = ?
      AND (
        s.team_id = ?
        OR (
          r.session_id IS NULL
          AND EXISTS (
            SELECT 1
            FROM team_memberships tm
            WHERE tm.user_id = r.player_id
              AND tm.team_id = ?
              AND tm.role = 'player'
          )
        )
      )
    LIMIT 1
  `).get(playerId, date, teamId, teamId);
}

function createRpe(rpeData) {
  const {
    team_id,
    player_id,
    session_id = null,
    date,
    rpe,
    comentarios = null,
  } = rpeData;

  if (!team_id) throw new Error('team_id is required');
  if (!player_id) throw new Error('player_id is required');

  let srpe = null;

  if (session_id) {
    const session = getSessionById(session_id, team_id);
    if (session) {
      srpe = Number(rpe) * Number(session.duration_minutes);
    }
  }

  const result = db.prepare(`
    INSERT INTO rpe (
      player_id,
      session_id,
      date,
      rpe,
      srpe,
      comentarios
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    player_id,
    session_id,
    date,
    Number(rpe),
    srpe,
    comentarios
  );

  return {
    id: result.lastInsertRowid,
    srpe,
  };
}

function getRpeByDate(teamId, date) {
  if (!teamId) throw new Error('teamId is required');

  return db.prepare(`
    SELECT r.*, u.name AS player_name, s.duration_minutes
    FROM rpe r
    JOIN users u ON u.id = r.player_id
    JOIN team_memberships tm ON tm.user_id = u.id
    LEFT JOIN sessions s ON s.id = r.session_id
    WHERE tm.team_id = ?
      AND tm.role = 'player'
      AND r.date = ?
      AND (s.team_id = ? OR r.session_id IS NULL)
    ORDER BY u.name
  `).all(teamId, date, teamId);
}

function getRpeByPlayer(playerId, teamId, limit = 30) {
  if (!teamId) throw new Error('teamId is required');

  return db.prepare(`
    SELECT r.*, s.match_day_type, s.color_day, s.duration_minutes
    FROM rpe r
    JOIN team_memberships tm ON tm.user_id = r.player_id
    LEFT JOIN sessions s ON s.id = r.session_id
    WHERE r.player_id = ?
      AND tm.team_id = ?
      AND tm.role = 'player'
      AND (s.team_id = ? OR r.session_id IS NULL)
    ORDER BY r.date DESC
    LIMIT ?
  `).all(playerId, teamId, teamId, limit);
}

function listFixturesByTeam(teamId) {
  if (!teamId) throw new Error('teamId is required');

  return db.prepare(`
    SELECT *
    FROM fixtures
    WHERE team_id = ?
    ORDER BY match_date ASC
  `).all(teamId);
}

function createFixture(fixtureData) {
  const {
    team_id,
    date,
    opponent = null,
    location = 'home',
  } = fixtureData;

  if (!team_id) throw new Error('team_id is required');
  if (!date) throw new Error('date is required');

  const existing = db.prepare(`
    SELECT *
    FROM fixtures
    WHERE team_id = ? AND match_date = ?
    ORDER BY id DESC
    LIMIT 1
  `).get(team_id, date);

  if (existing) {
    db.prepare(`
      UPDATE fixtures
      SET opponent = ?, location = ?
      WHERE id = ?
    `).run(opponent, location, existing.id);

    return {
      ...db.prepare('SELECT * FROM fixtures WHERE id = ?').get(existing.id),
      updated_existing: true,
    };
  }

  const result = db.prepare(`
    INSERT INTO fixtures (team_id, match_date, opponent, location)
    VALUES (?, ?, ?, ?)
  `).run(team_id, date, opponent, location);

  return {
    ...db.prepare('SELECT * FROM fixtures WHERE id = ?').get(result.lastInsertRowid),
    updated_existing: false,
  };
}

module.exports = {
  getPlayersByTeam,
  createSession,
  listSessionsByTeam,
  getSessionById,
  updateSession,
  deleteSession,
  playerBelongsToTeam,
  getWellnessSubmission,
  createWellness,
  getWellnessByDate,
  getWellnessByPlayer,
  getRpeSubmission,
  createRpe,
  getRpeByDate,
  getRpeByPlayer,
  listFixturesByTeam,
  createFixture,
  getNearestFixture,
};
