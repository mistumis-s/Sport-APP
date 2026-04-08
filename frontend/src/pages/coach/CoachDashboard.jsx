import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { WSChart, RPEChart, SRPEChart } from '../../components/charts/TeamTimelineChart';
import ScatterPlot from '../../components/charts/ScatterPlot';

const DAYS_OPTIONS = [7, 14, 28];

function colorBadge(color) {
  const map = { ROJO: 'badge-red', 'ROJO+': 'badge-red', NARANJA: 'badge-orange', AMARILLO: 'badge-yellow' };
  return map[color?.toUpperCase()] || 'badge-gray';
}

function wsColor(ws) {
  if (!ws) return 'text-slate-400';
  if (ws >= 75) return 'text-emerald-600';
  if (ws >= 50) return 'text-amber-600';
  return 'text-red-500';
}

function metricTone(value, mode = 'ratio') {
  if (value == null) return 'text-slate-300';
  if (mode === 'ws') {
    if (value >= 75) return 'text-emerald-600';
    if (value >= 50) return 'text-amber-600';
    return 'text-red-500';
  }
  if (mode === 'ratio') {
    if (value > 1.3 || value < 0.8) return 'text-red-500';
    return 'text-emerald-600';
  }
  if (mode === 'monotony') {
    if (value > 3.5) return 'text-red-500';
    if (value >= 2.5) return 'text-amber-600';
    return 'text-emerald-600';
  }
  if (mode === 'stress') {
    if (value > 8000) return 'text-red-500';
    if (value >= 2000) return 'text-amber-600';
    return 'text-emerald-600';
  }
  return 'text-slate-700';
}

