const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const dbPath = path.join(__dirname, 'sport.db');
const db = new DatabaseSync(dbPath);

const CREATE_V2_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS teams (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  club_name  TEXT,
  category   TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_teams_name
ON teams(name);

CREATE TABLE IF NOT EXISTS team_memberships (
  user_id INTEGER NOT NULL,
  team_id INTEGER NOT NULL,
  role    TEXT NOT NULL CHECK(role IN ('player', 'coach')),
  PRIMARY KEY (user_id, team_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_team_memberships_team_role
ON team_memberships(team_id, role);

CREATE TABLE IF NOT EXISTS fixtures (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  team_id    INTEGER NOT NULL,
  match_date TEXT NOT NULL,
  opponent   TEXT,
  location   TEXT NOT NULL CHECK(location IN ('home', 'away')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fixtures_team_match_date
ON fixtures(team_id, match_date);

CREATE TABLE IF NOT EXISTS schema_deprecations (
  table_name    TEXT NOT NULL,
  column_name   TEXT NOT NULL,
  replacement   TEXT,
  note          TEXT,
  deprecated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (table_name, column_name)
);
`;

function columnExists(tableName, columnName) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  return columns.some((column) => column.name === columnName);
}

function ensureSessionsTeamIdColumn() {
  if (!columnExists('sessions', 'team_id')) {
    db.exec(`
      ALTER TABLE sessions
      ADD COLUMN team_id INTEGER REFERENCES teams(id)
    `);
  }
}

function getOrCreateDefaultTeam() {
  const existing = db.prepare(`
    SELECT id
    FROM teams
    WHERE name = ?
    LIMIT 1
  `).get('DH ÉLITE');

  if (existing) return existing.id;

  const result = db.prepare(`
    INSERT INTO teams (name, club_name, category)
    VALUES (?, ?, ?)
  `).run('DH ÉLITE', 'DH ÉLITE', 'DH ÉLITE');

  return Number(result.lastInsertRowid);
}

function migrateMemberships(defaultTeamId) {
  const users = db.prepare(`
    SELECT id, role
    FROM users
    WHERE role IN ('player', 'coach')
  `).all();

  const insertMembership = db.prepare(`
    INSERT OR IGNORE INTO team_memberships (user_id, team_id, role)
    VALUES (?, ?, ?)
  `);

  for (const user of users) {
    insertMembership.run(user.id, defaultTeamId, user.role);
  }
}

function migrateSessions(defaultTeamId) {
  const sessions = db.prepare(`
    SELECT s.id, s.created_by, s.team
    FROM sessions s
  `).all();

  const updateTeamId = db.prepare(`
    UPDATE sessions
    SET team_id = ?
    WHERE id = ?
  `);

  const membershipLookup = db.prepare(`
    SELECT team_id
    FROM team_memberships
    WHERE user_id = ?
    ORDER BY team_id
    LIMIT 1
  `);

  const teamByNameLookup = db.prepare(`
    SELECT id
    FROM teams
    WHERE name = ?
    LIMIT 1
  `);

  for (const session of sessions) {
    let resolvedTeamId = null;

    if (session.created_by != null) {
      resolvedTeamId = membershipLookup.get(session.created_by)?.team_id ?? null;
    }

    if (!resolvedTeamId && session.team) {
      resolvedTeamId = teamByNameLookup.get(session.team)?.id ?? null;
    }

    updateTeamId.run(resolvedTeamId || defaultTeamId, session.id);
  }
}

function markDeprecatedColumns() {
  const upsertDeprecation = db.prepare(`
    INSERT INTO schema_deprecations (table_name, column_name, replacement, note)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(table_name, column_name) DO UPDATE SET
      replacement = excluded.replacement,
      note = excluded.note
  `);

  upsertDeprecation.run(
    'users',
    'team',
    'team_memberships.team_id',
    'Campo legado en texto. Mantener temporalmente solo para compatibilidad y retirarlo cuando auth y gestión de plantilla usen team_memberships.'
  );

  upsertDeprecation.run(
    'sessions',
    'team',
    'sessions.team_id',
    'Campo legado en texto. Mantener temporalmente solo para compatibilidad y retirarlo cuando todas las consultas filtren por sessions.team_id.'
  );
}

function migrate() {
  db.exec('PRAGMA foreign_keys = ON');

  try {
    db.exec('BEGIN IMMEDIATE');

    db.exec(CREATE_V2_TABLES_SQL);
    ensureSessionsTeamIdColumn();

    const defaultTeamId = getOrCreateDefaultTeam();
    migrateMemberships(defaultTeamId);
    migrateSessions(defaultTeamId);
    markDeprecatedColumns();

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_sessions_team_id_date
      ON sessions(team_id, date)
    `);

    db.exec('COMMIT');

    console.log('Migration v2 completed successfully.');
    console.log(`Default team_id: ${getOrCreateDefaultTeam()}`);
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch (_) {}

    console.error('Migration v2 failed.');
    console.error(error);
    process.exitCode = 1;
  }
}

migrate();
