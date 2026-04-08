import React from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer
} from 'recharts';

const GRID = '#F1F5F9';
const TICK = '#94A3B8';
const DOT = '#EF4444';
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const CustomDot = (props) => {
  const { cx, cy } = props;
  return <circle cx={cx} cy={cy} r={7} fill={DOT} fillOpacity={0.82} stroke="#fff" strokeWidth={2} />;
};

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-lg text-xs">
      <p className="font-bold text-slate-800 mb-1">{d.name || 'Sesión'}</p>
      <p className="text-slate-500">WS: <span className="text-emerald-600 font-bold">{d.ws}</span></p>
      <p className="text-slate-500">RPE: <span className="text-red-500 font-bold">{d.rpe}</span></p>
    </div>
  );
};

export default function ScatterPlot({ data, avgWS, avgRPE }) {
  if (!data?.length) return (
    <div className="text-center text-slate-400 py-8 text-sm font-medium">Sin datos suficientes</div>
  );

  const chartData = data.map((point, index) => {
    const seed = Array.from(`${point.date || point.name || index}`).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const xOffset = ((seed % 5) - 2) * 0.45;
    const yOffset = (((Math.floor(seed / 5)) % 5) - 2) * 0.12;

    return {
      ...point,
      plotWs: clamp((point.plotWs ?? point.ws) + xOffset, 35, 100),
      plotRpe: clamp((point.plotRpe ?? point.rpe) + yOffset, 0, 10),
    };
  });

  return (
    <div className="relative">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-xs text-slate-400 font-medium">Pasa el cursor por un punto para ver la fecha y los valores.</p>
        <p className="text-[11px] text-slate-300 hidden sm:block">Los puntos cercanos se separan ligeramente para facilitar la lectura.</p>
      </div>
      <div className="absolute inset-0 pointer-events-none z-10 flex">
        <div className="flex-1 flex flex-col">
          <div className="flex-1 flex items-start justify-start p-2">
            <span className="text-xs text-slate-400 font-semibold">Muy cargados</span>
          </div>
          <div className="flex-1 flex items-end justify-start p-2">
            <span className="text-xs text-red-500 font-semibold">Mal adaptados</span>
          </div>
        </div>
        <div className="flex-1 flex flex-col">
          <div className="flex-1 flex items-start justify-end p-2">
            <span className="text-xs text-amber-500 font-semibold">Bien en la carga</span>
          </div>
          <div className="flex-1 flex items-end justify-end p-2">
            <span className="text-xs text-emerald-500 font-semibold">Poco cargados</span>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={420}>
        <ScatterChart margin={{ top: 28, right: 28, bottom: 28, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
          <XAxis
            type="number" dataKey="plotWs" name="Wellness Score"
            domain={[40, 100]} allowDecimals={false} tick={{ fontSize: 10, fill: TICK }}
            label={{ value: 'Wellness Score', position: 'insideBottom', offset: -10, fill: TICK, fontSize: 11 }}
          />
          <YAxis
            type="number" dataKey="plotRpe" name="RPE"
            domain={[0, 10]} allowDecimals={false} tick={{ fontSize: 10, fill: TICK }}
            label={{ value: 'RPE', angle: -90, position: 'insideLeft', fill: TICK, fontSize: 11 }}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#CBD5E1', strokeDasharray: '4 4' }} />
          {avgWS && <ReferenceLine x={avgWS} stroke="#CBD5E1" strokeDasharray="4 4" strokeWidth={1.5} />}
          {avgRPE && <ReferenceLine y={avgRPE} stroke="#CBD5E1" strokeDasharray="4 4" strokeWidth={1.5} />}
          <Scatter data={chartData} shape={<CustomDot />} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
