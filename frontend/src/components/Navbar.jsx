import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const isCoach = user?.role === 'coach';

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-extrabold text-red-500 text-lg tracking-tight">DH ELITE</span>
          {isCoach && (
            <div className="hidden sm:flex gap-1">
              <NavLink to="/coach" active={loc.pathname === '/coach'}>Dashboard</NavLink>
              <NavLink to="/coach/players" active={loc.pathname.startsWith('/coach/player')}>Jugadores</NavLink>
              <NavLink to="/coach/roster" active={loc.pathname === '/coach/roster'}>Plantilla</NavLink>
              <NavLink to="/coach/session/new" active={loc.pathname === '/coach/session/new'}>+ Sesion</NavLink>
            </div>
          )}
          {!isCoach && (
            <div className="hidden sm:flex gap-1">
              <NavLink to="/player" active={loc.pathname === '/player'}>Inicio</NavLink>
              <NavLink to="/player/wellness" active={loc.pathname === '/player/wellness'}>Wellness</NavLink>
              <NavLink to="/player/rpe" active={loc.pathname === '/player/rpe'}>RPE</NavLink>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 hidden sm:block truncate max-w-32">{user?.name}</span>
          <button
            onClick={logout}
            className="text-xs text-slate-400 hover:text-red-500 transition-colors font-medium px-2 py-1 rounded-lg hover:bg-red-50"
          >
            Salir
          </button>
        </div>
      </div>

      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex z-50 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
        {isCoach ? (
          <>
            <MobileNavLink to="/coach" label="Dashboard" icon="D" active={loc.pathname === '/coach'} />
            <MobileNavLink to="/coach/players" label="Jugadores" icon="J" active={loc.pathname.startsWith('/coach/player')} />
            <MobileNavLink to="/coach/roster" label="Plantilla" icon="P" active={loc.pathname === '/coach/roster'} />
            <MobileNavLink to="/coach/session/new" label="Sesion" icon="+" active={loc.pathname === '/coach/session/new'} />
          </>
        ) : (
          <>
            <MobileNavLink to="/player" label="Inicio" icon="I" active={loc.pathname === '/player'} />
            <MobileNavLink to="/player/wellness" label="Wellness" icon="W" active={loc.pathname === '/player/wellness'} />
            <MobileNavLink to="/player/rpe" label="RPE" icon="R" active={loc.pathname === '/player/rpe'} />
          </>
        )}
      </div>
    </nav>
  );
}

function NavLink({ to, children, active }) {
  return (
    <Link
      to={to}
      className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
        active ? 'bg-red-50 text-red-500' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
      }`}
    >
      {children}
    </Link>
  );
}

function MobileNavLink({ to, label, icon, active }) {
  return (
    <Link
      to={to}
      className={`flex-1 flex flex-col items-center py-2 text-xs font-semibold transition-all ${
        active ? 'text-red-500' : 'text-slate-400'
      }`}
    >
      <span className="text-xl">{icon}</span>
      <span className="mt-0.5">{label}</span>
    </Link>
  );
}
