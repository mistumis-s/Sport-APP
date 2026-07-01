import React, { useEffect, useMemo, useState } from 'react';
import api from '../services/api';

const emptyTeamForm = {
  team_name: '',
  club_name: '',
  category: '',
  coach_name: '',
  coach_email: '',
};

const emptyCoachForm = {
  team_id: '',
  coach_name: '',
  coach_email: '',
};

export default function AdminProvisioning() {
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem('admin_api_key') || '');
  const [teams, setTeams] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [teamForm, setTeamForm] = useState(emptyTeamForm);
  const [coachForm, setCoachForm] = useState(emptyCoachForm);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [credentials, setCredentials] = useState(null);

  const headers = useMemo(() => ({ 'x-admin-key': adminKey }), [adminKey]);

  useEffect(() => {
    if (!adminKey) return;
    localStorage.setItem('admin_api_key', adminKey);
    loadTeams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminKey]);

  async function loadTeams() {
    setError('');
    try {
      const [teamsRes, coachesRes] = await Promise.all([
        api.get('/admin/teams', { headers }),
        api.get('/admin/coaches', { headers }),
      ]);
      setTeams(teamsRes.data);
      setCoaches(coachesRes.data);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudieron cargar los equipos');
    }
  }

  function updateTeamForm(field, value) {
    setTeamForm(prev => ({ ...prev, [field]: value }));
  }

  function updateCoachForm(field, value) {
    setCoachForm(prev => ({ ...prev, [field]: value }));
  }

  async function createTeam(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    setCredentials(null);
    try {
      const res = await api.post('/admin/teams', teamForm, { headers });
      setCredentials(res.data.credentials);
      setMessage(`Equipo creado: ${res.data.team.name}`);
      setTeamForm(emptyTeamForm);
      await loadTeams();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo crear el equipo');
    } finally {
      setLoading(false);
    }
  }

  async function createCoach(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    setCredentials(null);
    try {
      const res = await api.post(`/admin/teams/${coachForm.team_id}/coaches`, {
        coach_name: coachForm.coach_name,
        coach_email: coachForm.coach_email,
      }, { headers });
      setCredentials(res.data.credentials);
      setMessage(`Entrenador creado para ${res.data.team.name}`);
      setCoachForm(emptyCoachForm);
      await loadTeams();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo crear el entrenador');
    } finally {
      setLoading(false);
    }
  }

  async function resetCoachPassword(coach) {
    const ok = window.confirm(`Generar nueva contrasena temporal para ${coach.name}?`);
    if (!ok) return;

    setLoading(true);
    setError('');
    setMessage('');
    setCredentials(null);
    try {
      const res = await api.post(`/admin/coaches/${coach.id}/reset-password`, {}, { headers });
      setCredentials(res.data.credentials);
      setMessage(`Contrasena temporal generada para ${coach.email}`);
      await loadTeams();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo resetear la contrasena');
    } finally {
      setLoading(false);
    }
  }

  async function copyCredentials() {
    if (!credentials) return;
    const text = [
      'Acceso Sport APP',
      'URL: https://sport-app-7ibp.onrender.com',
      `Email: ${credentials.email}`,
      `Contrasena: ${credentials.temporary_password}`,
    ].join('\n');
    await navigator.clipboard.writeText(text);
    setMessage('Credenciales copiadas');
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-red-500">Administracion privada</p>
          <h1 className="text-2xl font-extrabold text-slate-900">Alta de equipos</h1>
        </div>
        <a href="/" className="btn-secondary text-center">Volver</a>
      </header>

      <section className="card">
        <label className="label">Clave admin</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="password"
            className="input"
            placeholder="ADMIN_API_KEY de Render"
            value={adminKey}
            onChange={e => setAdminKey(e.target.value)}
          />
          <button type="button" className="btn-secondary" onClick={loadTeams} disabled={!adminKey}>
            Cargar
          </button>
        </div>
      </section>

      {(message || error) && (
        <div className={`rounded-xl px-4 py-3 text-sm font-semibold ${error ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
          {error || message}
        </div>
      )}

      {credentials && (
        <section className="card border-emerald-200">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-bold text-emerald-700">Credenciales generadas</p>
              <p className="text-sm text-slate-600 mt-1">Email: {credentials.email}</p>
              <p className="text-sm text-slate-600">Contrasena: {credentials.temporary_password}</p>
            </div>
            <button type="button" className="btn-primary" onClick={copyCredentials}>
              Copiar acceso
            </button>
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="text-lg font-extrabold text-slate-900 mb-4">Crear equipo</h2>
          <form onSubmit={createTeam} className="space-y-4">
            <Field label="Equipo" value={teamForm.team_name} onChange={v => updateTeamForm('team_name', v)} required />
            <Field label="Club" value={teamForm.club_name} onChange={v => updateTeamForm('club_name', v)} />
            <Field label="Categoria" value={teamForm.category} onChange={v => updateTeamForm('category', v)} />
            <Field label="Entrenador principal" value={teamForm.coach_name} onChange={v => updateTeamForm('coach_name', v)} required />
            <Field label="Email entrenador" type="email" value={teamForm.coach_email} onChange={v => updateTeamForm('coach_email', v)} required />
            <button className="btn-primary w-full" disabled={loading || !adminKey}>
              Crear equipo
            </button>
          </form>
        </section>

        <section className="card">
          <h2 className="text-lg font-extrabold text-slate-900 mb-4">Anadir entrenador</h2>
          <form onSubmit={createCoach} className="space-y-4">
            <div>
              <label className="label">Equipo</label>
              <select
                className="input"
                value={coachForm.team_id}
                onChange={e => updateCoachForm('team_id', e.target.value)}
                required
              >
                <option value="">Selecciona equipo</option>
                {teams.map(team => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </div>
            <Field label="Nombre entrenador" value={coachForm.coach_name} onChange={v => updateCoachForm('coach_name', v)} required />
            <Field label="Email entrenador" type="email" value={coachForm.coach_email} onChange={v => updateCoachForm('coach_email', v)} required />
            <button className="btn-primary w-full" disabled={loading || !adminKey}>
              Crear entrenador
            </button>
          </form>
        </section>
      </div>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-extrabold text-slate-900">Equipos</h2>
          <button type="button" className="btn-secondary" onClick={loadTeams} disabled={!adminKey}>
            Actualizar
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-100">
                <th className="py-3 pr-4">Equipo</th>
                <th className="py-3 pr-4">Club</th>
                <th className="py-3 pr-4">Categoria</th>
                <th className="py-3 pr-4">Entrenadores</th>
                <th className="py-3 pr-4">Jugadores</th>
              </tr>
            </thead>
            <tbody>
              {teams.map(team => (
                <tr key={team.id} className="border-b border-slate-50">
                  <td className="py-3 pr-4 font-semibold text-slate-900">{team.name}</td>
                  <td className="py-3 pr-4 text-slate-600">{team.club_name || '-'}</td>
                  <td className="py-3 pr-4 text-slate-600">{team.category || '-'}</td>
                  <td className="py-3 pr-4 text-slate-600">{team.coaches}</td>
                  <td className="py-3 pr-4 text-slate-600">{team.players}</td>
                </tr>
              ))}
              {!teams.length && (
                <tr>
                  <td className="py-6 text-slate-400" colSpan="5">Sin equipos cargados</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">Entrenadores</h2>
            <p className="text-xs text-slate-400 mt-1">Las contrasenas actuales no se pueden ver; puedes generar una temporal nueva.</p>
          </div>
          <span className="text-xs font-bold text-slate-400">{coaches.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-100">
                <th className="py-3 pr-4">Nombre</th>
                <th className="py-3 pr-4">Email</th>
                <th className="py-3 pr-4">Equipos</th>
                <th className="py-3 pr-4">Estado</th>
                <th className="py-3 pr-4"></th>
              </tr>
            </thead>
            <tbody>
              {coaches.map(coach => (
                <tr key={coach.id} className="border-b border-slate-50">
                  <td className="py-3 pr-4 font-semibold text-slate-900">{coach.name}</td>
                  <td className="py-3 pr-4 text-slate-600">{coach.email || '-'}</td>
                  <td className="py-3 pr-4 text-slate-600">
                    {(coach.teams || []).map(team => team.name).join(', ') || '-'}
                  </td>
                  <td className="py-3 pr-4">
                    {coach.must_change_password ? (
                      <span className="badge-yellow">Cambio pendiente</span>
                    ) : (
                      <span className="badge-green">Activa</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-right">
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      onClick={() => resetCoachPassword(coach)}
                      disabled={loading}
                    >
                      Resetear
                    </button>
                  </td>
                </tr>
              ))}
              {!coaches.length && (
                <tr>
                  <td className="py-6 text-slate-400" colSpan="5">Sin entrenadores cargados</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required = false }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        type={type}
        className="input"
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
      />
    </div>
  );
}
