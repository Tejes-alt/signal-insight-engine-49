import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatNumber } from "@/components/metrics";

const AXIS = {
  stroke: "var(--color-muted-foreground)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

function shortDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Box({
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
    <div className="panel min-w-36 p-3 text-xs shadow-[var(--shadow-raised)]">
      <div className="label-mono mb-2">{typeof label === "string" ? shortDate(label) : label}</div>
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
  );
}

export function SimpleArea({
  data,
  xKey,
  yKey,
  label,
  color = "var(--color-primary)",
  height = 280,
}: {
  data: Array<Record<string, string | number>>;
  xKey: string;
  yKey: string;
  label: string;
  color?: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`pg-${yKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.45} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey={xKey} tickFormatter={shortDate} {...AXIS} minTickGap={28} />
        <YAxis tickFormatter={(v: number) => formatNumber(v, 0)} width={48} {...AXIS} />
        <RTooltip content={<Box />} />
        <Area
          type="monotone"
          dataKey={yKey}
          name={label}
          stroke={color}
          strokeWidth={2}
          fill={`url(#pg-${yKey})`}
          isAnimationActive
          animationDuration={700}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function SimpleBars({
  data,
  xKey,
  yKey,
  label,
  color = "var(--color-primary)",
  height = 260,
}: {
  data: Array<Record<string, string | number>>;
  xKey: string;
  yKey: string;
  label: string;
  color?: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey={xKey} tickFormatter={shortDate} {...AXIS} minTickGap={20} />
        <YAxis allowDecimals={false} width={40} {...AXIS} />
        <RTooltip content={<Box />} cursor={{ fill: "var(--color-secondary)", opacity: 0.4 }} />
        <Bar dataKey={yKey} name={label} fill={color} radius={[6, 6, 0, 0]} animationDuration={700} />
      </BarChart>
    </ResponsiveContainer>
  );
}
