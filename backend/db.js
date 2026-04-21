const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

function calcWellnessScore({ fatiga, sueno_calidad, estres, motivacion, dano_muscular }) {
  return ((fatiga * 0.3 + sueno_calidad * 0.2 + estres * 0.05 + motivacion * 0.05 + dano_muscular * 0.4) / 1) * 20;
}

const PLAYERS = [
  'ALEX ARROYO', 'ETHAN CHEEK', 'LUIS VELASCO', 'SERGIO NATALINO', 'ULISES RAYA',
  'LUCAS ALVAREZ', 'ANTONIO TANGRE', 'GONZALO SANZ', 'THEO SANCHEZ', 'DIEGO SALAS',
];

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS teams (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      club_name  TEXT,
      category   TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS users (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      role       TEXT NOT NULL CHECK(role IN ('player','coach')),
      pin        TEXT,
      password   TEXT,
      team       TEXT NOT NULL DEFAULT 'DH ÉLITE',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS team_memberships (
      user_id  INTEGER NOT NULL REFERENCES users(id),
      team_id  INTEGER NOT NULL REFERENCES teams(id),
      role     TEXT NOT NULL,
      PRIMARY KEY (user_id, team_id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id               SERIAL PRIMARY KEY,
      team_id          INTEGER REFERENCES teams(id),
      date             TEXT NOT NULL,
      team             TEXT NOT NULL DEFAULT 'DH ÉLITE',
      match_day_type   TEXT NOT NULL,
      is_match         INTEGER NOT NULL DEFAULT 0,
      color_day        TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      week             INTEGER,
      notes            TEXT,
      created_by       INTEGER REFERENCES users(id),
      created_at       TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS wellness (
      id                   SERIAL PRIMARY KEY,
      player_id            INTEGER NOT NULL REFERENCES users(id),
      session_id           INTEGER REFERENCES sessions(id),
      date                 TEXT NOT NULL,
      fatiga               INTEGER NOT NULL,
      sueno_calidad        INTEGER NOT NULL,
      sueno_horas          REAL NOT NULL,
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
      created_at           TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS rpe (
      id          SERIAL PRIMARY KEY,
      player_id   INTEGER NOT NULL REFERENCES users(id),
      session_id  INTEGER REFERENCES sessions(id),
      date        TEXT NOT NULL,
      rpe         INTEGER NOT NULL,
      srpe        REAL,
      comentarios TEXT,
      created_at  TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS fixtures (
      id          SERIAL PRIMARY KEY,
      team_id     INTEGER REFERENCES teams(id),
      match_date  TEXT NOT NULL,
      opponent    TEXT,
      location    TEXT DEFAULT 'home',
      created_at  TIMESTAMP DEFAULT NOW()
    );
  `);

  // Ensure default team exists
  const { rows: teams } = await pool.query("SELECT id FROM teams WHERE name = 'DH ÉLITE' LIMIT 1");
  if (teams.length === 0) {
    await pool.query("INSERT INTO teams (name, club_name) VALUES ('DH ÉLITE', 'DH ÉLITE')");
  }

  const { rows: [{ c }] } = await pool.query('SELECT COUNT(*) as c FROM users');
  if (parseInt(c, 10) === 0) {
    const { rows: [defaultTeam] } = await pool.query("SELECT id FROM teams WHERE name = 'DH ÉLITE' LIMIT 1");
    const teamId = defaultTeam.id;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const name of PLAYERS) {
        const { rows: [u] } = await client.query(
          "INSERT INTO users (name, role, pin, team) VALUES ($1, 'player', '1234', 'DH ÉLITE') RETURNING id",
          [name]
        );
        await client.query(
          'INSERT INTO team_memberships (user_id, team_id, role) VALUES ($1, $2, $3)',
          [u.id, teamId, 'player']
        );
      }
      const hash = bcrypt.hashSync('coach123', 10);
      const { rows: [coach] } = await client.query(
        "INSERT INTO users (name, role, password, team) VALUES ('PREPARADOR FÍSICO', 'coach', $1, 'DH ÉLITE') RETURNING id",
        [hash]
      );
      await client.query(
        'INSERT INTO team_memberships (user_id, team_id, role) VALUES ($1, $2, $3)',
        [coach.id, teamId, 'coach']
      );
      await client.query('COMMIT');
      console.log('✅ Database seeded');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  }

  console.log('✅ Database ready');
}

module.exports = { pool, init, calcWellnessScore };
