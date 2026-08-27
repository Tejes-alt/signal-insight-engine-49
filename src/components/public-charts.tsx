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

/**
 * CHART STYLING
 * =============
 * Charts sit on the pulse grid, not inside a card. Axes recede, the series
 * carries the accent, and the cursor produces a vertical tracking line so a
 * reading can be taken at any point.
 */

const AXIS = {
  stroke: "var(--color-faint)",
  fontSize: 10,
  tickLine: false,
  axisLine: false,
  style: { fontFamily: "var(--font-mono)", letterSpacing: "0.08em" },
} as const;

const TRACKING_LINE = {
  stroke: "var(--color-primary)",
  strokeWidth: 1,
  strokeDasharray: "2 4",
  opacity: 0.7,
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
    <div className="overlay-surface min-w-36 p-3 text-xs">
      <div className="label-faint mb-2">{typeof label === "string" ? shortDate(label) : label}</div>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center justify-between gap-5">
          <span className="flex items-center gap-2 text-muted-foreground">
            <span className="h-px w-3" style={{ background: entry.color }} />
            {entry.name}
          </span>
          <span className="figure text-sm">
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
      <AreaChart data={data} margin={{ top: 10, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`pg-${yKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.22} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--color-border)" strokeOpacity={0.5} vertical={false} />
        <XAxis dataKey={xKey} tickFormatter={shortDate} {...AXIS} minTickGap={32} />
        <YAxis tickFormatter={(v: number) => formatNumber(v, 0)} width={44} {...AXIS} />
        <RTooltip content={<Box />} cursor={TRACKING_LINE} />
        <Area
          type="monotone"
          dataKey={yKey}
          name={label}
          stroke={color}
          strokeWidth={1.75}
          fill={`url(#pg-${yKey})`}
          activeDot={{ r: 3, strokeWidth: 0, fill: color }}
          isAnimationActive
          animationDuration={620}
          animationEasing="ease-out"
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
      <BarChart data={data} margin={{ top: 10, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--color-border)" strokeOpacity={0.5} vertical={false} />
        <XAxis dataKey={xKey} tickFormatter={shortDate} {...AXIS} minTickGap={20} />
        <YAxis allowDecimals={false} width={36} {...AXIS} />
        <RTooltip content={<Box />} cursor={{ fill: "var(--color-secondary)", opacity: 0.35 }} />
        <Bar dataKey={yKey} name={label} fill={color} radius={[2, 2, 0, 0]} animationDuration={620} />
      </BarChart>
    </ResponsiveContainer>
  );
}
