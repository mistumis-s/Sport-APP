import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

const SENSACION_MAP = {
  muy_bien: { label: 'Muy buenas sensaciones', color: 'text-emerald-600' },
  bien:     { label: 'Buenas sensaciones',     color: 'text-lime-600' },
  normal:   { label: 'Normal',                  color: 'text-amber-600' },
  mal:      { label: 'Malas sensaciones',       color: 'text-orange-600' },
  muy_mal:  { label: 'Muy malas sensaciones',   color: 'text-red-600' },
};

const ENFERMEDAD_MAP = {
  resfriado: 'Resfriado', gripe: 'Gripe', digestivo: 'Prob. digestivos', otros: 'Enfermedad',
};

function acBadge(ac) {
  if (!ac) return null;
  if (ac > 1.3) return <span className="badge-red">A/C {ac} ⚠</span>;
  if (ac >= 0.8) return <span className="badge-green">A/C {ac}</span>;
  return <span className="badge-yellow">A/C {ac}</span>;
}

function wsColor(ws) {
  if (!ws) return 'text-slate-300';
  if (ws >= 75) return 'text-emerald-600';
  if (ws >= 50) return 'text-amber-500';
  return 'text-red-500';
}

export default function PlayersList() {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dateBounds, setDateBounds] = useState({ min: '', max: new Date().toISOString().split('T')[0] });

  useEffect(() => {
    setLoading(true);
    api.get(`/dashboard/players?date=${selectedDate}`).then(r => {
      setPlayers(r.data.players || []);
      setDateBounds({
        min: r.data.min_date || '',
        max: r.data.max_date || new Date().toISOString().split('T')[0],
      });
    }).finally(() => setLoading(false));
  }, [selectedDate]);

  const filtered = players.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  const submitted = players.filter(p => p.submitted_wellness).length;

  return (
    <div className="pb-20 sm:pb-0 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Jugadores</h1>
          <p className="text-slate-400 text-sm font-medium">{submitted}/{players.length} Wellness enviados el {formatSelectedDate(selectedDate)}</p>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-bold ${submitted === players.length && players.length > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
          {submitted}/{players.length}
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-bold text-slate-700">Ver respuestas del día</p>
          <input
            type="date"
            value={selectedDate}
            min={dateBounds.min || undefined}
            max={dateBounds.max || undefined}
            onChange={e => setSelectedDate(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:border-red-400"
          />
          <button
            type="button"
            onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
            className="text-xs text-slate-400 hover:text-slate-700 font-semibold transition-colors"
          >
            Ir a hoy
          </button>
        </div>
      </div>

      <input
        type="text"
        className="input"
        placeholder="Buscar jugador..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {loading ? (
        <div className="text-center text-slate-400 py-12 font-medium">Cargando...</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => {
            const molestias = p.today_molestias
              ? (() => { try { return JSON.parse(p.today_molestias); } catch { return []; } })()
              : [];
            const enfermedad = p.today_enfermedad && p.today_enfermedad !== 'no'
              ? ENFERMEDAD_MAP[p.today_enfermedad] || p.today_enfermedad
              : null;
            const sensacion = p.today_sensacion ? SENSACION_MAP[p.today_sensacion] : null;
            const hasMolestias = molestias.length > 0;
            const hasAlerts = hasMolestias || enfermedad || ['mal', 'muy_mal'].includes(p.today_sensacion);

            return (
              <Link
                key={p.id}
                to={`/coach/player/${p.id}`}
                className={`block card transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md ${
                  hasAlerts ? 'border border-orange-200 bg-orange-50/50' : 'border border-slate-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex flex-col gap-1.5">
                      <div className={`w-2.5 h-2.5 rounded-full ${p.submitted_wellness ? 'bg-emerald-400' : 'bg-slate-200'}`} title="Wellness" />
                      <div className={`w-2.5 h-2.5 rounded-full ${p.submitted_rpe ? 'bg-blue-400' : 'bg-slate-200'}`} title="RPE" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 text-sm truncate">{p.name}</p>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {acBadge(p.ac)}
                        {!p.submitted_wellness && <span className="badge-gray">Sin Wellness</span>}
                        {!p.submitted_rpe && <span className="badge-gray">Sin RPE</span>}
                        {enfermedad && <span className="badge-red">🤒 {enfermedad}</span>}
                        {hasMolestias && (
                          <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-600">
                            ⚠ {molestias.length} molestia{molestias.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {p.today_ws != null && (
                      <div className="text-right">
                        <p className="text-xs text-slate-400 font-semibold">WS</p>
                        <p className={`font-extrabold text-xl ${wsColor(p.today_ws)}`}>{p.today_ws}</p>
                      </div>
                    )}
                    {p.today_rpe != null && (
                      <div className="text-right">
                        <p className="text-xs text-slate-400 font-semibold">RPE</p>
                        <p className="font-extrabold text-xl text-orange-500">{p.today_rpe}</p>
                      </div>
                    )}
                    <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 text-sm">→</div>
                  </div>
                </div>

                {p.submitted_wellness && (sensacion || p.today_entrenamiento_previo != null || p.today_comentarios || hasMolestias) && (
                  <div className="mt-2 pt-2 border-t border-slate-100 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                    {hasMolestias && (
                      <span className="text-orange-600 font-semibold">⚠ {molestias.join(', ')}</span>
                    )}
                    {sensacion && (
                      <span className={`font-semibold ${sensacion.color}`}>→ {sensacion.label}</span>
                    )}
                    {p.today_entrenamiento_previo != null && (
                      <span className={p.today_entrenamiento_previo ? 'text-amber-600 font-semibold' : 'text-slate-400'}>
                        Entreno previo: {p.today_entrenamiento_previo ? 'Sí' : 'No'}
                      </span>
                    )}
                    {p.today_comentarios && (
                      <span className="text-slate-400 italic">"{p.today_comentarios}"</span>
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatSelectedDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}
