import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatNumber } from "@/components/metrics";
import type { SeriesPoint } from "@/lib/analytics/dashboard";

const AXIS = {
  stroke: "var(--color-muted-foreground)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

function shortDate(value: string) {
  const d = new Date(value);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function TooltipBox({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string | number; value?: number | string; color?: string }>;
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="panel min-w-40 p-3 text-xs shadow-[var(--shadow-raised)]">
      <div className="label-mono mb-2">{typeof label === "string" ? shortDate(label) : label}</div>
      <div className="space-y-1.5">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="size-2 rounded-full" style={{ background: entry.color }} />
              {entry.name}
            </span>
            <span className="tabular font-semibold">
              {typeof entry.value === "number" ? formatNumber(entry.value) : entry.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TrendArea({
  series,
  keys,
  height = 300,
}: {
  series: SeriesPoint[];
  keys: Array<{ key: keyof SeriesPoint; label: string; color: string }>;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          {keys.map((k) => (
            <linearGradient key={k.key as string} id={`grad-${k.key as string}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={k.color} stopOpacity={0.45} />
              <stop offset="100%" stopColor={k.color} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} {...AXIS} minTickGap={28} />
        <YAxis tickFormatter={(v: number) => formatNumber(v, 0)} width={48} {...AXIS} />
        <RTooltip content={<TooltipBox />} />
        {keys.map((k, i) => (
          <Area
            key={k.key as string}
            type="monotone"
            dataKey={k.key as string}
            name={k.label}
            stroke={k.color}
            strokeWidth={2}
            fill={`url(#grad-${k.key as string})`}
            isAnimationActive
            animationDuration={900}
            animationBegin={i * 120}
            connectNulls
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2 }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function TrendLines({
  series,
  keys,
  height = 300,
}: {
  series: Array<Record<string, unknown>>;
  keys: Array<{ key: string; label: string; color: string }>;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="date" tickFormatter={shortDate} {...AXIS} minTickGap={28} />
        <YAxis tickFormatter={(v: number) => formatNumber(v, 0)} width={48} {...AXIS} />
        <RTooltip content={<TooltipBox />} />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, paddingTop: 8, color: "var(--color-muted-foreground)" }}
        />
        {keys.map((k, i) => (
          <Line
            key={k.key}
            type="monotone"
            dataKey={k.key}
            name={k.label}
            stroke={k.color}
            strokeWidth={2}
            dot={false}
            connectNulls
            animationDuration={900}
            animationBegin={i * 120}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function CompareBars({
  data,
  height = 300,
}: {
  data: Array<{ name: string; value: number; color: string }>;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="name" {...AXIS} />
        <YAxis tickFormatter={(v: number) => formatNumber(v, 0)} width={48} {...AXIS} />
        <RTooltip cursor={{ fill: "var(--color-muted)", opacity: 0.35 }} content={<TooltipBox />} />
        <Bar dataKey="value" name="Value" radius={[8, 8, 4, 4]} animationDuration={800}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ShareDonut({
  data,
  height = 260,
}: {
  data: Array<{ name: string; value: number; color: string }>;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <RTooltip content={<TooltipBox />} />
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="58%"
          outerRadius="86%"
          paddingAngle={3}
          stroke="var(--color-background)"
          strokeWidth={2}
          animationDuration={800}
        >
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Pie>
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, color: "var(--color-muted-foreground)" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function BalanceRadar({
  data,
  height = 280,
}: {
  data: Array<{ axis: string; value: number }>;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="var(--color-border)" />
        <PolarAngleAxis dataKey="axis" tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
        <RTooltip content={<TooltipBox />} />
        <Radar
          name="Index"
          dataKey="value"
          stroke="var(--color-chart-1)"
          fill="var(--color-chart-1)"
          fillOpacity={0.28}
          animationDuration={900}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
