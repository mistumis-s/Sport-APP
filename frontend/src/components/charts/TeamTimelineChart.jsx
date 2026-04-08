import React from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from 'recharts';

const COLOR_MAP = { ROJO: '#ef4444', 'ROJO+': '#991b1b', NARANJA: '#f97316', AMARILLO: '#eab308' };

const GRID   = '#F1F5F9';
const TICK   = '#94A3B8';
const TT_STYLE = { backgroundColor: '#fff', border: '1px solid #E2E8F0', borderRadius: 10, fontSize: 12, color: '#1E293B', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' };

const CustomBar = (props) => {
  const { x, y, width, height, color_day } = props;
  const fill = COLOR_MAP[color_day?.toUpperCase()] || '#CBD5E1';
  return <rect x={x} y={y} width={width} height={height} fill={fill} rx={3} />;
};

export function WSChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={data} margin={{ top: 5, right: 5, bottom: 20, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: TICK }} angle={-35} textAnchor="end" />
        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: TICK }} />
        <Tooltip contentStyle={TT_STYLE} labelStyle={{ color: '#475569', fontWeight: 600 }} />
        <ReferenceLine y={75} stroke="#10B981" strokeDasharray="4 4" label={{ value: '75', fill: '#10B981', fontSize: 10 }} />
        <ReferenceLine y={50} stroke="#F59E0B" strokeDasharray="4 4" label={{ value: '50', fill: '#F59E0B', fontSize: 10 }} />
        <Bar dataKey="avg_ws" name="WS Equipo" radius={[4,4,0,0]}
          shape={(props) => <CustomBar {...props} color_day={props.color_day} />}
        />
        <Line type="monotone" dataKey="avg_ws" stroke="#ef4444" dot={false} strokeWidth={2} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function RPEChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <ComposedChart data={data} margin={{ top: 5, right: 5, bottom: 20, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: TICK }} angle={-35} textAnchor="end" />
        <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: TICK }} />
        <Tooltip contentStyle={TT_STYLE} />
        <Bar dataKey="avg_rpe" name="RPE" fill="#FB923C" radius={[4,4,0,0]} />
        <Line type="monotone" dataKey="avg_rpe" stroke="#EA580C" dot={false} strokeWidth={2} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function SRPEChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <ComposedChart data={data} margin={{ top: 5, right: 5, bottom: 20, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: TICK }} angle={-35} textAnchor="end" />
        <YAxis tick={{ fontSize: 10, fill: TICK }} />
        <Tooltip contentStyle={TT_STYLE} />
        <Bar dataKey="avg_srpe" name="sRPE" fill="#A78BFA" radius={[4,4,0,0]} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
