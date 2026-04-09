import React from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

const COLOR_MAP = { ROJO: '#ef4444', 'ROJO+': '#991b1b', NARANJA: '#f97316', AMARILLO: '#eab308' };
const GRID = '#F1F5F9';
const TICK = '#94A3B8';
const TT_STYLE = {
  backgroundColor: '#fff',
  border: '1px solid #E2E8F0',
  borderRadius: 10,
  fontSize: 12,
  color: '#1E293B',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
};

const CustomBar = (props) => {
  const { x, y, width, height, payload, fill } = props;
  const baseFill = fill || COLOR_MAP[payload?.color_day?.toUpperCase()] || '#CBD5E1';
  const isMatchDay = Boolean(payload?.isMatchDay);
  const safeHeight = height < 0 ? 0 : height;

  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={safeHeight}
      fill={isMatchDay ? '#DC2626' : baseFill}
      stroke={isMatchDay ? '#991B1B' : 'none'}
      strokeWidth={isMatchDay ? 1.5 : 0}
      rx={3}
    />
  );
};

const AxisTick = ({ x, y, payload }) => (
  <g transform={`translate(${x},${y})`}>
    <text
      x={0}
      y={0}
      dy={12}
      textAnchor="end"
      fill={TICK}
      fontSize={9}
      transform="rotate(-45)"
    >
      <tspan x={0} dy={0}>{String(payload?.value || '')}</tspan>
    </text>
  </g>
);

function MatchReference({ matchReferenceLabel }) {
  if (!matchReferenceLabel) return null;
  return <ReferenceLine x={matchReferenceLabel} stroke="#DC2626" strokeDasharray="6 4" />;
}

export function WSChart({ data, matchReferenceLabel }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={data} margin={{ top: 5, right: 5, bottom: 34, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
        <XAxis dataKey="axisLabel" tick={<AxisTick />} interval={0} height={64} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: TICK }} />
        <Tooltip contentStyle={TT_STYLE} labelStyle={{ color: '#475569', fontWeight: 600 }} />
        <ReferenceLine y={75} stroke="#10B981" strokeDasharray="4 4" label={{ value: '75', fill: '#10B981', fontSize: 10 }} />
        <ReferenceLine y={50} stroke="#F59E0B" strokeDasharray="4 4" label={{ value: '50', fill: '#F59E0B', fontSize: 10 }} />
        <MatchReference matchReferenceLabel={matchReferenceLabel} />
        <Bar dataKey="avg_ws" name="WS Equipo" radius={[4, 4, 0, 0]} shape={(props) => <CustomBar {...props} />} />
        <Line type="monotone" dataKey="avg_ws" stroke="#ef4444" dot={false} strokeWidth={2} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function RPEChart({ data, matchReferenceLabel }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 5, right: 5, bottom: 34, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
        <XAxis dataKey="axisLabel" tick={<AxisTick />} interval={0} height={64} />
        <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: TICK }} />
        <Tooltip contentStyle={TT_STYLE} />
        <MatchReference matchReferenceLabel={matchReferenceLabel} />
        <Bar dataKey="avg_rpe" name="RPE" radius={[4, 4, 0, 0]} shape={(props) => <CustomBar {...props} fill="#FB923C" />} />
        <Line type="monotone" dataKey="avg_rpe" stroke="#EA580C" dot={false} strokeWidth={2} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function SRPEChart({ data, matchReferenceLabel }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 5, right: 5, bottom: 34, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
        <XAxis dataKey="axisLabel" tick={<AxisTick />} interval={0} height={64} />
        <YAxis tick={{ fontSize: 10, fill: TICK }} />
        <Tooltip contentStyle={TT_STYLE} />
        <MatchReference matchReferenceLabel={matchReferenceLabel} />
        <Bar dataKey="avg_srpe" name="sRPE" radius={[4, 4, 0, 0]} shape={(props) => <CustomBar {...props} fill="#A78BFA" />} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
