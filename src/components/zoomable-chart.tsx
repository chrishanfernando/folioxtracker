'use client';

import { useState, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea, ReferenceDot,
} from 'recharts';
import { formatDate } from '@/lib/format';
import { useChartColors } from '@/lib/theme-colors';

export interface ChartMarker {
  date: string;
  label: string;
  color: string;
}

interface ZoomableChartProps {
  data: Array<{ date: string; [key: string]: unknown }>;
  lines: Array<{ dataKey: string; stroke: string; strokeWidth?: number; strokeDasharray?: string; name?: string }>;
  yFormatter?: (v: number) => string;
  tooltipFormatter?: (v: unknown, name: string) => [string, string];
  height?: number;
  markers?: ChartMarker[];
}

export function ZoomableChart({ data, lines, yFormatter, tooltipFormatter, height = 300, markers }: ZoomableChartProps) {
  const chartColors = useChartColors();
  const [left, setLeft] = useState<string | null>(null);
  const [right, setRight] = useState<string | null>(null);
  const [refAreaLeft, setRefAreaLeft] = useState<string | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const filteredData = (left && right)
    ? data.filter(d => d.date >= left && d.date <= right)
    : data;

  // Build a map of date -> price for the primary line so we can position markers
  const primaryKey = lines[0]?.dataKey;
  const priceByDate = new Map<string, number>();
  for (const d of filteredData) {
    if (primaryKey && d[primaryKey] != null) {
      priceByDate.set(d.date, d[primaryKey] as number);
    }
  }

  // For markers, find the closest price date if exact match doesn't exist
  const resolvedMarkers = (markers || []).map(m => {
    if (priceByDate.has(m.date)) {
      return { ...m, y: priceByDate.get(m.date)! };
    }
    // Find closest date on or before
    let closest: string | null = null;
    for (const date of priceByDate.keys()) {
      if (date <= m.date) closest = date;
    }
    if (closest) {
      return { ...m, date: closest, y: priceByDate.get(closest)! };
    }
    return null;
  }).filter(Boolean) as (ChartMarker & { y: number })[];

  const handleMouseDown = useCallback((e: { activeLabel?: string }) => {
    if (e?.activeLabel) {
      setRefAreaLeft(e.activeLabel);
      setDragging(true);
    }
  }, []);

  const handleMouseMove = useCallback((e: { activeLabel?: string }) => {
    if (dragging && e?.activeLabel) {
      setRefAreaRight(e.activeLabel);
    }
  }, [dragging]);

  const handleMouseUp = useCallback(() => {
    if (refAreaLeft && refAreaRight) {
      const [l, r] = refAreaLeft < refAreaRight
        ? [refAreaLeft, refAreaRight]
        : [refAreaRight, refAreaLeft];
      setLeft(l);
      setRight(r);
    }
    setRefAreaLeft(null);
    setRefAreaRight(null);
    setDragging(false);
  }, [refAreaLeft, refAreaRight]);

  const handleReset = useCallback(() => {
    setLeft(null);
    setRight(null);
  }, []);

  // Group markers by date+y to avoid overlapping dots
  const markerMap = new Map<string, ChartMarker & { y: number }>();
  for (const m of resolvedMarkers) {
    const key = `${m.date}`;
    if (!markerMap.has(key)) {
      markerMap.set(key, m);
    }
  }

  return (
    <div className="select-none">
      {(left && right) && (
        <button
          onClick={handleReset}
          className="text-xs text-muted-foreground hover:text-foreground mb-2 underline underline-offset-4"
        >
          Reset zoom
        </button>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={filteredData}
          onMouseDown={handleMouseDown as never}
          onMouseMove={handleMouseMove as never}
          onMouseUp={handleMouseUp}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={chartColors.gridColor} />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(v) => { const [y, m] = v.split('-'); return `${m}-${y}`; }} />
          <YAxis tick={{ fontSize: 12 }} tickFormatter={yFormatter} />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              // Find markers on this date
              const dateMarkers = (markers || []).filter(m => m.date === label);
              return (
                <div className="text-xs space-y-0.5">
                  <p className="text-muted-foreground">{formatDate(label as string)}</p>
                  {payload.map((p) => (
                    <p key={p.dataKey as string} style={{ color: p.color }}>
                      {p.name}: {tooltipFormatter ? tooltipFormatter(p.value, p.name as string)[0] : String(p.value)}
                    </p>
                  ))}
                  {dateMarkers.map((m, i) => (
                    <p key={i} style={{ color: m.color }} className="font-medium">{m.label}</p>
                  ))}
                </div>
              );
            }}
          />
          {lines.map(l => (
            <Line
              key={l.dataKey}
              type="monotone"
              dataKey={l.dataKey}
              name={l.name || l.dataKey}
              stroke={l.stroke}
              strokeWidth={l.strokeWidth ?? 2}
              strokeDasharray={l.strokeDasharray}
              dot={false}
            />
          ))}
          {[...markerMap.values()].map((m, i) => (
            <ReferenceDot
              key={i}
              x={m.date}
              y={m.y}
              r={4}
              fill={m.color}
              stroke="#fff"
              strokeWidth={1.5}
            />
          ))}
          {refAreaLeft && refAreaRight && (
            <ReferenceArea
              x1={refAreaLeft}
              x2={refAreaRight}
              stroke="none"
              fill={chartColors.refAreaColor}
              fillOpacity={0.15}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
