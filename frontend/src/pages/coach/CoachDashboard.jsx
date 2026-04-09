import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { addDays, differenceInCalendarDays, format, parseISO, subDays } from 'date-fns';
import api from '../../services/api';
import { WSChart, RPEChart, SRPEChart } from '../../components/charts/TeamTimelineChart';
import ScatterPlot from '../../components/charts/ScatterPlot';
import { averageExcludingZeros, formatAverage, getTodayISO } from '../../utils/metrics';

const DAYS_OPTIONS = [7, 14, 28];
const DEFAULT_TEAM_ID = 1;

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

function getMatchBadge(day) {
  return day?.relative_match_day || day?.match_day_type || null;
}

function toDateAtNoon(dateStr) {
  return new Date(`${dateStr}T12:00:00`);
}

function formatRelativeMatchDay(diff) {
  if (diff === 0) return 'MD';
  return diff > 0 ? `MD+${diff}` : `MD${diff}`;
}

function buildDateRange(startDate, endDate) {
  const dates = [];
  const current = toDateAtNoon(startDate);
  const end = toDateAtNoon(endDate);

  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

function isDateInRange(dateStr, range) {
  return Boolean(range?.start && range?.end && dateStr >= range.start && dateStr <= range.end);
}

function getRange(filterMode, days, selectedWeekStart, weeklyReport) {
  const today = getTodayISO();

  if (filterMode === 'week') {
    const start = selectedWeekStart || weeklyReport?.week_start;
    if (!start) return { start: today, end: today };

    const end = weeklyReport?.week_end || format(addDays(parseISO(start), 6), 'yyyy-MM-dd');
    return { start, end };
  }

  return {
    start: format(subDays(parseISO(today), days - 1), 'yyyy-MM-dd'),
    end: today,
  };
}

function fillTimelineGaps(timeline, range) {
  const byDate = new Map((timeline || []).map((row) => [row.date, row]));

  return buildDateRange(range.start, range.end).map((date) => {
    const existing = byDate.get(date);
    if (existing) {
      return {
        ...existing,
        avg_ws: existing.avg_ws ?? 0,
        avg_rpe: existing.avg_rpe ?? 0,
        avg_srpe: existing.avg_srpe ?? 0,
      };
    }

    return {
      date,
      avg_ws: 0,
      avg_rpe: 0,
      avg_srpe: 0,
      avg_fatiga: null,
      avg_sueno: null,
      avg_estres: null,
      avg_motivacion: null,
      avg_dano: null,
      responses_w: 0,
      responses_r: 0,
      match_day_type: null,
      color_day: null,
      duration_minutes: null,
      relative_match_day: null,
      isMatchDay: false,
    };
  });
}

function applyFixtureContext(timeline, nearestFixture) {
  if (!nearestFixture?.match_date) return timeline;

  const matchDate = parseISO(nearestFixture.match_date);

  return timeline.map((day) => {
    const diff = differenceInCalendarDays(parseISO(day.date), matchDate);
    return {
      ...day,
      relative_match_day: formatRelativeMatchDay(diff),
      isMatchDay: diff === 0,
    };
  });
}

export default function CoachDashboard() {
  const [days, setDays] = useState(14);
  const [filterMode, setFilterMode] = useState('days');
  const [selectedWeekStart, setSelectedWeekStart] = useState('');
  const [viewContext, setViewContext] = useState('period');
  const [teamData, setTeamData] = useState(null);
  const [todaySummaryData, setTodaySummaryData] = useState(null);
  const [nearestFixture, setNearestFixture] = useState(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [loadingTodaySummary, setLoadingTodaySummary] = useState(true);
  const [loadingFixture, setLoadingFixture] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: 'load.stress', direction: 'desc' });
  const latestRequestRef = useRef(0);
  const teamId = DEFAULT_TEAM_ID;

  useEffect(() => {
    let cancelled = false;
    const today = getTodayISO();

    setLoadingFixture(true);
    api.get('/fixtures/nearest', { params: { date: today, teamId } })
      .then((response) => {
        if (!cancelled) setNearestFixture(response.data?.fixture || null);
      })
      .catch(() => {
        if (!cancelled) setNearestFixture(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingFixture(false);
      });

    return () => {
      cancelled = true;
    };
  }, [teamId]);

  useEffect(() => {
    let cancelled = false;

    setLoadingTodaySummary(true);
    api.get('/dashboard/team', { params: { days: 0, teamId } })
      .then((response) => {
        if (!cancelled) setTodaySummaryData(response.data);
      })
      .catch(() => {
        if (!cancelled) setTodaySummaryData(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingTodaySummary(false);
      });

    return () => {
      cancelled = true;
    };
  }, [teamId]);

  useEffect(() => {
    const requestId = latestRequestRef.current + 1;
    latestRequestRef.current = requestId;
    setLoadingDashboard(true);

    const params = filterMode === 'week' && selectedWeekStart
      ? {
          week_start: selectedWeekStart,
          week_end: format(addDays(parseISO(selectedWeekStart), 6), 'yyyy-MM-dd'),
          teamId,
        }
      : { days, teamId };

    api.get('/dashboard/team', { params })
      .then((response) => {
        if (requestId !== latestRequestRef.current) return;
        console.log('Dashboard metrics response', response.data);
        setTeamData(response.data);
      })
      .finally(() => {
        if (requestId === latestRequestRef.current) {
          setLoadingDashboard(false);
        }
      });
  }, [days, selectedWeekStart, filterMode, teamId]);

  const weeklyReport = teamData?.weekly_report;
  const availableWeeks = teamData?.available_weeks || [];
  const range = getRange(filterMode, days, selectedWeekStart, weeklyReport);
  const today = getTodayISO();
  const completedTimeline = fillTimelineGaps(teamData?.timeline || [], range);
  const timelineWithContext = isDateInRange(today, range)
    ? applyFixtureContext(completedTimeline, nearestFixture)
    : completedTimeline;
  const chartData = timelineWithContext.map((day) => ({
    ...day,
    label: formatDate(day.date),
    axisLabel: formatAxisLabel(day.date, getMatchBadge(day)),
  }));
  const matchReferenceLabel = chartData.find((day) => day.isMatchDay)?.axisLabel || null;
  const scatter = teamData?.scatter;
  const sessions = teamData?.sessions || [];
  const loading = loadingDashboard || loadingFixture || loadingTodaySummary;
  const sortedWeeklyRows = weeklyReport?.rows
    ? [...weeklyReport.rows].sort((a, b) => compareValues(getSortValue(a, sortConfig.key), getSortValue(b, sortConfig.key), sortConfig.direction))
    : [];
  const rawTimeline = teamData?.timeline || [];
  const summaryDate = isDateInRange(today, range)
    ? today
    : (rawTimeline[rawTimeline.length - 1]?.date || timelineWithContext[timelineWithContext.length - 1]?.date || null);
  const todayData = summaryDate
    ? timelineWithContext.find((day) => day.date === summaryDate) || null
    : null;
  const todaySummary = (() => {
    const timeline = todaySummaryData?.timeline || [];
    return timeline.find((day) => day.date === today) || timeline[timeline.length - 1] || null;
  })();
  const periodSummary = buildPeriodSummary(teamData?.timeline || [], sessions, teamData?.total_players, range);
  const summaryCard = viewContext === 'today'
    ? {
        title: 'RESUMEN DE HOY',
        wsLabel: 'Promedio Hoy',
        rpeLabel: 'RPE Hoy',
        srpeLabel: 'sRPE Hoy',
        participationLabel: 'Respuestas Hoy',
        wsValue: formatAverage(todaySummary?.avg_ws),
        rpeValue: formatAverage(todaySummary?.avg_rpe),
        srpeValue: formatAverage(todaySummary?.avg_srpe),
        participationValue: todaySummary?.responses_w ? `${todaySummary.responses_w}/${teamData?.total_players || 0}` : '0',
        wsTone: wsColor(todaySummary?.avg_ws),
        badge: getMatchBadge(todaySummary),
        colorDay: todaySummary?.color_day,
        minutes: todaySummary?.duration_minutes,
      }
    : {
        title: 'RESUMEN DEL PERIODO',
        wsLabel: 'Promedio Semanal',
        rpeLabel: 'RPE Medio',
        srpeLabel: 'sRPE Medio',
        participationLabel: 'Participacion Semanal',
        wsValue: formatAverage(periodSummary.avg_ws),
        rpeValue: formatAverage(periodSummary.avg_rpe),
        srpeValue: formatAverage(periodSummary.avg_srpe),
        participationValue: periodSummary.participation,
        wsTone: wsColor(periodSummary.avg_ws),
        trainedDays: periodSummary.trainedDays,
        totalDays: periodSummary.totalDays,
      };

  function handleSort(key) {
    setSortConfig((current) => (
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: key === 'player_name' ? 'asc' : 'desc' }
    ));
  }

  return (
    <div className="pb-20 sm:pb-0 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">Dashboard</h1>
          <p className="text-slate-400 text-sm font-medium">DH Elite · {teamData?.total_players || '—'} jugadores</p>
        </div>
        <Link to="/coach/session/new" className="btn-primary text-sm py-2 px-4">+ Sesion</Link>
      </div>

      {(viewContext === 'today' ? todaySummary : todayData) ? (
        <div className="card border-l-4 border-l-red-400">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-3 font-bold">{summaryCard.title}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Stat label={summaryCard.wsLabel} value={summaryCard.wsValue} color={summaryCard.wsTone} />
            <Stat label={summaryCard.rpeLabel} value={summaryCard.rpeValue} color="text-orange-500" />
            <Stat label={summaryCard.srpeLabel} value={summaryCard.srpeValue} color="text-violet-500" />
            <Stat label={summaryCard.participationLabel} value={summaryCard.participationValue} />
          </div>
          {viewContext === 'today' && (summaryCard.badge || summaryCard.colorDay || summaryCard.minutes) && (
            <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
              {summaryCard.badge && <span className="badge-gray">{summaryCard.badge}</span>}
              {summaryCard.colorDay && <span className={colorBadge(summaryCard.colorDay)}>{summaryCard.colorDay}</span>}
              {summaryCard.minutes && <span className="badge-gray">{summaryCard.minutes} min</span>}
            </div>
          )}
          {viewContext === 'period' && (
            <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
              <span className="badge-gray">Dias entrenados: {summaryCard.trainedDays}/{summaryCard.totalDays}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="card bg-slate-50 border border-dashed border-slate-200 text-center py-3">
          <p className="text-sm text-slate-400 font-medium">Sin datos para hoy aun</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          <button
            onClick={() => setViewContext('today')}
            className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all duration-150 ${
              viewContext === 'today' ? 'bg-red-500 text-white shadow-sm' : 'bg-white text-slate-500 border border-slate-200 hover:border-red-300'
            }`}
          >
            HOY
          </button>
          {DAYS_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => {
                setViewContext('period');
                setFilterMode('days');
                setDays(d);
              }}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all duration-150 ${
                filterMode === 'days' && days === d ? 'bg-red-500 text-white shadow-sm' : 'bg-white text-slate-500 border border-slate-200 hover:border-red-300'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>

        {availableWeeks.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm font-semibold text-slate-500">Semana de analisis</label>
            <select
              value={selectedWeekStart || weeklyReport?.week_start || ''}
              onChange={(e) => {
                setViewContext('period');
                setFilterMode('week');
                setSelectedWeekStart(e.target.value);
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 outline-none focus:border-red-300"
            >
              {availableWeeks.map((week) => (
                <option key={week.week_start} value={week.week_start}>
                  Semana {week.week_number} · {formatShortDate(week.week_start)} - {formatShortDate(week.week_end)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="card py-12">
          <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-red-500" />
            <p className="text-sm font-medium">Cargando dashboard y calendario...</p>
          </div>
        </div>
      ) : (
        <>
          {filterMode === 'week' && weeklyReport && (
            <div className="card border-l-4 border-l-orange-400">
              <p className="text-xs text-slate-400 uppercase tracking-wider mb-2 font-bold">Semana en analisis</p>
              <p className="text-sm font-bold text-slate-800">Semana {weeklyReport.week_number} · {formatShortDate(weeklyReport.week_start)} - {formatShortDate(weeklyReport.week_end)}</p>
              <p className="text-xs text-slate-400 mt-1">Todo el dashboard esta filtrado por esta semana.</p>
            </div>
          )}

          <div className="card">
            <h2 className="font-bold text-slate-800 mb-0.5">Wellness Score del Equipo</h2>
            <p className="text-xs text-slate-400 mb-3">Promedio diario · Verde ≥75 · Amarillo ≥50 · Rojo &lt;50</p>
            <WSChart data={chartData} matchReferenceLabel={matchReferenceLabel} />
          </div>

          <div className="card">
            <h2 className="font-bold text-slate-800 mb-0.5">RPE Medio del Equipo</h2>
            <p className="text-xs text-slate-400 mb-3">Percepcion subjetiva del esfuerzo (0-10)</p>
            <RPEChart data={chartData} matchReferenceLabel={matchReferenceLabel} />
          </div>

          <div className="card">
            <h2 className="font-bold text-slate-800 mb-0.5">sRPE Medio del Equipo</h2>
            <p className="text-xs text-slate-400 mb-3">RPE × minutos de sesion</p>
            <SRPEChart data={chartData} matchReferenceLabel={matchReferenceLabel} />
          </div>

          <div className="card">
            <h2 className="font-bold text-slate-800 mb-0.5">Asimilacion de Carga — WS vs RPE</h2>
            <p className="text-xs text-slate-400 mb-3">{filterMode === 'week' ? 'Semana seleccionada · Cuadrantes basados en promedios' : `Ultimos ${days} dias · Cuadrantes basados en promedios`}</p>
            <ScatterPlot data={scatter?.scatter} avgWS={scatter?.avgWS} avgRPE={scatter?.avgRPE} />
          </div>

          <div className="card">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
              <div>
                <h2 className="font-bold text-slate-800 mb-0.5">Sesiones del periodo</h2>
                <p className="text-xs text-slate-400">
                  {filterMode === 'week'
                    ? `Semana ${weeklyReport?.week_number} · ${formatShortDate(weeklyReport?.week_start)} - ${formatShortDate(weeklyReport?.week_end)}`
                    : `Ultimos ${days} dias`}
                </p>
              </div>
              <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs">
                <span className="text-slate-400 font-semibold mr-1">Total</span>
                <span className="font-extrabold text-slate-700">{sessions.length}</span>
              </div>
            </div>

            {sessions.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full min-w-[760px] text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400">
                      <th className="text-left py-2 px-3 font-semibold">Fecha</th>
                      <th className="text-left px-3 font-semibold">Tipo</th>
                      <th className="text-left px-3 font-semibold">Color</th>
                      <th className="text-center px-3 font-semibold">Partido</th>
                      <th className="text-center px-3 font-semibold">Duracion</th>
                      <th className="text-left px-3 font-semibold">Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((session) => (
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm font-medium text-slate-400">
                No hay sesiones guardadas en este periodo.
              </div>
            )}
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
                  <SummaryPill label="Equipo WS" value={weeklyReport.team?.wellness_ws} color={metricTone(weeklyReport.team?.wellness_ws, 'ws')} digits={1} />
                  <SummaryPill label="Equipo A/C WS" value={weeklyReport.team?.wellness_ac} color={metricTone(weeklyReport.team?.wellness_ac, 'ratio')} />
                  <SummaryPill label="Equipo RPE" value={weeklyReport.team?.load_rpe} color="text-orange-500" digits={1} />
                  <SummaryPill label="Equipo A/C sRPE" value={weeklyReport.team?.load_ac} color={metricTone(weeklyReport.team?.load_ac, 'ratio')} />
                </div>
              </div>

              <div className="max-h-[70vh] overflow-auto rounded-xl border border-slate-100">
                <table className="w-full min-w-[1080px] text-xs">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <ColumnHelp label="Jugador" help="Nombre del jugador. Puedes ordenar alfabeticamente pulsando aqui." sortKey="player_name" sortConfig={sortConfig} onSort={handleSort} align="left" rowSpan={2} />
                      <th className="sticky top-0 z-20 text-center py-2 text-emerald-700 font-bold bg-emerald-50" colSpan={5}>Wellness</th>
                      <th className="sticky top-0 z-20 text-center py-2 text-orange-600 font-bold bg-orange-50" colSpan={5}>Carga</th>
                    </tr>
                    <tr className="text-slate-400 border-b border-slate-100">
                      <ColumnHelp label="WS" help="Media del wellness score de la semana actual. Resume el estado medio del jugador esta semana." sortKey="wellness.ws" sortConfig={sortConfig} onSort={handleSort} />
                      <ColumnHelp label="A/C WS" help="Media WS semana actual dividida por la media de hasta las 3 semanas previas. Entre 0.8 y 1.3 suele ser la zona mas estable." sortKey="wellness.ac" sortConfig={sortConfig} onSort={handleSort} />
                      <ColumnHelp label="Monot. WS" help="Media diaria de WS dividida por la desviacion estandar diaria del WS semanal. Alto = semana muy plana." sortKey="wellness.monotony" sortConfig={sortConfig} onSort={handleSort} />
                      <ColumnHelp label="Stress WS" help="Suma semanal de WS por monotonia WS. Cuantifica el estres acumulado de wellness." sortKey="wellness.stress" sortConfig={sortConfig} onSort={handleSort} />
                      <ColumnHelp label="Var. WS" help="Desviacion estandar del WS diario semanal. Alto = mas variacion entre dias." sortKey="wellness.variability" sortConfig={sortConfig} onSort={handleSort} />
                      <ColumnHelp label="RPE" help="Media del RPE de la semana actual. Resume la percepcion media de esfuerzo." sortKey="load.rpe" sortConfig={sortConfig} onSort={handleSort} />
                      <ColumnHelp label="A/C sRPE" help="Media semanal de sRPE actual dividida por la media de hasta las 3 semanas previas. Sirve para controlar picos de carga." sortKey="load.ac" sortConfig={sortConfig} onSort={handleSort} />
                      <ColumnHelp label="Monot. sRPE" help="Media diaria de sRPE dividida por la desviacion estandar diaria del sRPE semanal. Alto = carga muy uniforme." sortKey="load.monotony" sortConfig={sortConfig} onSort={handleSort} />
                      <ColumnHelp label="Stress sRPE" help="Suma semanal de sRPE por monotonia sRPE. Estima el estres total de carga." sortKey="load.stress" sortConfig={sortConfig} onSort={handleSort} />
                      <ColumnHelp label="Var. sRPE" help="Desviacion estandar del sRPE diario semanal. Alto = mas variabilidad de carga." sortKey="load.variability" sortConfig={sortConfig} onSort={handleSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedWeeklyRows.map((row, index) => (
                      <tr key={row.player_id} className={`border-b border-slate-50 ${index % 2 ? 'bg-slate-50/50' : 'bg-white'}`}>
                        <td className={`sticky left-0 z-10 py-2 pr-3 font-semibold text-slate-700 whitespace-nowrap ${index % 2 ? 'bg-slate-50/95' : 'bg-white/95'} backdrop-blur-sm`}>
                          {row.player_name}
                        </td>
                        <td className={`text-center font-extrabold ${metricTone(row.wellness.ws, 'ws')}`}>{formatMetric(row.wellness.ws, 1)}</td>
                        <td className={`text-center font-bold ${metricTone(row.wellness.ac, 'ratio')}`}>{formatMetric(row.wellness.ac)}</td>
                        <td className={`text-center font-bold ${metricTone(row.wellness.monotony, 'monotony')}`}>{formatMetric(row.wellness.monotony)}</td>
                        <td className={`text-center font-bold ${metricTone(row.wellness.stress, 'stress')}`}>{formatMetric(row.wellness.stress, 0)}</td>
                        <td className="text-center text-slate-600 font-semibold">{formatMetric(row.wellness.variability)}</td>
                        <td className="text-center font-extrabold text-orange-500">{formatMetric(row.load.rpe, 1)}</td>
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
              <h2 className="font-bold text-slate-800 mb-3">Detalle Wellness — Ultimas sesiones</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-100">
                      <th className="text-left py-2 pr-3 font-semibold">Fecha</th>
                      <th className="text-left pr-2 font-semibold">MD</th>
                      <th className="text-center font-semibold">WS</th>
                      <th className="text-center font-semibold">Fat.</th>
                      <th className="text-center font-semibold">Sueno</th>
                      <th className="text-center font-semibold">Estres</th>
                      <th className="text-center font-semibold">Motiv.</th>
                      <th className="text-center font-semibold">Dano</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...chartData].reverse().slice(0, 10).map((day) => (
                      <tr key={day.date} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                        <td className="py-2 pr-3 text-slate-500 font-medium">{day.label}</td>
                        <td className="pr-2">
                          {getMatchBadge(day) && <span className="badge-gray">{getMatchBadge(day)}</span>}
                        </td>
                        <td className={`text-center font-extrabold ${wsColor(day.avg_ws)}`}>{day.avg_ws ?? '—'}</td>
                        <td className="text-center text-slate-600">{day.avg_fatiga?.toFixed(1) ?? '—'}</td>
                        <td className="text-center text-slate-600">{day.avg_sueno?.toFixed(1) ?? '—'}</td>
                        <td className="text-center text-slate-600">{day.avg_estres?.toFixed(1) ?? '—'}</td>
                        <td className="text-center text-slate-600">{day.avg_motivacion?.toFixed(1) ?? '—'}</td>
                        <td className="text-center text-slate-600">{day.avg_dano?.toFixed(1) ?? '—'}</td>
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
  const date = new Date(`${dateStr}T12:00:00`);
  return date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatWeekday(dateStr) {
  if (!dateStr) return '';
  const date = new Date(`${dateStr}T12:00:00`);
  const weekday = date.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '');
  return weekday.charAt(0).toUpperCase() + weekday.slice(1);
}

function formatAxisLabel(dateStr, matchBadge) {
  if (!dateStr) return '';
  const date = new Date(`${dateStr}T12:00:00`);
  const dayMonth = date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
  return `${formatWeekday(dateStr)} ${dayMonth}${matchBadge ? ` (${matchBadge})` : ''}`;
}

function formatShortDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(`${dateStr}T12:00:00`);
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
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

function buildPeriodSummary(timeline, sessions, totalPlayers, range) {
  const rawByDate = new Map((timeline || []).map((day) => [day.date, day]));
  const rangeDates = buildDateRange(range.start, range.end);
  const rangeDays = rangeDates.map((date) => rawByDate.get(date)).filter(Boolean);
  const trainedDays = new Set((sessions || []).map((session) => session.date).filter((date) => isDateInRange(date, range))).size;

  return {
    avg_ws: averageExcludingZeros(rangeDays.map((day) => day.avg_ws)),
    avg_rpe: averageExcludingZeros(rangeDays.map((day) => day.avg_rpe)),
    avg_srpe: averageExcludingZeros(rangeDays.map((day) => day.avg_srpe)),
    participation: (() => {
      const avgResponses = averageExcludingZeros(rangeDays.map((day) => day.responses_w));
      return avgResponses != null ? `${Math.round(avgResponses)}/${totalPlayers || 0}` : '—';
    })(),
    trainedDays,
    totalDays: rangeDates.length,
  };
}
