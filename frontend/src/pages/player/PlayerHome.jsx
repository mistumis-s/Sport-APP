import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function PlayerHome() {
  const { user } = useAuth();
  const [wStatus, setWStatus] = useState(null);
  const [rStatus, setRStatus] = useState(null);
  const [todaySession, setTodaySession] = useState(null);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    api.get('/wellness/today').then(r => setWStatus(r.data)).catch(() => {});
    api.get('/rpe/today').then(r => setRStatus(r.data)).catch(() => {});
    api.get('/sessions').then(r => {
      const s = r.data.find(s => s.date === today);
      setTodaySession(s || null);
    }).catch(() => {});
  }, []);

  const dayOfWeek = new Date().toLocaleDateString('es-ES', { weekday: 'long' });
  const dateStr = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });

  return (
    <div className="pb-20 sm:pb-0 space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-500 to-rose-500 rounded-2xl p-5 text-white shadow-lg shadow-red-200">
        <p className="text-red-100 text-sm font-medium capitalize">{dayOfWeek}, {dateStr}</p>
        <h1 className="text-2xl font-extrabold mt-1">Hola, {user.name.split(' ')[0]} 👋</h1>
        <p className="text-red-100 text-sm mt-0.5">DH Élite · Temporada 24/25</p>
      </div>

      {/* Today's session info */}
      {todaySession ? (
        <div className="card border-l-4 border-l-red-400">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-2 font-semibold">Sesión de hoy</p>
          <div className="flex items-center gap-3">
            <ColorDot color={todaySession.color_day} />
            <div>
              <p className="font-bold text-slate-800">{todaySession.match_day_type}</p>
              <p className="text-sm text-slate-500">{todaySession.duration_minutes} min · {colorLabel(todaySession.color_day)}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="card bg-slate-50 border border-dashed border-slate-200">
          <p className="text-sm text-slate-400 text-center">Sin sesión programada para hoy</p>
        </div>
      )}

      {/* Forms */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Formularios de hoy</h2>

        <FormCard
          title="Wellness Pre-Entreno"
          description="Estado de fatiga, sueño, estrés y motivación"
          icon="💪"
          to="/player/wellness"
          submitted={wStatus?.submitted}
          score={wStatus?.data?.wellness_score}
          scoreLabel="WS"
        />

        <FormCard
          title="RPE Post-Entreno"
          description="Percepción subjetiva del esfuerzo"
          icon="⚡"
          to="/player/rpe"
          submitted={rStatus?.submitted}
          score={rStatus?.data?.rpe}
          scoreLabel="RPE"
        />
      </div>
    </div>
  );
}

function FormCard({ title, description, icon, to, submitted, score, scoreLabel }) {
  return (
    <Link
      to={submitted ? '#' : to}
      className={`block card transition-all duration-200 ${
        submitted
          ? 'border border-emerald-200 bg-emerald-50'
          : 'border border-slate-100 hover:border-red-200 hover:shadow-md hover:-translate-y-0.5 cursor-pointer'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl ${submitted ? 'bg-emerald-100' : 'bg-red-50'}`}>
            {icon}
          </div>
          <div>
            <p className="font-bold text-slate-800 text-sm">{title}</p>
            <p className="text-xs text-slate-400 mt-0.5">{description}</p>
          </div>
        </div>
        {submitted ? (
          <div className="text-right">
            <div className="text-emerald-600 text-xs font-bold">✓ Enviado</div>
            {score != null && (
              <div className="text-slate-800 font-extrabold text-lg">
                {Math.round(score)}<span className="text-xs text-slate-400 font-normal ml-1">{scoreLabel}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm">
            →
          </div>
        )}
      </div>
    </Link>
  );
}

function ColorDot({ color }) {
  const colors = { ROJO: 'bg-red-500', 'ROJO+': 'bg-red-700', NARANJA: 'bg-orange-500', AMARILLO: 'bg-amber-400' };
  return <div className={`w-3 h-3 rounded-full ${colors[color?.toUpperCase()] || 'bg-slate-400'}`} />;
}

function colorLabel(c) {
  const map = { ROJO: 'Alta intensidad', 'ROJO+': 'Partido', NARANJA: 'Moderado', AMARILLO: 'Baja intensidad' };
  return map[c?.toUpperCase()] || c;
}
