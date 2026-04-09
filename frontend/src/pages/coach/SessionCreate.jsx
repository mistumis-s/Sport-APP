import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const MD_TYPES = ['MD-5', 'MD-4', 'MD-3', 'MD-2', 'MD-1', 'MD(H)', 'MD(A)', 'MD+1', 'MD+2', 'MD+3'];
const DEFAULT_TEAM_ID = 1;
const COLOR_DAYS = [
  { value: 'AMARILLO', label: 'Amarillo - Baja intensidad', color: 'bg-amber-400', ring: 'ring-amber-300' },
  { value: 'NARANJA', label: 'Naranja - Moderado', color: 'bg-orange-500', ring: 'ring-orange-300' },
  { value: 'ROJO', label: 'Rojo - Alta intensidad', color: 'bg-red-500', ring: 'ring-red-300' },
  { value: 'ROJO+', label: 'Rojo+ - Partido', color: 'bg-red-700', ring: 'ring-red-400' },
];

function buildDefaultForm(date) {
  return {
    date,
    match_day_type: '',
    is_match: false,
    color_day: '',
    duration_minutes: '',
    notes: ''
  };
}

function buildFixturePayload(form) {
  return {
    date: form.date,
    team_id: DEFAULT_TEAM_ID,
    location: form.match_day_type === 'MD(A)' ? 'away' : 'home',
  };
}

function formatDate(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function addDays(date, days) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return value.toISOString().split('T')[0];
}

function getNextSessionDate(existingSessions) {
  if (!existingSessions.length) {
    return new Date().toISOString().split('T')[0];
  }
  const latest = [...existingSessions]
    .map(session => session.date)
    .sort((a, b) => b.localeCompare(a))[0];
  return addDays(latest, 1);
}

function getWeekInfo(date) {
  const current = new Date(`${date}T12:00:00`);
  const day = current.getDay() || 7;
  const monday = new Date(current);
  monday.setDate(current.getDate() - day + 1);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const firstThursday = new Date(Date.UTC(monday.getUTCFullYear(), 0, 4));
  const firstThursdayDay = firstThursday.getUTCDay() || 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstThursdayDay + 4);
  const currentThursday = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + 3));
  const weekNumber = 1 + Math.round((currentThursday - firstThursday) / 604800000);

  return {
    key: monday.toISOString().split('T')[0],
    weekNumber,
    startLabel: formatDate(monday.toISOString().split('T')[0]),
    endLabel: formatDate(sunday.toISOString().split('T')[0])
  };
}

function colorBadge(color) {
  const map = {
    ROJO: 'badge-red',
    'ROJO+': 'badge-red',
    NARANJA: 'badge-orange',
    AMARILLO: 'badge-yellow'
  };
  return map[color?.toUpperCase()] || 'badge-gray';
}

