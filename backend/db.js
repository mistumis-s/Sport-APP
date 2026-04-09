const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const bcrypt = require('bcryptjs');

const db = new DatabaseSync(path.join(__dirname, 'sport.db'));

// PRAGMA via exec
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

// ── Schema ───────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    role       TEXT    NOT NULL CHECK(role IN ('player','coach')),
    pin        TEXT,
    password   TEXT,
    team       TEXT    NOT NULL DEFAULT 'DH ÉLITE',
    created_at TEXT    DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    date             TEXT    NOT NULL,
    team             TEXT    NOT NULL DEFAULT 'DH ÉLITE',
    match_day_type   TEXT    NOT NULL,
    is_match         INTEGER NOT NULL DEFAULT 0,
    color_day        TEXT    NOT NULL,
    duration_minutes INTEGER NOT NULL,
    week             INTEGER,
    notes            TEXT,
    created_by       INTEGER REFERENCES users(id),
    created_at       TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS wellness (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id            INTEGER NOT NULL REFERENCES users(id),
    session_id           INTEGER REFERENCES sessions(id),
    date                 TEXT    NOT NULL,
    fatiga               INTEGER NOT NULL,
    sueno_calidad        INTEGER NOT NULL,
    sueno_horas          REAL    NOT NULL,
    estres               INTEGER NOT NULL,
    motivacion           INTEGER NOT NULL,
    dano_muscular        INTEGER NOT NULL,
    observaciones        TEXT,
    molestias_zonas      TEXT,
    enfermedad           TEXT,
    sensacion_proximo    TEXT,
    entrenamiento_previo INTEGER,
    otros_comentarios    TEXT,
    wellness_score       REAL,
    created_at           TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS rpe (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id   INTEGER NOT NULL REFERENCES users(id),
    session_id  INTEGER REFERENCES sessions(id),
    date        TEXT    NOT NULL,
    rpe         INTEGER NOT NULL,
    srpe        REAL,
    comentarios TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
  );
`);

// ── Migrate existing DB (add new wellness columns if missing) ─────────────────
const newCols = [
  "ALTER TABLE wellness ADD COLUMN molestias_zonas TEXT",
  "ALTER TABLE wellness ADD COLUMN enfermedad TEXT",
  "ALTER TABLE wellness ADD COLUMN sensacion_proximo TEXT",
  "ALTER TABLE wellness ADD COLUMN entrenamiento_previo INTEGER",
  "ALTER TABLE wellness ADD COLUMN otros_comentarios TEXT",
  "ALTER TABLE sessions ADD COLUMN is_match INTEGER NOT NULL DEFAULT 0",
];
for (const sql of newCols) { try { db.exec(sql); } catch (_) {} }

// ── Wellness Score ────────────────────────────────────────────────────────────
function calcWellnessScore({ fatiga, sueno_calidad, estres, motivacion, dano_muscular }) {
  return ((fatiga * 0.3 + sueno_calidad * 0.2 + estres * 0.05 + motivacion * 0.05 + dano_muscular * 0.4) / 1) * 20;
}

// ── Seed ─────────────────────────────────────────────────────────────────────
const PLAYERS = [
  'ALEX ARROYO',
  'ETHAN CHEEK',
  'LUIS VELASCO',
  'SERGIO NATALINO',
  'ULISES RAYA',
  'LUCAS ALVAREZ',
  'ANTONIO TANGRE',
  'GONZALO SANZ',
  'THEO SANCHEZ',
  'DIEGO SALAS'
];

const existing = db.prepare('SELECT COUNT(*) as c FROM users').get();
if (existing.c === 0) {
  const insertUser  = db.prepare('INSERT INTO users (name, role, pin, team) VALUES (?, ?, ?, ?)');
  const insertCoach = db.prepare('INSERT INTO users (name, role, password, team) VALUES (?, ?, ?, ?)');

  db.exec('BEGIN');
  try {
    for (const name of PLAYERS) {
      insertUser.run(name, 'player', '1234', 'DH ÉLITE');
    }
    const hash = bcrypt.hashSync('coach123', 10);
    insertCoach.run('PREPARADOR FÍSICO', 'coach', hash, 'DH ÉLITE');
    db.exec('COMMIT');
    console.log('✅ Database seeded');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

module.exports = { db, calcWellnessScore };
