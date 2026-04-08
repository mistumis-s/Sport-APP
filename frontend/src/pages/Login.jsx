import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [mode, setMode] = useState('player');
  const [players, setPlayers] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/auth/players').then(r => setPlayers(r.data)).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let res;
      if (mode === 'player') {
        res = await api.post('/auth/player', { name: selectedPlayer, pin });
      } else {
        res = await api.post('/auth/coach', { password });
      }
      login(res.data.user, res.data.token);
      navigate(mode === 'coach' ? '/coach' : '/player');
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-slate-100 to-red-50">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-red-500 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-red-200">
            <span className="text-4xl">🏉</span>
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900">DH ÉLITE</h1>
          <p className="text-slate-400 text-sm mt-1 font-medium">Sport Performance Tracker</p>
        </div>

        <div className="card shadow-md border border-slate-100">
          {/* Toggle */}
          <div className="flex bg-slate-100 rounded-xl p-1 mb-5">
            <button
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${
                mode === 'player' ? 'bg-white text-red-500 shadow-sm' : 'text-slate-500'
              }`}
              onClick={() => { setMode('player'); setError(''); }}
            >
              Jugador
            </button>
            <button
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${
                mode === 'coach' ? 'bg-white text-red-500 shadow-sm' : 'text-slate-500'
              }`}
              onClick={() => { setMode('coach'); setError(''); }}
            >
              Preparador
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'player' ? (
              <>
                <div>
                  <label className="label">Tu nombre</label>
                  <select
                    className="input"
                    value={selectedPlayer}
                    onChange={e => setSelectedPlayer(e.target.value)}
                    required
                  >
                    <option value="">— Elige tu nombre —</option>
                    {players.map(p => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">PIN</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    className="input text-center text-2xl tracking-widest"
                    placeholder="• • • •"
                    value={pin}
                    onChange={e => setPin(e.target.value)}
                    maxLength={8}
                    required
                  />
                  <p className="text-xs text-slate-400 mt-1.5 text-center">PIN por defecto: 1234</p>
                </div>
              </>
            ) : (
              <div>
                <label className="label">Contraseña</label>
                <input
                  type="password"
                  className="input"
                  placeholder="Contraseña del preparador"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <p className="text-xs text-slate-400 mt-1.5">Por defecto: coach123</p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-600 text-sm font-medium">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full text-center mt-2">
              {loading ? 'Cargando...' : 'Entrar →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
