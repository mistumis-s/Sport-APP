import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const INITIAL_FORM = { name: '', pin: '' };

export default function TeamRoster() {
  const [players, setPlayers] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [inviteUrl, setInviteUrl] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [credentials, setCredentials] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const { user } = useAuth();
  const activeTeam = Array.isArray(user?.teams)
    ? user.teams.find(team => Number(team.team_id) === Number(user.team_id))
    : null;

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

  async function createInvite() {
    setError('');
    setMessage('');
    try {
      const res = await api.post('/invites/player');
      setInviteUrl(res.data.url);
      setInviteCode(res.data.access_code || activeTeam?.access_code || '');
      await navigator.clipboard.writeText([
        `Enlace: ${res.data.url}`,
        `Codigo: ${res.data.access_code || activeTeam?.access_code || ''}`,
      ].join('\n'));
      setMessage('Enlace copiado');
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo crear el enlace');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    setCredentials(null);
    try {
      const res = await api.post('/auth/coach/players', form);
      setCredentials(res.data.credentials);
      setForm(INITIAL_FORM);
      await loadPlayers();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo crear el jugador');
    } finally {
      setSaving(false);
    }
  }

  async function copyCredentials() {
    if (!credentials) return;
    const text = [
      'Acceso Sport APP',
      `URL: ${window.location.origin}`,
      activeTeam?.access_code ? `Codigo equipo: ${activeTeam.access_code}` : null,
      `Nombre: ${credentials.name}`,
      `PIN: ${credentials.pin}`,
    ].filter(Boolean).join('\n');
    await navigator.clipboard.writeText(text);
    setMessage('Credenciales copiadas');
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
        <p className="text-slate-400 text-sm font-medium">Invita jugadores o crea accesos manualmente.</p>
      </div>

      {(message || error) && (
        <div className={`rounded-xl px-4 py-3 text-sm font-semibold ${error ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
          {error || message}
        </div>
      )}

      <div className="card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Enlace de registro</h2>
            <p className="text-xs text-slate-400 mt-1">El jugador vera solo el nombre de este equipo.</p>
            {activeTeam?.access_code && (
              <p className="text-xs text-slate-500 mt-2 font-bold">Codigo equipo: {activeTeam.access_code}</p>
            )}
          </div>
          <button type="button" onClick={createInvite} className="btn-primary">
            Crear enlace
          </button>
        </div>
        {inviteUrl && (
          <div className="grid gap-3 mt-3 sm:grid-cols-[1fr_160px]">
            <input className="input text-sm" value={inviteUrl} readOnly onFocus={e => e.target.select()} />
            <input className="input text-sm font-bold" value={inviteCode} readOnly onFocus={e => e.target.select()} />
          </div>
        )}
      </div>

      {credentials && (
        <div className="card border-emerald-200">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-emerald-700">Acceso creado</p>
              <p className="text-sm text-slate-600 mt-1">Nombre: {credentials.name}</p>
              <p className="text-sm text-slate-600">PIN: {credentials.pin}</p>
            </div>
            <button type="button" className="btn-primary" onClick={copyCredentials}>
              Copiar
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <h2 className="text-sm font-bold text-slate-800 mb-3">Anadir jugador manualmente</h2>
        <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-[1fr_140px_auto]">
          <input
            type="text"
            value={form.name}
            onChange={e => setForm(current => ({ ...current, name: e.target.value }))}
            placeholder="Nombre del jugador"
            className="input"
            required
          />
          <input
            type="password"
            inputMode="numeric"
            minLength={4}
            maxLength={6}
            value={form.pin}
            onChange={e => setForm(current => ({ ...current, pin: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
            placeholder="PIN"
            className="input"
            required
          />
          <button
            type="submit"
            disabled={saving}
            className="btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? 'Guardando...' : 'Crear'}
          </button>
        </form>
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
                    <span>{player.pin ? `PIN ${player.pin}` : 'Sin PIN'}</span>
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
