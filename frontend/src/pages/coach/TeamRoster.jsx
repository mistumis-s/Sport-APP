import React, { useEffect, useState } from 'react';
import api from '../../services/api';

const INITIAL_FORM = { name: '', pin: '1234' };

export default function TeamRoster() {
  const [players, setPlayers] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadPlayers();
  }, []);

  async function loadPlayers() {
    setLoading(true);
    try {
      const res = await api.get('/auth/coach/players');
      setPlayers(res.data);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/auth/coach/players', form);
      setForm(INITIAL_FORM);
      await loadPlayers();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo crear el jugador');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(player) {
    const ok = window.confirm(`Se eliminara ${player.name} y tambien todo su historial de wellness y RPE. Continuar?`);
    if (!ok) return;

    try {
      await api.delete(`/auth/coach/players/${player.id}`);
      await loadPlayers();
    } catch (err) {
      window.alert(err.response?.data?.error || 'No se pudo eliminar el jugador');
    }
  }

  return (
    <div className="pb-20 sm:pb-0 space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Plantilla</h1>
        <p className="text-slate-400 text-sm font-medium">Anade, revisa o elimina jugadores manualmente.</p>
      </div>

      <div className="card">
        <h2 className="text-sm font-bold text-slate-800 mb-3">Anadir jugador</h2>
        <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-[1fr_140px_auto]">
          <input
            type="text"
            value={form.name}
            onChange={e => setForm(current => ({ ...current, name: e.target.value }))}
            placeholder="Nombre del jugador"
            className="input"
          />
          <input
            type="text"
            inputMode="numeric"
            maxLength={4}
            value={form.pin}
            onChange={e => setForm(current => ({ ...current, pin: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
            placeholder="PIN 4 cifras"
            className="input"
          />
          <button
            type="submit"
            disabled={saving}
            className="btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? 'Guardando...' : 'Crear'}
          </button>
        </form>
        {error && <p className="text-sm text-red-500 mt-3 font-medium">{error}</p>}
        <p className="text-xs text-slate-400 mt-3">El nombre se guardara en mayusculas y el PIN debe tener 4 cifras.</p>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-800">Jugadores actuales</h2>
          <span className="text-xs font-bold text-slate-400">{players.length} jugadores</span>
        </div>

        {loading ? (
          <div className="text-center text-slate-400 py-8 text-sm font-medium">Cargando plantilla...</div>
        ) : players.length === 0 ? (
          <div className="text-center text-slate-400 py-8 text-sm font-medium">Todavia no hay jugadores creados.</div>
        ) : (
          <div className="space-y-2">
            {players.map(player => (
              <div key={player.id} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-slate-800 truncate">{player.name}</p>
                  <div className="flex flex-wrap gap-2 mt-1 text-xs text-slate-400 font-medium">
                    <span>PIN {player.pin}</span>
                    <span>{player.wellness_entries} wellness</span>
                    <span>{player.rpe_entries} RPE</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(player)}
                  className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
                >
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
