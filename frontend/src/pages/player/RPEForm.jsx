import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const RPE_LABELS = {
  0:  { label: 'Reposo total',    color: 'bg-slate-200 text-slate-600',   active: 'bg-slate-400 text-white' },
  1:  { label: 'Muy suave',       color: 'bg-slate-100 text-slate-600',   active: 'bg-slate-500 text-white' },
  2:  { label: 'Suave',           color: 'bg-slate-100 text-slate-600',   active: 'bg-slate-500 text-white' },
  3:  { label: 'Moderado',        color: 'bg-amber-50 text-amber-700',    active: 'bg-amber-400 text-white' },
  4:  { label: 'Un poco duro',    color: 'bg-amber-50 text-amber-700',    active: 'bg-amber-500 text-white' },
  5:  { label: 'Duro',            color: 'bg-orange-50 text-orange-700',  active: 'bg-orange-500 text-white' },
  6:  { label: 'Duro',            color: 'bg-orange-50 text-orange-700',  active: 'bg-orange-500 text-white' },
  7:  { label: 'Muy duro',        color: 'bg-red-50 text-red-700',        active: 'bg-red-500 text-white' },
  8:  { label: 'Muy duro',        color: 'bg-red-50 text-red-700',        active: 'bg-red-500 text-white' },
  9:  { label: 'Muy duro',        color: 'bg-red-50 text-red-800',        active: 'bg-red-600 text-white' },
  10: { label: 'Esfuerzo máximo', color: 'bg-red-50 text-red-900',        active: 'bg-red-700 text-white' },
};

export default function RPEForm() {
  const navigate = useNavigate();
  const today = new Date().toISOString().split('T')[0];
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [todaySession, setTodaySession] = useState(null);
  const [rpe, setRpe] = useState(null);
  const [comentarios, setComentarios] = useState('');

  useEffect(() => {
    api.get('/rpe/today').then(r => { if (r.data.submitted) setSubmitted(true); });
    api.get('/sessions').then(r => {
      const s = r.data.find(s => s.date === today);
      setTodaySession(s || null);
    }).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (rpe === null) return setError('Selecciona tu RPE');
    setError('');
    setLoading(true);
    try {
      await api.post('/rpe', { session_id: todaySession?.id || null, date: today, rpe, comentarios: comentarios || null });
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al enviar');
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="pb-20 sm:pb-0 flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-center">
        <div className="w-20 h-20 bg-emerald-100 rounded-3xl flex items-center justify-center text-5xl">⚡</div>
        <h2 className="text-2xl font-extrabold text-slate-800">¡RPE enviado!</h2>
        <p className="text-slate-400">Gracias. Tu esfuerzo ha sido registrado.</p>
        <button onClick={() => navigate('/player')} className="btn-secondary mt-2">← Volver al inicio</button>
      </div>
    );
  }

  return (
    <div className="pb-24 sm:pb-6 space-y-5 max-w-lg mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">RPE Post-Entreno</h1>
        <p className="text-slate-400 text-sm mt-1">¿Cómo de intenso ha sido el entrenamiento?</p>
      </div>

      {todaySession && (
        <div className="card border-l-4 border-l-orange-400">
          <p className="text-sm text-slate-600">
            Sesión: <span className="font-bold text-slate-800">{todaySession.match_day_type}</span>
            <span className="text-slate-400"> · {todaySession.duration_minutes} min</span>
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="card">
          <p className="font-bold text-slate-800 mb-4">Percepción del Esfuerzo (0 – 10)</p>
          <div className="grid grid-cols-1 gap-2">
            {[0,1,2,3,4,5,6,7,8,9,10].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setRpe(n)}
                className={`flex items-center gap-4 p-3 rounded-xl transition-all duration-150 active:scale-95 ${
                  rpe === n ? RPE_LABELS[n].active + ' shadow-md' : RPE_LABELS[n].color + ' hover:shadow-sm'
                }`}
              >
                <span className="text-2xl font-extrabold w-8 text-center">{n}</span>
                <span className="text-sm font-semibold">{RPE_LABELS[n].label}</span>
                {rpe === n && <span className="ml-auto text-lg">✓</span>}
              </button>
            ))}
          </div>
        </div>

        {rpe !== null && (
          <div className="card bg-gradient-to-r from-red-50 to-orange-50 border border-red-100 text-center">
            <p className="text-5xl font-extrabold text-red-500">{rpe}</p>
            <p className="text-slate-600 text-sm font-semibold mt-1">{RPE_LABELS[rpe].label}</p>
            {todaySession && (
              <p className="text-slate-400 text-xs mt-2">
                sRPE = {rpe} × {todaySession.duration_minutes} min =
                <span className="text-slate-700 font-bold ml-1">{rpe * todaySession.duration_minutes}</span>
              </p>
            )}
          </div>
        )}

        <div className="card">
          <p className="font-bold text-slate-800 mb-2">Comentarios <span className="text-slate-400 font-normal text-sm">(opcional)</span></p>
          <textarea
            className="input resize-none"
            rows={3}
            placeholder="Si tienes algo que especificar..."
            value={comentarios}
            onChange={e => setComentarios(e.target.value)}
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm font-medium">
            {error}
          </div>
        )}

        <button type="submit" disabled={loading || rpe === null} className="btn-primary w-full">
          {loading ? 'Enviando...' : 'Enviar RPE'}
        </button>
      </form>
    </div>
  );
}
