import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const MD_TYPES = ['MD-5','MD-4','MD-3','MD-2','MD-1','MD','MD(H)','MD(A)','MD+1','MD+2','MD+3'];
const COLOR_DAYS = [
  { value: 'AMARILLO', label: 'Amarillo — Baja intensidad', color: 'bg-amber-400', ring: 'ring-amber-300' },
  { value: 'NARANJA',  label: 'Naranja — Moderado',        color: 'bg-orange-500', ring: 'ring-orange-300' },
  { value: 'ROJO',     label: 'Rojo — Alta intensidad',    color: 'bg-red-500',    ring: 'ring-red-300' },
  { value: 'ROJO+',    label: 'Rojo+ — Partido',           color: 'bg-red-700',    ring: 'ring-red-400' },
];

export default function SessionCreate() {
  const navigate = useNavigate();
  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({ date: today, match_day_type: '', color_day: '', duration_minutes: '', notes: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function set(field, val) { setForm(f => ({ ...f, [field]: val })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.match_day_type || !form.color_day || !form.duration_minutes) {
      return setError('Completa todos los campos obligatorios');
    }
    setError('');
    setLoading(true);
    try {
      await api.post('/sessions', form);
      navigate('/coach');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-5 pb-20 sm:pb-0">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Nueva Sesión</h1>
        <p className="text-slate-400 text-sm mt-1">Define los parámetros del entrenamiento</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="card">
          <label className="label">Fecha</label>
          <input type="date" className="input" value={form.date} onChange={e => set('date', e.target.value)} required />
        </div>

        <div className="card">
          <label className="label">Match Day Type</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {MD_TYPES.map(md => (
              <button
                key={md}
                type="button"
                onClick={() => set('match_day_type', md)}
                className={`px-3 py-2 rounded-lg text-sm font-bold transition-all duration-150 active:scale-95 ${
                  form.match_day_type === md
                    ? 'bg-red-500 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {md}
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <label className="label">Color Day — Intensidad</label>
          <div className="space-y-2 mt-1">
            {COLOR_DAYS.map(cd => (
              <button
                key={cd.value}
                type="button"
                onClick={() => set('color_day', cd.value)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-150 text-left border active:scale-95 ${
                  form.color_day === cd.value
                    ? `border-slate-300 bg-slate-50 ring-2 ${cd.ring}`
                    : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                }`}
              >
                <div className={`w-4 h-4 rounded-full ${cd.color} shadow-sm`} />
                <span className="text-sm font-semibold text-slate-700">{cd.label}</span>
                {form.color_day === cd.value && <span className="ml-auto text-emerald-500 font-bold">✓</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <label className="label">Duración (minutos)</label>
          <input
            type="number"
            className="input"
            placeholder="ej. 90"
            min={1} max={300}
            value={form.duration_minutes}
            onChange={e => set('duration_minutes', e.target.value)}
            required
          />
          <p className="text-xs text-slate-400 mt-1.5">Se usará para calcular el sRPE de cada jugador</p>
        </div>

        <div className="card">
          <label className="label">Notas <span className="text-slate-400 font-normal">(opcional)</span></label>
          <textarea
            className="input resize-none"
            rows={2}
            placeholder="Observaciones sobre la sesión..."
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm font-medium">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button type="button" onClick={() => navigate('/coach')} className="btn-secondary flex-1">
            Cancelar
          </button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? 'Guardando...' : 'Crear Sesión'}
          </button>
        </div>
      </form>
    </div>
  );
}
