// Borra la BD existente y la regenera con 10 jugadores + 60 días de datos aleatorios
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'sport.db');
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log('🗑  BD anterior eliminada');
}

// Cargar db.js (crea schema + seed jugadores)
const { db, calcWellnessScore } = require('./db');

// ── Helpers ──────────────────────────────────────────────────────────────────
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randFloat(min, max) { return Math.round((Math.random() * (max - min) + min) * 10) / 10; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ── Configuración del calendario (60 días atrás) ──────────────────────────────
const DAYS_BACK = 60;
const today = new Date();

// Semana tipo rugby: Lun-Vie entrenan, Sab partido, Dom descanso
const DAY_CONFIG = {
  1: { md: 'MD+1', color: 'AMARILLO', duration: 60,  intensity: 'low' },
  2: { md: 'MD+2', color: 'NARANJA',  duration: 75,  intensity: 'medium' },
  3: { md: 'MD-3', color: 'ROJO',     duration: 90,  intensity: 'high' },
  4: { md: 'MD-2', color: 'NARANJA',  duration: 75,  intensity: 'medium' },
  5: { md: 'MD-1', color: 'AMARILLO', duration: 55,  intensity: 'low' },
  6: { md: 'MD(H)', color: 'ROJO+',   duration: 80,  intensity: 'match' },
};

// ── Obtener jugadores ─────────────────────────────────────────────────────────
const players = db.prepare("SELECT id FROM users WHERE role='player'").all();
const coach   = db.prepare("SELECT id FROM users WHERE role='coach'").get();

const insertSession  = db.prepare(`INSERT INTO sessions (date, match_day_type, color_day, duration_minutes, week, created_by) VALUES (?, ?, ?, ?, ?, ?)`);
const insertWellness = db.prepare(`INSERT INTO wellness (player_id, session_id, date, fatiga, sueno_calidad, sueno_horas, estres, motivacion, dano_muscular, observaciones, wellness_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
const insertRPE      = db.prepare(`INSERT INTO rpe (player_id, session_id, date, rpe, srpe, comentarios) VALUES (?, ?, ?, ?, ?, ?)`);

const HORAS_SUENO = [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5];

let sessionCount = 0, wellnessCount = 0, rpeCount = 0;

db.exec('BEGIN');

for (let i = DAYS_BACK; i >= 0; i--) {
  const d = new Date(today);
  d.setDate(d.getDate() - i);
  const dayOfWeek = d.getDay(); // 0=Dom, 1=Lun... 6=Sab
  const config = DAY_CONFIG[dayOfWeek];
  if (!config) continue; // Domingo → sin sesión

  const dateStr = d.toISOString().split('T')[0];
  const week = Math.ceil((d - new Date(d.getFullYear(), 0, 1)) / (7 * 86400000));

  // Crear sesión
  const ses = insertSession.run(dateStr, config.md, config.color, config.duration, week, coach.id);
  const sessionId = ses.lastInsertRowid;
  sessionCount++;

  for (const player of players) {
    // 85% de probabilidad de que el jugador responda
    if (Math.random() > 0.85) continue;

    // Generar valores de wellness realistas según intensidad del día anterior
    const fatiga      = config.intensity === 'high' || config.intensity === 'match' ? rand(1, 3) : rand(2, 5);
    const sueno_cal   = rand(2, 5);
    const sueno_horas = pick(HORAS_SUENO);
    const estres      = rand(1, 4);
    const motivacion  = config.intensity === 'match' ? rand(3, 5) : rand(2, 5);
    const dano        = config.intensity === 'high' ? rand(1, 3) : rand(2, 5);
    const ws          = calcWellnessScore({ fatiga, sueno_calidad: sueno_cal, estres, motivacion, dano_muscular: dano });

    insertWellness.run(player.id, sessionId, dateStr, fatiga, sueno_cal, sueno_horas, estres, motivacion, dano, null, ws);
    wellnessCount++;

    // RPE según intensidad
    let rpeVal;
    if (config.intensity === 'match')  rpeVal = rand(7, 10);
    else if (config.intensity === 'high')   rpeVal = rand(6, 9);
    else if (config.intensity === 'medium') rpeVal = rand(4, 7);
    else rpeVal = rand(2, 5);

    const srpe = rpeVal * config.duration;
    insertRPE.run(player.id, sessionId, dateStr, rpeVal, srpe, null);
    rpeCount++;
  }
}

db.exec('COMMIT');

console.log(`✅ Seed completado:`);
console.log(`   📅 ${sessionCount} sesiones`);
console.log(`   💪 ${wellnessCount} registros Wellness`);
console.log(`   ⚡ ${rpeCount} registros RPE`);
console.log(`\n🚀 Ahora ejecuta: npm run dev`);