export default function CoachDashboard() {
  const [days, setDays] = useState(14);
  const [selectedWeekStart, setSelectedWeekStart] = useState('');
  const [teamData, setTeamData] = useState(null);
  const [scatter, setScatter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: 'load.stress', direction: 'desc' });

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/dashboard/team?days=${days}${selectedWeekStart ? `&week_start=${selectedWeekStart}` : ''}`),
      api.get('/dashboard/scatter')
    ]).then(([team, sc]) => {
      setTeamData(team.data);
      setScatter(sc.data);
    }).finally(() => setLoading(false));
  }, [days, selectedWeekStart]);

  const chartData = teamData?.timeline?.map(d => ({
    ...d,
    label: formatDate(d.date)
  })) || [];
  const weeklyReport = teamData?.weekly_report;
  const availableWeeks = teamData?.available_weeks || [];
  const sortedWeeklyRows = weeklyReport?.rows
    ? [...weeklyReport.rows].sort((a, b) => compareValues(getSortValue(a, sortConfig.key), getSortValue(b, sortConfig.key), sortConfig.direction))
    : [];

  const today = new Date().toISOString().split('T')[0];
  const todayData = teamData?.timeline?.find(d => d.date === today);

  function handleSort(key) {
    setSortConfig(current => (
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: key === 'player_name' ? 'asc' : 'desc' }
    ));
  }

  return (
    <div className="pb-20 sm:pb-0 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Dashboard</h1>
          <p className="text-slate-400 text-sm font-medium">DH Élite · {teamData?.total_players || '—'} jugadores</p>
        </div>
        <Link to="/coach/session/new" className="btn-primary text-sm py-2 px-4">+ Sesión</Link>
      </div>

      {/* Today summary */}
      {todayData ? (
        <div className="card border-l-4 border-l-red-400">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-3 font-bold">Hoy</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Stat label="WS Medio" value={todayData.avg_ws ? Math.round(todayData.avg_ws) : '—'} color={wsColor(todayData.avg_ws)} />
            <Stat label="RPE Medio" value={todayData.avg_rpe ?? '—'} color="text-orange-500" />
            <Stat label="sRPE Medio" value={todayData.avg_srpe ?? '—'} color="text-violet-500" />
            <Stat label="Resp. Wellness" value={todayData.responses_w ? `${todayData.responses_w}/${teamData?.total_players}` : '0'} />
          </div>
          {todayData.match_day_type && (
            <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
              <span className="badge-gray">{todayData.match_day_type}</span>
              <span className={colorBadge(todayData.color_day)}>{todayData.color_day}</span>
              <span className="badge-gray">{todayData.duration_minutes} min</span>
            </div>
          )}
        </div>
      ) : (
        <div className="card bg-slate-50 border border-dashed border-slate-200 text-center py-3">
          <p className="text-sm text-slate-400 font-medium">Sin datos para hoy aún</p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {DAYS_OPTIONS.map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all duration-150 ${
                days === d ? 'bg-red-500 text-white shadow-sm' : 'bg-white text-slate-500 border border-slate-200 hover:border-red-300'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>

        {availableWeeks.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm font-semibold text-slate-500">Semana de análisis</label>
            <select
              value={selectedWeekStart || weeklyReport?.week_start || ''}
              onChange={e => setSelectedWeekStart(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 outline-none focus:border-red-300"
            >
              {availableWeeks.map(week => (
                <option key={week.week_start} value={week.week_start}>
                  Semana {week.week_number} · {formatShortDate(week.week_start)} - {formatShortDate(week.week_end)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center text-slate-400 py-12 font-medium">Cargando...</div>
      ) : (
        <>
          <div className="card">
            <h2 className="font-bold text-slate-800 mb-0.5">Wellness Score del Equipo</h2>
            <p className="text-xs text-slate-400 mb-3">Promedio diario · Verde ≥75 · Amarillo ≥50 · Rojo &lt;50</p>
            <WSChart data={chartData} />
          </div>

          <div className="card">
            <h2 className="font-bold text-slate-800 mb-0.5">RPE Medio del Equipo</h2>
            <p className="text-xs text-slate-400 mb-3">Percepción subjetiva del esfuerzo (0–10)</p>
            <RPEChart data={chartData} />
          </div>

          <div className="card">
            <h2 className="font-bold text-slate-800 mb-0.5">sRPE Medio del Equipo</h2>
            <p className="text-xs text-slate-400 mb-3">RPE × minutos de sesión</p>
            <SRPEChart data={chartData} />
          </div>

          <div className="card">
            <h2 className="font-bold text-slate-800 mb-0.5">Asimilación de Carga — WS vs RPE</h2>
            <p className="text-xs text-slate-400 mb-3">Últimos 7 días · Cuadrantes basados en promedios</p>
            <ScatterPlot data={scatter?.scatter} avgWS={scatter?.avgWS} avgRPE={scatter?.avgRPE} />
          </div>

          {weeklyReport?.rows?.length > 0 && (
            <div className="card">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                  <h2 className="font-bold text-slate-800 mb-0.5">Reporte semanal de wellness y carga</h2>
                  <p className="text-xs text-slate-400">
                    Semana {weeklyReport.week_number} · {formatShortDate(weeklyReport.week_start)} - {formatShortDate(weeklyReport.week_end)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {false && (
                  <select
                    value={selectedWeekStart || weeklyReport.week_start}
                    onChange={e => setSelectedWeekStart(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-red-300"
                  >
                    {availableWeeks.map(week => (
                      <option key={week.week_start} value={week.week_start}>
                        Semana {week.week_number} · {formatShortDate(week.week_start)} - {formatShortDate(week.week_end)}
                      </option>
                    ))}
                  </select>
                  )}
                  <SummaryPill label="Equipo WS" value={weeklyReport.team?.wellness_ws} color={metricTone(weeklyReport.team?.wellness_ws, 'ws')} digits={0} />
                  <SummaryPill label="Equipo A/C WS" value={weeklyReport.team?.wellness_ac} color={metricTone(weeklyReport.team?.wellness_ac, 'ratio')} />
                  <SummaryPill label="Equipo RPE" value={weeklyReport.team?.load_rpe} color="text-orange-500" digits={0} />
                  <SummaryPill label="Equipo A/C sRPE" value={weeklyReport.team?.load_ac} color={metricTone(weeklyReport.team?.load_ac, 'ratio')} />
                </div>
              </div>

              <div className="max-h-[70vh] overflow-auto rounded-xl border border-slate-100">
                <table className="w-full min-w-[1080px] text-xs">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <ColumnHelp label="Jugador" help="Nombre del jugador. Puedes ordenar alfabéticamente pulsando aquí." sortKey="player_name" sortConfig={sortConfig} onSort={handleSort} align="left" rowSpan={2} />
                      <th className="sticky top-0 z-20 text-center py-2 text-emerald-700 font-bold bg-emerald-50" colSpan={5}>Wellness</th>
                      <th className="sticky top-0 z-20 text-center py-2 text-orange-600 font-bold bg-orange-50" colSpan={5}>Carga</th>
                    </tr>
                    <tr className="text-slate-400 border-b border-slate-100">
                      <ColumnHelp label="WS" help="Media del wellness score de la semana actual. Resume el estado medio del jugador esta semana." sortKey="wellness.ws" sortConfig={sortConfig} onSort={handleSort} />
                      <ColumnHelp label="A/C WS" help="Media WS semana actual dividida por la media de hasta las 3 semanas previas. Entre 0.8 y 1.3 suele ser la zona más estable." sortKey="wellness.ac" sortConfig={sortConfig} onSort={handleSort} />
                      <ColumnHelp label="Monot. WS" help="Media diaria de WS dividida por la desviación estándar diaria del WS semanal. Alto = semana muy plana." sortKey="wellness.monotony" sortConfig={sortConfig} onSort={handleSort} />
                      <ColumnHelp label="Stress WS" help="Suma semanal de WS por monotonía WS. Cuantifica el estrés acumulado de wellness." sortKey="wellness.stress" sortConfig={sortConfig} onSort={handleSort} />
                      <ColumnHelp label="Var. WS" help="Desviación estándar del WS diario semanal. Alto = más variación entre días." sortKey="wellness.variability" sortConfig={sortConfig} onSort={handleSort} />
                      <ColumnHelp label="RPE" help="Media del RPE de la semana actual. Resume la percepción media de esfuerzo." sortKey="load.rpe" sortConfig={sortConfig} onSort={handleSort} />
                      <ColumnHelp label="A/C sRPE" help="Media semanal de sRPE actual dividida por la media de hasta las 3 semanas previas. Sirve para controlar picos de carga." sortKey="load.ac" sortConfig={sortConfig} onSort={handleSort} />
                      <ColumnHelp label="Monot. sRPE" help="Media diaria de sRPE dividida por la desviación estándar diaria del sRPE semanal. Alto = carga muy uniforme." sortKey="load.monotony" sortConfig={sortConfig} onSort={handleSort} />
                      <ColumnHelp label="Stress sRPE" help="Suma semanal de sRPE por monotonía sRPE. Estima el estrés total de carga." sortKey="load.stress" sortConfig={sortConfig} onSort={handleSort} />
                      <ColumnHelp label="Var. sRPE" help="Desviación estándar del sRPE diario semanal. Alto = más variabilidad de carga." sortKey="load.variability" sortConfig={sortConfig} onSort={handleSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedWeeklyRows.map((row, index) => (
                      <tr key={row.player_id} className={`border-b border-slate-50 ${index % 2 ? 'bg-slate-50/50' : 'bg-white'}`}>
                        <td className={`sticky left-0 z-10 py-2 pr-3 font-semibold text-slate-700 whitespace-nowrap ${index % 2 ? 'bg-slate-50/95' : 'bg-white/95'} backdrop-blur-sm`}>
                          {row.player_name}
                        </td>
                        <td className={`text-center font-extrabold ${metricTone(row.wellness.ws, 'ws')}`}>{formatMetric(row.wellness.ws, 0)}</td>
                        <td className={`text-center font-bold ${metricTone(row.wellness.ac, 'ratio')}`}>{formatMetric(row.wellness.ac)}</td>
                        <td className={`text-center font-bold ${metricTone(row.wellness.monotony, 'monotony')}`}>{formatMetric(row.wellness.monotony)}</td>
                        <td className={`text-center font-bold ${metricTone(row.wellness.stress, 'stress')}`}>{formatMetric(row.wellness.stress, 0)}</td>
                        <td className="text-center text-slate-600 font-semibold">{formatMetric(row.wellness.variability)}</td>
                        <td className="text-center font-extrabold text-orange-500">{formatMetric(row.load.rpe, 0)}</td>
                        <td className={`text-center font-bold ${metricTone(row.load.ac, 'ratio')}`}>{formatMetric(row.load.ac)}</td>
                        <td className={`text-center font-bold ${metricTone(row.load.monotony, 'monotony')}`}>{formatMetric(row.load.monotony)}</td>
                        <td className={`text-center font-bold ${metricTone(row.load.stress, 'stress')}`}>{formatMetric(row.load.stress, 0)}</td>
                        <td className="text-center text-slate-600 font-semibold">{formatMetric(row.load.variability)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {chartData.length > 0 && (
            <div className="card">
              <h2 className="font-bold text-slate-800 mb-3">Detalle Wellness — Últimas sesiones</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-100">
                      <th className="text-left py-2 pr-3 font-semibold">Fecha</th>
                      <th className="text-left pr-2 font-semibold">MD</th>
                      <th className="text-center font-semibold">WS</th>
                      <th className="text-center font-semibold">Fat.</th>
                      <th className="text-center font-semibold">Sueño</th>
                      <th className="text-center font-semibold">Estrés</th>
                      <th className="text-center font-semibold">Motiv.</th>
                      <th className="text-center font-semibold">Daño</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...chartData].reverse().slice(0, 10).map((d, i) => (
                      <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                        <td className="py-2 pr-3 text-slate-500 font-medium">{d.label}</td>
                        <td className="pr-2">
                          {d.match_day_type && <span className="badge-gray">{d.match_day_type}</span>}
                        </td>
                        <td className={`text-center font-extrabold ${wsColor(d.avg_ws)}`}>{d.avg_ws ?? '—'}</td>
                        <td className="text-center text-slate-600">{d.avg_fatiga?.toFixed(1) ?? '—'}</td>
                        <td className="text-center text-slate-600">{d.avg_sueno?.toFixed(1) ?? '—'}</td>
                        <td className="text-center text-slate-600">{d.avg_estres?.toFixed(1) ?? '—'}</td>
                        <td className="text-center text-slate-600">{d.avg_motivacion?.toFixed(1) ?? '—'}</td>
                        <td className="text-center text-slate-600">{d.avg_dano?.toFixed(1) ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, color = 'text-slate-800' }) {
  return (
    <div>
      <p className="text-xs text-slate-400 font-semibold">{label}</p>
      <p className={`text-2xl font-extrabold ${color}`}>{value}</p>
    </div>
  );
}

function SummaryPill({ label, value, color, digits = 2 }) {
  return (
    <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5">
      <span className="text-slate-400 font-semibold mr-1">{label}</span>
      <span className={`font-extrabold ${color}`}>{formatMetric(value, digits)}</span>
    </div>
  );
}

function ColumnHelp({ label, help, sortKey, sortConfig, onSort, align = 'center', rowSpan }) {
  const isActive = sortConfig?.key === sortKey;
  const arrow = !sortKey ? '' : isActive ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕';
  const stickyTop = rowSpan ? 'top-0' : 'top-[37px]';
  const stickyLeft = label === 'Jugador' ? 'left-0 z-30' : 'z-20';
  const bgClass = label === 'Jugador' ? 'bg-white' : 'bg-white/95';

  return (
    <th className={`sticky ${stickyTop} ${stickyLeft} ${bgClass} py-2 px-1 font-semibold backdrop-blur-sm ${align === 'left' ? 'text-left' : 'text-center'}`} rowSpan={rowSpan}>
      <div className={`group relative inline-flex items-center gap-1 ${align === 'left' ? 'justify-start' : 'justify-center'}`}>
        <button
          type="button"
          onClick={() => sortKey && onSort?.(sortKey)}
          className={`inline-flex items-center gap-1 rounded-md transition-colors ${sortKey ? 'cursor-pointer hover:text-slate-700' : 'cursor-help'} ${isActive ? 'text-slate-700' : ''}`}
        >
          <span>{label}</span>
          {sortKey && <span className={`text-[10px] ${isActive ? 'text-red-500' : 'text-slate-300'}`}>{arrow}</span>}
        </button>
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-100 text-[10px] text-slate-500 cursor-help">i</span>
        <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-52 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 text-left text-[11px] font-medium leading-4 text-slate-500 shadow-lg group-hover:block">
          {help}
        </div>
      </div>
    </th>
  );
}

function formatMetric(value, digits = 2) {
  if (value == null) return '—';
  if (digits === 0) return Math.round(value);
  return Number(value).toFixed(digits);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatShortDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

function getSortValue(row, key) {
  return key.split('.').reduce((value, part) => value?.[part], row);
}

function compareValues(a, b, direction) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;

  if (typeof a === 'string' && typeof b === 'string') {
    return direction === 'asc' ? a.localeCompare(b, 'es') : b.localeCompare(a, 'es');
  }

  return direction === 'asc' ? a - b : b - a;
}
