import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import api from '../../services/api';
import ScatterPlot from '../../components/charts/ScatterPlot';
import { averageExcludingZeros, formatAverage, getInclusiveStartDate, getTodayISO } from '../../utils/metrics';

const GRID = '#F1F5F9';
const TICK = '#94A3B8';
const TT  = { backgroundColor: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, fontSize: 11, color: '#1E293B', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' };
const AVERAGE_WEEK_OPTIONS = [1, 2, 4, 8];

const SENSACION_LABELS = {
  muy_bien: { label: 'Muy buenas sensaciones', color: 'text-emerald-600' },
  bien:     { label: 'Buenas sensaciones',     color: 'text-lime-600' },
  normal:   { label: 'Normal',                  color: 'text-amber-600' },
  mal:      { label: 'Malas sensaciones',       color: 'text-orange-600' },
  muy_mal:  { label: 'Muy malas sensaciones',   color: 'text-red-600' },
};
const ENFERMEDAD_LABELS = {
  no: 'Sin enfermedad', resfriado: 'Resfriado/Catarro',
  gripe: 'Gripe', digestivo: 'Prob. digestivos', otros: 'Otros',
};

function MetricCard({ label, value, unit, status, description }) {
  const styles = {
    danger:  'border-l-4 border-l-red-400 bg-red-50',
    warning: 'border-l-4 border-l-amber-400 bg-amber-50',
    good:    'border-l-4 border-l-emerald-400 bg-emerald-50',
    neutral: 'border border-slate-100 bg-white'
  };
  const valueColors = { danger: 'text-red-600', warning: 'text-amber-600', good: 'text-emerald-600', neutral: 'text-slate-800' };

  return (
    <div className={`rounded-2xl p-4 shadow-sm ${styles[status] || styles.neutral}`}>
      <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">{label}</p>
      <p className={`text-3xl font-extrabold mt-1 ${valueColors[status] || 'text-slate-800'}`}>
        {value ?? '—'}{unit && value != null ? <span className="text-sm font-normal text-slate-400 ml-1">{unit}</span> : ''}
      </p>
      {description && <p className="text-xs text-slate-400 mt-1">{description}</p>}
    </div>
  );
}

function acStatus(ac) {
  if (!ac) return 'neutral';
  if (ac > 1.3) return 'danger';
  if (ac >= 0.8) return 'good';
  return 'warning';
}
function stressStatus(s) {
  if (!s) return 'neutral';
  if (s > 8000) return 'danger';
  if (s >= 2000) return 'good';
  return 'warning';
}
function monotonyStatus(m) {
  if (!m) return 'neutral';
  if (m > 3.5) return 'danger';
  if (m >= 2.5) return 'warning';
  return 'good';
}

function periodAvg(rows, field, days, endDate = getTodayISO()) {
  const since = getInclusiveStartDate(days, endDate);
  const vals = rows
    .filter((row) => row.date >= since && row.date <= endDate)
    .map((row) => row[field]);

  return averageExcludingZeros(vals);
}

function WellnessObservaciones({ w }) {
  const molestias = w.molestias_zonas ? (() => { try { return JSON.parse(w.molestias_zonas); } catch { return []; } })() : [];
  const sensacion  = w.sensacion_proximo ? SENSACION_LABELS[w.sensacion_proximo] : null;
  const enfermedad = w.enfermedad && w.enfermedad !== 'no' ? ENFERMEDAD_LABELS[w.enfermedad] : null;
  const hasData    = molestias.length > 0 || enfermedad || sensacion || w.entrenamiento_previo != null || w.otros_comentarios || w.observaciones;

  if (!hasData) return null;

  return (
    <div className="space-y-1.5 border-t border-slate-100 pt-2 mt-1">
      {molestias.length > 0 && (
        <div>
          <p className="text-xs text-slate-400 mb-1 font-semibold">Molestias</p>
          <div className="flex flex-wrap gap-1">
            {molestias.map(z => (
              <span key={z} className="px-2 py-0.5 rounded-md bg-orange-100 text-orange-600 text-xs font-semibold">{z}</span>
            ))}
          </div>
        </div>
      )}
      {enfermedad && (
        <p className="text-xs"><span className="text-slate-400">Enfermedad: </span><span className="text-red-600 font-bold">{enfermedad}</span></p>
      )}
      {sensacion && (
        <p className="text-xs"><span className="text-slate-400">Próximo entreno: </span><span className={`font-bold ${sensacion.color}`}>{sensacion.label}</span></p>
      )}
      {w.entrenamiento_previo != null && (
        <p className="text-xs"><span className="text-slate-400">Entreno previo: </span><span className={`font-bold ${w.entrenamiento_previo ? 'text-amber-600' : 'text-emerald-600'}`}>{w.entrenamiento_previo ? 'Sí' : 'No'}</span></p>
      )}
      {(w.otros_comentarios || w.observaciones) && (
        <p className="text-xs text-slate-400 italic">"{w.otros_comentarios || w.observaciones}"</p>
      )}
    </div>
  );
}

export default function PlayerDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [selectedDate, setSelectedDate] = useState('');
  const [averageWeeks, setAverageWeeks] = useState(4);

  useEffect(() => {
    api.get(`/dashboard/player/${id}`).then(r => setData(r.data)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-center text-slate-400 py-12 font-medium">Cargando...</div>;
  if (!data) return <div className="text-center text-red-500 py-12 font-medium">Jugador no encontrado</div>;

  const { player, wellness, rpe, metrics, scatter } = data;

  const wsChartData  = wellness.map(w => ({ label: formatDate(w.date), ws: Math.round(w.wellness_score), fatiga: w.fatiga, dano: w.dano_muscular, sueno: w.sueno_calidad }));
  const rpeChartData = rpe.map(r => ({ label: formatDate(r.date), rpe: r.rpe, srpe: r.srpe }));
  const combinedData = wellness.map(w => {
    const r = rpe.find(r => r.date === w.date);
    return { label: formatDate(w.date), date: w.date, ws: Math.round(w.wellness_score), rpe: r?.rpe ?? null };
  });

  const averageDays = averageWeeks * 7;
  const averageEndDate = getTodayISO();
  const averageSince = getInclusiveStartDate(averageDays, averageEndDate);
  const wsAvg = periodAvg(wellness, 'wellness_score', averageDays, averageEndDate);
  const rpeAvg = periodAvg(rpe, 'rpe', averageDays, averageEndDate);
  const srpeAvg = periodAvg(rpe, 'srpe', averageDays, averageEndDate);
  const combinedDataFiltered = combinedData.filter((day) => day.date >= averageSince && day.date <= averageEndDate);

  const dayWellness = selectedDate ? wellness.find(w => w.date === selectedDate) : null;
  const dayRPE      = selectedDate ? rpe.find(r => r.date === selectedDate) : null;
  const minDate     = wellness.length ? wellness[0].date : undefined;
  const maxDate     = new Date().toISOString().split('T')[0];

  const TABS = ['overview', 'wellness', 'carga', 'asimilación'];

  return (
    <div className="pb-20 sm:pb-0 space-y-4">
      {/* Header */}
      <Link to="/coach/players" className="inline-flex items-center text-slate-400 hover:text-slate-700 text-sm font-semibold transition-colors">
        ← Volver
      </Link>

      <div className="bg-gradient-to-r from-slate-800 to-slate-700 rounded-2xl p-5 text-white">
        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">DH Élite</p>
        <h1 className="text-2xl font-extrabold mt-1">{player.name}</h1>
        <p className="text-slate-400 text-sm mt-0.5">Datos de los últimos 60 días</p>
      </div>

      {/* Date picker */}
      <div className="card">
        <div className="flex items-center gap-3 flex-wrap">
          <p className="text-sm font-bold text-slate-700">Ver día exacto</p>
          <input
            type="date"
            value={selectedDate}
            min={minDate}
            max={maxDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:border-red-400"
          />
          <button
            type="button"
            onClick={() => setSelectedDate(maxDate)}
            className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 font-semibold transition-colors"
          >
            Hoy
          </button>
          {selectedDate && (
            <button onClick={() => setSelectedDate('')} className="text-xs text-slate-400 hover:text-slate-700 font-semibold transition-colors">
              ✕ Limpiar
            </button>
          )}
        </div>

        {selectedDate && (
          (dayWellness || dayRPE) ? (
            <div className="border-t border-slate-100 pt-3 mt-3 space-y-3">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              <div className="grid grid-cols-2 gap-3">
                {dayWellness && (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-400 font-bold uppercase">Wellness</p>
                    <div className="grid grid-cols-2 gap-1.5 text-xs">
                      {[
                        { label: 'WS', value: Math.round(dayWellness.wellness_score), color: wsScoreColor(dayWellness.wellness_score), bg: 'bg-slate-50' },
                        { label: 'Fatiga', value: dayWellness.fatiga, color: '#EF4444', bg: 'bg-red-50' },
                        { label: 'Sueño', value: dayWellness.sueno_calidad, color: '#8B5CF6', bg: 'bg-violet-50' },
                        { label: 'Estrés', value: dayWellness.estres, color: '#F59E0B', bg: 'bg-amber-50' },
                        { label: 'Motiv.', value: dayWellness.motivacion, color: '#10B981', bg: 'bg-emerald-50' },
                        { label: 'Daño', value: dayWellness.dano_muscular, color: '#F97316', bg: 'bg-orange-50' },
                      ].map(item => (
                        <div key={item.label} className={`${item.bg} rounded-xl p-2 text-center`}>
                          <p className="text-slate-400 text-xs">{item.label}</p>
                          <p className="text-lg font-extrabold" style={{ color: item.color }}>{item.value}</p>
                        </div>
                      ))}
                    </div>
                    <WellnessObservaciones w={dayWellness} />
                  </div>
                )}
                {dayRPE && (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-400 font-bold uppercase">Carga</p>
                    <div className="space-y-1.5">
                      <div className="bg-orange-50 rounded-xl p-3 text-center">
                        <p className="text-slate-400 text-xs">RPE</p>
                        <p className="text-2xl font-extrabold text-orange-500">{dayRPE.rpe}</p>
                      </div>
                      <div className="bg-violet-50 rounded-xl p-3 text-center">
                        <p className="text-slate-400 text-xs">sRPE</p>
                        <p className="text-2xl font-extrabold text-violet-500">{dayRPE.srpe}</p>
                      </div>
                      {dayRPE.match_day_type && (
                        <div className="bg-slate-50 rounded-xl p-2 text-center">
                          <p className="text-slate-400 text-xs">Jornada</p>
                          <p className="text-sm font-bold text-slate-700">{dayRPE.match_day_type}</p>
                        </div>
                      )}
                    </div>
                    {dayRPE.comentarios && <p className="text-xs text-slate-400 italic">"{dayRPE.comentarios}"</p>}
                  </div>
                )}
                {!dayWellness && <p className="text-xs text-slate-300">Sin wellness</p>}
                {!dayRPE && <p className="text-xs text-slate-300">Sin carga</p>}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400 border-t border-slate-100 pt-3 mt-3 font-medium">Sin datos para esta fecha.</p>
          )
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-200 rounded-xl p-1">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold capitalize transition-all duration-150 ${
              tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="A/C Ratio" value={metrics.ac} status={acStatus(metrics.ac)} description="> 1.3 riesgo · 0.8–1.3 ideal" />
            <MetricCard label="Monotonía" value={metrics.monotony} status={monotonyStatus(metrics.monotony)} description="> 3.5 riesgo · < 2.5 ideal" />
            <MetricCard label="Stress semana" value={metrics.stress ? metrics.stress.toLocaleString() : null} status={stressStatus(metrics.stress)} description="> 8000 sobrecarga" />
            <MetricCard label="Variabilidad" value={metrics.variability} status="neutral" description="Cuanto más alta mejor" />
          </div>

          {/* Period averages */}
          <div className="card">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <p className="text-sm font-bold text-slate-800">Medias por semanas</p>
              <div className="flex gap-2">
                {AVERAGE_WEEK_OPTIONS.map(weeks => (
                  <button
                    key={weeks}
                    type="button"
                    onClick={() => setAverageWeeks(weeks)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      averageWeeks === weeks ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {weeks} sem
                  </button>
                ))}
              </div>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-slate-100">
                  <th className="text-left py-2 font-semibold">Período</th>
                  <th className="text-center py-2 font-semibold">WS</th>
                  <th className="text-center py-2 font-semibold">RPE</th>
                  <th className="text-center py-2 font-semibold">sRPE</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-50">
                  <td className="py-2 text-slate-500 font-semibold">{averageWeeks} semana{averageWeeks > 1 ? 's' : ''}</td>
                  <td className="text-center py-2 font-extrabold" style={{ color: wsScoreColor(wsAvg) }}>
                    {formatAverage(wsAvg)}
                  </td>
                  <td className="text-center py-2 font-extrabold text-orange-500">{formatAverage(rpeAvg)}</td>
                  <td className="text-center py-2 font-extrabold text-violet-500">{formatAverage(srpeAvg)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="card">
            <p className="text-xs text-slate-400 font-semibold mb-2">Leyenda</p>
            <div className="space-y-1 text-xs text-slate-500">
              <p><span className="text-red-500 font-bold">A/C &gt; 1.3</span> → Riesgo alto de lesión</p>
              <p><span className="text-emerald-600 font-bold">0.8–1.3</span> → Zona ideal de carga</p>
              <p><span className="text-red-500 font-bold">Stress &gt; 8000</span> → Sobrecarga · <span className="text-emerald-600 font-bold">2000–5000</span> → Ideal</p>
            </div>
          </div>

          {combinedDataFiltered.length > 0 && (
            <div className="card">
              <p className="text-sm font-bold text-slate-800 mb-3">WS vs RPE · ultimas {averageWeeks} semana{averageWeeks > 1 ? 's' : ''}</p>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={combinedDataFiltered} margin={{ top: 5, right: 5, bottom: 20, left: -15 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: TICK }} angle={-35} textAnchor="end" />
                  <YAxis yAxisId="ws" domain={[0, 100]} tick={{ fontSize: 9, fill: TICK }} />
                  <YAxis yAxisId="rpe" orientation="right" domain={[0, 10]} tick={{ fontSize: 9, fill: TICK }} />
                  <Tooltip contentStyle={TT} />
                  <Line yAxisId="ws" type="monotone" dataKey="ws" stroke="#10B981" strokeWidth={2} dot={false} name="WS" />
                  <Line yAxisId="rpe" type="monotone" dataKey="rpe" stroke="#EF4444" strokeWidth={2} dot={false} name="RPE" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── Wellness ── */}
      {tab === 'wellness' && (
        <div className="space-y-4">
          <div className="card">
            <p className="text-sm font-bold text-slate-800 mb-3">Wellness Score</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={wsChartData} margin={{ top: 5, right: 5, bottom: 20, left: -15 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: TICK }} angle={-35} textAnchor="end" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: TICK }} />
                <Tooltip contentStyle={TT} />
                <ReferenceLine y={75} stroke="#10B981" strokeDasharray="4 4" />
                <ReferenceLine y={50} stroke="#F59E0B" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="ws" stroke="#10B981" strokeWidth={2} dot={{ fill: '#10B981', r: 3 }} name="WS" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <p className="text-sm font-bold text-slate-800 mb-3">Componentes Wellness</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={wsChartData} margin={{ top: 5, right: 5, bottom: 20, left: -15 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: TICK }} angle={-35} textAnchor="end" />
                <YAxis domain={[1, 5]} tick={{ fontSize: 9, fill: TICK }} />
                <Tooltip contentStyle={TT} />
                <Line type="monotone" dataKey="fatiga" stroke="#EF4444" strokeWidth={1.5} dot={false} name="Fatiga" />
                <Line type="monotone" dataKey="dano" stroke="#F97316" strokeWidth={1.5} dot={false} name="Daño Musc." />
                <Line type="monotone" dataKey="sueno" stroke="#8B5CF6" strokeWidth={1.5} dot={false} name="Sueño" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-slate-100">
                  <th className="text-left py-2 pr-2 font-semibold">Fecha</th>
                  <th className="text-center font-semibold">WS</th>
                  <th className="text-center font-semibold">Fat.</th>
                  <th className="text-center font-semibold">Sueño</th>
                  <th className="text-center font-semibold">Estrés</th>
                  <th className="text-center font-semibold">Motiv.</th>
                  <th className="text-center font-semibold">Daño</th>
                </tr>
              </thead>
              <tbody>
                {[...wellness].reverse().map((w, i) => {
                  const molestias = w.molestias_zonas ? (() => { try { return JSON.parse(w.molestias_zonas); } catch { return []; } })() : [];
                  const sensacion = w.sensacion_proximo ? SENSACION_LABELS[w.sensacion_proximo] : null;
                  const enfermedad = w.enfermedad && w.enfermedad !== 'no' ? ENFERMEDAD_LABELS[w.enfermedad] : null;
                  return (
                    <React.Fragment key={i}>
                      <tr className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                        <td className="py-1.5 text-slate-500 pr-2 font-medium">{formatDate(w.date)}</td>
                        <td className="text-center font-extrabold" style={{ color: wsScoreColor(w.wellness_score) }}>{Math.round(w.wellness_score)}</td>
                        <td className="text-center text-slate-600">{w.fatiga}</td>
                        <td className="text-center text-slate-600">{w.sueno_calidad}</td>
                        <td className="text-center text-slate-600">{w.estres}</td>
                        <td className="text-center text-slate-600">{w.motivacion}</td>
                        <td className="text-center text-slate-600">{w.dano_muscular}</td>
                      </tr>
                      {(molestias.length > 0 || enfermedad || sensacion || w.entrenamiento_previo != null || w.otros_comentarios || w.observaciones) && (
                        <tr className="border-b border-slate-100">
                          <td colSpan={7} className="pb-2 pt-0.5 px-1">
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                              {molestias.length > 0 && <span className="text-orange-600 font-semibold">⚠ {molestias.join(', ')}</span>}
                              {enfermedad && <span className="text-red-600 font-semibold">🤒 {enfermedad}</span>}
                              {sensacion && <span className={`font-semibold ${sensacion.color}`}>→ {sensacion.label}</span>}
                              {w.entrenamiento_previo != null && <span className={w.entrenamiento_previo ? 'text-amber-600' : 'text-slate-400'}>Previo: {w.entrenamiento_previo ? 'Sí' : 'No'}</span>}
                              {(w.otros_comentarios || w.observaciones) && <span className="text-slate-400 italic">"{w.otros_comentarios || w.observaciones}"</span>}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Carga ── */}
      {tab === 'carga' && (
        <div className="space-y-4">
          <div className="card">
            <p className="text-sm font-bold text-slate-800 mb-3">RPE Diario</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={rpeChartData} margin={{ top: 5, right: 5, bottom: 20, left: -15 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: TICK }} angle={-35} textAnchor="end" />
                <YAxis domain={[0, 10]} tick={{ fontSize: 9, fill: TICK }} />
                <Tooltip contentStyle={TT} />
                <Bar dataKey="rpe" fill="#FB923C" radius={[4,4,0,0]} name="RPE" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <p className="text-sm font-bold text-slate-800 mb-3">sRPE Diario</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={rpeChartData} margin={{ top: 5, right: 5, bottom: 20, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: TICK }} angle={-35} textAnchor="end" />
                <YAxis tick={{ fontSize: 9, fill: TICK }} />
                <Tooltip contentStyle={TT} />
                <Bar dataKey="srpe" fill="#A78BFA" radius={[4,4,0,0]} name="sRPE" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="A/C Ratio" value={metrics.ac} status={acStatus(metrics.ac)} description="Agudo/Crónico" />
            <MetricCard label="Carga Semana" value={metrics.totalLoad} unit="sRPE" status="neutral" />
            <MetricCard label="Monotonía" value={metrics.monotony} status={monotonyStatus(metrics.monotony)} />
            <MetricCard label="Stress" value={metrics.stress} status={stressStatus(metrics.stress)} description="Carga × Monotonía" />
          </div>
        </div>
      )}

      {/* ── Asimilación ── */}
      {tab === 'asimilación' && (
        <div className="space-y-4">
          <div className="card">
            <p className="text-sm font-bold text-slate-800 mb-1">WS vs RPE — Asimilación de Carga</p>
            <p className="text-xs text-slate-400 mb-3">Cada punto = un día de entrenamiento</p>
            <ScatterPlot
              data={scatter.map(d => ({ ...d, name: formatDate(d.date) }))}
              avgWS={scatter.length ? Math.round(scatter.reduce((s, d) => s + d.ws, 0) / scatter.length) : null}
              avgRPE={scatter.length ? Math.round(scatter.reduce((s, d) => s + d.rpe, 0) / scatter.length) : null}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
}

function wsScoreColor(ws) {
  if (!ws) return '#94A3B8';
  if (ws >= 75) return '#16A34A';
  if (ws >= 50) return '#D97706';
  return '#DC2626';
}
