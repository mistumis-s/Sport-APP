import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function JoinTeam() {
  const { token } = useParams();
  const [invite, setInvite] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
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
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      setError('Las contrasenas no coinciden');
      return;
    }

    setSaving(true);
    try {
      const res = await api.post(`/invites/${token}/register`, {
        name: form.name,
        email: form.email,
        password: form.password,
      });
      login(res.data.user, res.data.token);
      navigate('/player', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo completar el registro');
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
              <p className="text-sm font-semibold text-red-500">Registro de jugador</p>
              <h1 className="text-2xl font-extrabold text-slate-900">{invite.team.name}</h1>
              <p className="text-sm text-slate-400 mt-1">{invite.team.category || invite.team.club_name || 'Equipo'}</p>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <Field label="Nombre completo" value={form.name} onChange={v => update('name', v)} required />
              <Field label="Email" type="email" value={form.email} onChange={v => update('email', v)} required />
              <Field label="Contrasena" type="password" value={form.password} onChange={v => update('password', v)} minLength={8} required />
              <Field label="Repite contrasena" type="password" value={form.confirm} onChange={v => update('confirm', v)} minLength={8} required />

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm font-medium">
                  {error}
                </div>
              )}

              <button className="btn-primary w-full" disabled={saving}>
                {saving ? 'Creando cuenta...' : 'Crear cuenta'}
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

function Field({ label, value, onChange, type = 'text', required = false, minLength }) {
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
      />
    </div>
  );
}
