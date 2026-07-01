import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function JoinTeam() {
  const { token } = useParams();
  const [mode, setMode] = useState('login');
  const [invite, setInvite] = useState(null);
  const [form, setForm] = useState({ name: '', pin: '', confirmPin: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.get(`/invites/${token}`)
      .then(res => setInvite(res.data))
      .catch(err => setError(err.response?.data?.error || 'Invitacion no valida'))
      .finally(() => setLoading(false));
  }, [token]);

  function update(field, value) {
    const clean = field.toLowerCase().includes('pin') ? value.replace(/\D/g, '').slice(0, 6) : value;
    setForm(prev => ({ ...prev, [field]: clean }));
  }

  async function submit(e) {
    e.preventDefault();
    setError('');

    if (mode === 'register' && form.pin !== form.confirmPin) {
      setError('Los PIN no coinciden');
      return;
    }

    setSaving(true);
    try {
      const endpoint = mode === 'register' ? 'register' : 'login';
      const res = await api.post(`/invites/${token}/${endpoint}`, {
        name: form.name,
        pin: form.pin,
      });
      login(res.data.user, res.data.token);
      navigate('/player', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo completar el acceso');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400 font-semibold">Cargando...</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-100">
      <div className="card w-full max-w-md">
        {invite ? (
          <>
            <div className="mb-5">
              <p className="text-sm font-semibold text-red-500">Acceso de jugador</p>
              <h1 className="text-2xl font-extrabold text-slate-900">{invite.team.name}</h1>
              <p className="text-sm text-slate-400 mt-1">{invite.team.category || invite.team.club_name || 'Equipo'}</p>
            </div>

            <div className="flex bg-slate-100 rounded-xl p-1 mb-5">
              <button
                type="button"
                className={`flex-1 py-2 rounded-lg text-sm font-bold ${mode === 'login' ? 'bg-white text-red-500 shadow-sm' : 'text-slate-500'}`}
                onClick={() => { setMode('login'); setError(''); }}
              >
                Entrar
              </button>
              <button
                type="button"
                className={`flex-1 py-2 rounded-lg text-sm font-bold ${mode === 'register' ? 'bg-white text-red-500 shadow-sm' : 'text-slate-500'}`}
                onClick={() => { setMode('register'); setError(''); }}
              >
                Registrarme
              </button>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <Field label="Nombre y apellidos" value={form.name} onChange={v => update('name', v)} required />
              <Field label="PIN" type="password" inputMode="numeric" value={form.pin} onChange={v => update('pin', v)} minLength={4} maxLength={6} required />
              {mode === 'register' && (
                <Field label="Repite PIN" type="password" inputMode="numeric" value={form.confirmPin} onChange={v => update('confirmPin', v)} minLength={4} maxLength={6} required />
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm font-medium">
                  {error}
                </div>
              )}

              <button className="btn-primary w-full" disabled={saving}>
                {saving ? 'Procesando...' : mode === 'register' ? 'Crear acceso' : 'Entrar'}
              </button>
            </form>
          </>
        ) : (
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">Invitacion no disponible</h1>
            <p className="text-sm text-red-500 mt-2">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required = false, minLength, maxLength, inputMode }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        type={type}
        className="input"
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        inputMode={inputMode}
      />
    </div>
  );
}