export default function SessionCreate() {
  const navigate = useNavigate();
  const [form, setForm] = useState(buildDefaultForm(new Date().toISOString().split('T')[0]));
  const [sessions, setSessions] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [sessionWeekFilter, setSessionWeekFilter] = useState('latest_two');
  const [loading, setLoading] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (editingId || loadingSessions) return;
    const nextDate = getNextSessionDate(sessions);
    setForm(current => (
      current.date === nextDate
        ? current
        : { ...current, date: nextDate }
    ));
  }, [editingId, loadingSessions, sessions]);

  const sessionsByWeek = useMemo(() => {
    const groups = new Map();

    sessions.forEach(session => {
      const week = getWeekInfo(session.date);
      if (!groups.has(week.key)) {
        groups.set(week.key, { ...week, sessions: [] });
      }
      groups.get(week.key).sessions.push(session);
    });

    return Array.from(groups.values())
      .sort((a, b) => b.key.localeCompare(a.key))
      .map(group => ({
        ...group,
        sessions: group.sessions.sort((a, b) => b.date.localeCompare(a.date))
      }));
  }, [sessions]);

  const visibleSessionWeeks = useMemo(() => {
    if (sessionWeekFilter === 'latest_two') {
      return sessionsByWeek.slice(0, 2);
    }
    return sessionsByWeek.filter(group => group.key === sessionWeekFilter);
  }, [sessionWeekFilter, sessionsByWeek]);

  async function loadSessions() {
    setLoadingSessions(true);
    try {
      const response = await api.get('/sessions', { params: { teamId: DEFAULT_TEAM_ID } });
      setSessions(response.data);
    } catch {
      setError('No se pudieron cargar las sesiones');
    } finally {
      setLoadingSessions(false);
    }
  }

  function set(field, val) {
    setForm(current => {
      const next = { ...current, [field]: val };
      if (field === 'is_match') {
        next.match_day_type = val ? 'MD(H)' : (['MD(H)', 'MD(A)'].includes(current.match_day_type) ? '' : current.match_day_type);
        next.color_day = val ? 'ROJO+' : (current.color_day === 'ROJO+' ? '' : current.color_day);
      }
      return next;
    });
  }

  function resetForm() {
    setForm(buildDefaultForm(getNextSessionDate(sessions)));
    setEditingId(null);
    setShowForm(false);
    setError('');
  }

  function startEdit(session) {
    setEditingId(session.id);
    setShowForm(true);
    setSuccess('');
    setError('');
    setForm({
      date: session.date,
      match_day_type: session.match_day_type,
      is_match: Boolean(session.is_match),
      color_day: session.color_day,
      duration_minutes: String(session.duration_minutes ?? ''),
      notes: session.notes || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.match_day_type || !form.color_day || !form.duration_minutes) {
      return setError('Completa todos los campos obligatorios');
    }

    if (!editingId && sessions.some(session => session.date === form.date)) {
      return setError('Ya existe una sesion en esa fecha. Selecciona otra disponible.');
    }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const sessionPayload = {
        ...form,
        team_id: DEFAULT_TEAM_ID,
      };
      let successMessage = '';

      if (editingId) {
        await api.put(`/sessions/${editingId}`, sessionPayload, { params: { teamId: DEFAULT_TEAM_ID } });
        successMessage = 'Sesion actualizada correctamente';
      } else {
        const response = await api.post('/sessions', sessionPayload);
        successMessage = response.data?.updated_existing ? 'Ya existia una sesion ese dia y se ha actualizado' : 'Sesion creada correctamente';
      }

      if (form.is_match) {
        try {
          await api.post('/fixtures', buildFixturePayload(form));
          successMessage = 'Sesion guardada y partido añadido al calendario correctamente';
        } catch (fixtureError) {
          successMessage = 'Sesion guardada, pero no se pudo añadir el partido al calendario';
        }
      }

      await loadSessions();
      setSuccess(successMessage);
      setTimeout(() => navigate('/coach'), 900);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar la sesion');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(session) {
    const confirmed = window.confirm(`¿Eliminar la sesion del ${formatDate(session.date)}?`);
    if (!confirmed) return;

    setError('');
    setSuccess('');
    try {
      await api.delete(`/sessions/${session.id}`, { params: { teamId: DEFAULT_TEAM_ID } });
      if (editingId === session.id) {
        resetForm();
      }
      await loadSessions();
      setSuccess('Sesion eliminada correctamente');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al eliminar la sesion');
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-20 sm:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Sesiones</h1>
          <p className="text-slate-400 text-sm mt-1">Revisa el historico y abre el formulario solo cuando quieras crear o editar una sesion</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              if (!showForm) {
                setForm(buildDefaultForm(getNextSessionDate(sessions)));
                setEditingId(null);
              }
              setShowForm(current => !current);
            }}
            className="btn-primary text-sm"
          >
            {showForm ? 'Ocultar formulario' : editingId ? 'Editar sesion' : 'Nueva sesion'}
          </button>
          <button type="button" onClick={() => navigate('/coach')} className="btn-secondary text-sm">
            Volver
          </button>
        </div>
      </div>

      <div className="card">
        <button
          type="button"
          onClick={() => {
            if (!showForm) {
              setForm(buildDefaultForm(getNextSessionDate(sessions)));
              setEditingId(null);
            }
            setShowForm(current => !current);
          }}
          className="w-full flex items-center justify-between gap-3 text-left"
        >
          <div>
            <h2 className="font-bold text-slate-800">{editingId ? 'Editar sesion' : 'Nueva sesion'}</h2>
            <p className="text-xs text-slate-400 mt-1">
              {editingId
                ? `Editando la sesion del ${formatDate(form.date)}`
                : `Proxima fecha sugerida: ${formatDate(form.date)}`}
            </p>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">
            {showForm ? 'Ocultar' : 'Abrir'}
          </span>
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-4">
              <div className="card">
                <label className="label">Fecha</label>
                <input
                  type="date"
                  className="input"
                  value={form.date}
                  onChange={e => set('date', e.target.value)}
                  required
                />
                {!editingId && (
                  <p className="text-xs text-slate-400 mt-1.5">La nueva sesion empieza por defecto el dia siguiente a la ultima que ya existe.</p>
                )}
              </div>

              <div className="card">
                <label className="label">Partido</label>
                <button
                  type="button"
                  onClick={() => set('is_match', !form.is_match)}
                  className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 transition-all duration-150 ${
                    form.is_match
                      ? 'border-red-200 bg-red-50 text-red-700'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  <div className="text-left">
                    <p className="text-sm font-bold">{form.is_match ? 'Dia marcado como partido' : 'Marcar como dia de partido'}</p>
                    <p className="text-xs text-slate-400 mt-1">Ese dia se usara como referencia para calcular automaticamente MD, MD-1 o MD+1.</p>
                  </div>
                  <span className={`text-xs font-extrabold px-2.5 py-1 rounded-full ${form.is_match ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {form.is_match ? 'SI' : 'NO'}
                  </span>
                </button>
              </div>

              <div className="card">
                <label className="label">Match Day Type</label>
                <select
                  className="input"
                  value={form.match_day_type}
                  onChange={e => set('match_day_type', e.target.value)}
                  disabled={form.is_match}
                  required
                >
                  <option value="">Selecciona el tipo de sesion</option>
                  {MD_TYPES.map(md => (
                    <option key={md} value={md}>
                      {md}
                    </option>
                  ))}
                </select>
                {form.is_match && (
                  <p className="text-xs text-slate-400 mt-2">Los partidos se guardan como MD(H) por defecto. Si es fuera de casa, puedes cambiarlo a MD(A) antes de guardar.</p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="card">
                <label className="label">Color Day - Intensidad</label>
                <div className="space-y-2 mt-1">
                  {COLOR_DAYS.map(cd => (
                    <button
                      key={cd.value}
                      type="button"
                      onClick={() => !form.is_match && set('color_day', cd.value)}
                      disabled={form.is_match}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-150 text-left border active:scale-95 ${
                        form.color_day === cd.value
                          ? `border-slate-300 bg-slate-50 ring-2 ${cd.ring}`
                          : 'border-slate-100 bg-slate-50 hover:border-slate-200'
                      } ${form.is_match ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className={`w-4 h-4 rounded-full ${cd.color} shadow-sm`} />
                      <span className="text-sm font-semibold text-slate-700">{cd.label}</span>
                      {form.color_day === cd.value && <span className="ml-auto text-emerald-500 font-bold">OK</span>}
                    </button>
                  ))}
                </div>
                {form.is_match && (
                  <p className="text-xs text-slate-400 mt-2">Al marcar partido, el color se fija automaticamente como ROJO+.</p>
                )}
              </div>

              <div className="card">
                <label className="label">Duracion (minutos)</label>
                <input
                  type="number"
                  className="input"
                  placeholder="ej. 90"
                  min={1}
                  max={300}
                  value={form.duration_minutes}
                  onChange={e => set('duration_minutes', e.target.value)}
                  required
                />
                <p className="text-xs text-slate-400 mt-1.5">Se usara para calcular el sRPE de cada jugador</p>
              </div>

              <div className="card">
                <label className="label">Notas <span className="text-slate-400 font-normal">(opcional)</span></label>
                <textarea
                  className="input resize-none"
                  rows={3}
                  placeholder="Observaciones sobre la sesion..."
                  value={form.notes}
                  onChange={e => set('notes', e.target.value)}
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm font-medium">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-emerald-700 text-sm font-medium">
              {success}
            </div>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={resetForm} className="btn-secondary flex-1">
              Limpiar
            </button>
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear sesion'}
            </button>
          </div>
        </form>
      )}

      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="font-bold text-slate-800 mb-0.5">Sesiones guardadas</h2>
            <p className="text-xs text-slate-400">Desde aqui puedes acceder, editar o eliminar cualquier sesion</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-red-300"
              value={sessionWeekFilter}
              onChange={e => setSessionWeekFilter(e.target.value)}
            >
              <option value="latest_two">Ultimas 2 semanas</option>
              {sessionsByWeek.map(group => (
                <option key={group.key} value={group.key}>
                  Semana {group.weekNumber} · {group.startLabel} - {group.endLabel}
                </option>
              ))}
            </select>
            <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs">
              <span className="text-slate-400 font-semibold mr-1">Total</span>
              <span className="font-extrabold text-slate-700">
                {visibleSessionWeeks.reduce((sum, group) => sum + group.sessions.length, 0)}
              </span>
            </div>
          </div>
        </div>

        {loadingSessions ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm font-medium text-slate-400">
            Cargando sesiones...
          </div>
        ) : sessions.length > 0 ? (
          <div className="space-y-4">
            {visibleSessionWeeks.map(group => (
              <div key={group.key} className="overflow-x-auto rounded-xl border border-slate-100">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
                  <div>
                    <h3 className="font-bold text-slate-800">Semana {group.weekNumber}</h3>
                    <p className="text-xs text-slate-400">{group.startLabel} - {group.endLabel}</p>
                  </div>
                  <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs">
                    <span className="text-slate-400 font-semibold mr-1">Sesiones</span>
                    <span className="font-extrabold text-slate-700">{group.sessions.length}</span>
                  </div>
                </div>

                <table className="w-full min-w-[820px] text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400">
                      <th className="text-left py-2 px-3 font-semibold">Fecha</th>
                      <th className="text-left px-3 font-semibold">Tipo</th>
                      <th className="text-left px-3 font-semibold">Color</th>
                      <th className="text-center px-3 font-semibold">Partido</th>
                      <th className="text-center px-3 font-semibold">Duracion</th>
                      <th className="text-left px-3 font-semibold">Notas</th>
                      <th className="text-right px-3 font-semibold">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.sessions.map(session => (
                      <tr key={session.id} className="border-b border-slate-50 hover:bg-slate-50/70 transition-colors">
                        <td className="py-2 px-3 font-medium text-slate-600">{formatDate(session.date)}</td>
                        <td className="px-3">
                          <span className="badge-gray">{session.match_day_type}</span>
                        </td>
                        <td className="px-3">
                          <span className={colorBadge(session.color_day)}>{session.color_day}</span>
                        </td>
                        <td className="text-center px-3">
                          <span className={`font-bold ${session.is_match ? 'text-red-500' : 'text-slate-300'}`}>
                            {session.is_match ? 'Si' : 'No'}
                          </span>
                        </td>
                        <td className="text-center px-3 font-semibold text-slate-700">{session.duration_minutes} min</td>
                        <td className="px-3 text-slate-500">{session.notes || '—'}</td>
                        <td className="px-3">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(session)}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-red-300 hover:text-red-500"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(session)}
                              className="rounded-lg border border-red-100 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-100"
                            >
                              Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm font-medium text-slate-400">
            Todavia no hay sesiones guardadas.
          </div>
        )}
      </div>
    </div>
  );
}
