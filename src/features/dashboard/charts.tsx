/**
 * Small, dependency-free charts for the dashboard. Marks follow the dataviz specs: thin bars (<= 24px) with
 * 4px rounded data-ends from one baseline, 2px lines with a 10% area wash, hairline recessive grid, values in
 * text colours (never the series colour), a hover/focus tooltip on every mark and a table view of the data.
 * Colours: `chart-1` for a single series; `chart-1` + `chart-3` for two categories (validated pair).
 */
import { BarChart3, Table2 } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type TableView = { columns: string[]; rows: (string | number)[][] };

/** A chart in a card, with a switch to see the same figures as a table. */
export function ChartCard({
  title,
  description,
  table,
  className,
  children,
}: {
  title: string;
  description?: ReactNode;
  table?: TableView;
  className?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const [asTable, setAsTable] = useState(false);
  return (
    <Card className={cn("min-w-0 gap-3", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="min-w-0">
          <CardTitle className="text-base">{title}</CardTitle>
          {description && <CardDescription className="mt-1">{description}</CardDescription>}
        </div>
        {table && table.rows.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="-mt-1 shrink-0"
            aria-pressed={asTable}
            aria-label={asTable ? t("dashboard.charts.showChart") : t("dashboard.charts.showTable")}
            onClick={() => setAsTable(!asTable)}
          >
            {asTable ? <BarChart3 /> : <Table2 />}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {asTable && table ? (
          <div className="max-h-80 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {table.columns.map((column, index) => (
                    <TableHead key={column} className={index ? "text-right" : ""}>
                      {column}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.rows.map((row, r) => (
                  <TableRow key={r}>
                    {row.map((cell, index) => (
                      <TableCell key={index} className={index ? "text-right tabular-nums" : ""}>
                        {cell}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

export function EmptyChart({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground py-6 text-center text-sm">{children}</p>;
}

/** Horizontal bars: one row per item, the value at the bar's tip. */
export function BarList({
  items,
  format,
  tone = "bg-chart-1",
  labelWidth = "8rem",
}: {
  items: { key: string | number; label: string; value: number; display?: string; hint?: string; tone?: string }[];
  format: (value: number) => string;
  tone?: string;
  labelWidth?: string;
}) {
  const max = Math.max(1, ...items.map((item) => item.value));
  // One grid for every row, so all bars share the same track width (and the same scale).
  return (
    <ul className="grid items-center gap-x-3 gap-y-2.5 text-sm" style={{ gridTemplateColumns: `${labelWidth} 1fr auto` }}>
      {items.map((item) => (
        <li key={item.key} className="contents">
          <span className="truncate" title={item.hint ? `${item.label} — ${item.hint}` : item.label}>
            {item.label}
          </span>
          <span className="bg-muted h-2.5 overflow-hidden rounded-full">
            <span
              className={cn("block h-full rounded-full", item.tone ?? tone)}
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </span>
          <span className="text-right tabular-nums">{item.display ?? format(item.value)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Two parts of a whole (girls / boys, collected / still to collect) with their legend. */
export function SplitBar({
  parts,
  format,
}: {
  parts: [{ label: string; value: number }, { label: string; value: number }];
  format: (value: number) => string;
}) {
  const total = parts[0].value + parts[1].value;
  const tones = ["bg-chart-1", "bg-chart-3"];
  if (total <= 0) return null;
  return (
    <div className="grid gap-4">
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" aria-hidden>
        {parts.map((part, index) =>
          part.value > 0 ? (
            <div key={part.label} className={tones[index]} style={{ width: `${(part.value / total) * 100}%` }} />
          ) : null,
        )}
      </div>
      <ul className="grid gap-2 text-sm">
        {parts.map((part, index) => (
          <li key={part.label} className="flex items-center gap-2">
            <span className={cn("size-2.5 shrink-0 rounded-full", tones[index])} aria-hidden />
            <span className="flex-1">{part.label}</span>
            <span className="whitespace-nowrap tabular-nums">
              {format(part.value)} <span className="text-muted-foreground">({Math.round((part.value / total) * 100)} %)</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * power >= value / 1) ?? 10;
  return step * power;
}

const HEIGHT = 200;
const PAD = { top: 14, right: 10, bottom: 24, left: 56 };

/** The element's width in CSS pixels, so the SVG is drawn at its real size (text stays 11px). */
function useWidth(initial = 320) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(initial);
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.round(entry.contentRect.width))));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

function Tooltip({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) {
  return (
    <div
      role="status"
      className="bg-popover text-popover-foreground pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border px-2 py-1 text-xs whitespace-nowrap shadow-md"
      style={{ left: Math.min(width - 70, Math.max(70, x)), top: y }}
    >
      {children}
    </div>
  );
}

function YAxis({ max, width, format }: { max: number; width: number; format: (value: number) => string }) {
  const ticks = [0, 0.5, 1].map((f) => f * max);
  const plot = HEIGHT - PAD.top - PAD.bottom;
  return (
    <g>
      {ticks.map((tick) => {
        const y = PAD.top + plot - (tick / max) * plot;
        return (
          <g key={tick}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y} y2={y} className="stroke-border" strokeWidth={1} />
            <text x={PAD.left - 6} y={y} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[11px]">
              {format(tick)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/** Columns over time (one series), e.g. payments received month by month. */
export function ColumnChart({
  points,
  format,
  formatAxis,
  label,
}: {
  points: { key: string; label: string; value: number }[];
  format: (value: number) => string;
  formatAxis: (value: number) => string;
  label: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const { ref, width } = useWidth();
  const max = niceMax(Math.max(0, ...points.map((p) => p.value)));
  const plot = { w: width - PAD.left - PAD.right, h: HEIGHT - PAD.top - PAD.bottom };
  const band = plot.w / Math.max(1, points.length);
  const barWidth = Math.min(24, band * 0.6);
  const peak = points.reduce((best, p, i) => (p.value > (points[best]?.value ?? -1) ? i : best), 0);
  return (
    <div ref={ref} className="relative w-full min-w-0 overflow-x-clip" onMouseLeave={() => setActive(null)}>
      <svg width={width} height={HEIGHT} className="block" role="img" aria-label={label}>
        <YAxis max={max} width={width} format={formatAxis} />
        {points.map((point, index) => {
          const h = (point.value / max) * plot.h;
          const x = PAD.left + band * index + (band - barWidth) / 2;
          const y = PAD.top + plot.h - h;
          const r = Math.min(4, h / 2, barWidth / 2);
          return (
            <g
              key={point.key}
              tabIndex={0}
              role="img"
              aria-label={`${point.label}: ${format(point.value)}`}
              onMouseEnter={() => setActive(index)}
              onFocus={() => setActive(index)}
              onBlur={() => setActive(null)}
              className="outline-none"
            >
              {/* Hit target: the whole band, taller than the mark. */}
              <rect x={PAD.left + band * index} y={PAD.top} width={band} height={plot.h} fill="transparent" />
              {h > 0 && (
                <path
                  className={cn("fill-chart-1 transition-opacity", active !== null && active !== index && "opacity-50")}
                  d={`M${x},${PAD.top + plot.h} V${y + r} Q${x},${y} ${x + r},${y} H${x + barWidth - r} Q${x + barWidth},${y} ${x + barWidth},${y + r} V${PAD.top + plot.h} Z`}
                />
              )}
              <text
                x={PAD.left + band * index + band / 2}
                y={HEIGHT - 6}
                textAnchor="middle"
                className="fill-muted-foreground text-[11px]"
              >
                {point.label}
              </text>
              {index === peak && point.value > 0 && active === null && (
                <text x={x + barWidth / 2} y={y - 4} textAnchor="middle" className="fill-foreground text-[11px] font-medium">
                  {formatAxis(point.value)}
                </text>
              )}
            </g>
          );
        })}
        <line
          x1={PAD.left}
          x2={width - PAD.right}
          y1={PAD.top + plot.h}
          y2={PAD.top + plot.h}
          className="stroke-muted-foreground/40"
          strokeWidth={1}
        />
      </svg>
      {active !== null && points[active] && (
        <Tooltip
          x={PAD.left + band * active + band / 2}
          y={PAD.top + plot.h - (points[active].value / max) * plot.h - 6}
          width={width}
        >
          <span className="text-muted-foreground">{points[active].label}</span>{" "}
          <span className="font-medium tabular-nums">{format(points[active].value)}</span>
        </Tooltip>
      )}
    </div>
  );
}

/** A rate (0–100 %) over days, with a crosshair and tooltip following the pointer. */
export function RateLineChart({
  points,
  label,
  detail,
}: {
  points: { key: string; label: string; value: number | null }[];
  label: string;
  detail?: (index: number) => ReactNode;
}) {
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  const { ref, width } = useWidth();
  const plot = { w: width - PAD.left - PAD.right, h: HEIGHT - PAD.top - PAD.bottom };
  const step = points.length > 1 ? plot.w / (points.length - 1) : 0;
  const xy = points.map((p, i) => ({
    x: PAD.left + (points.length > 1 ? step * i : plot.w / 2),
    y: p.value === null ? null : PAD.top + plot.h - (p.value / 100) * plot.h,
  }));
  const drawn = xy.filter((p): p is { x: number; y: number } => p.y !== null);
  const line = drawn.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");
  const area = drawn.length
    ? `${line} L${drawn[drawn.length - 1].x},${PAD.top + plot.h} L${drawn[0].x},${PAD.top + plot.h} Z`
    : "";
  const last = drawn.length - 1;

  const pick = (clientX: number, box: DOMRect) => {
    const x = clientX - box.left;
    const index = points.length > 1 ? Math.round((x - PAD.left) / step) : 0;
    setActive(Math.max(0, Math.min(points.length - 1, index)));
  };

  return (
    <div ref={ref} className="relative w-full min-w-0 overflow-x-clip">
      <svg
        width={width}
        height={HEIGHT}
        className="block touch-none"
        role="img"
        aria-label={label}
        tabIndex={0}
        onPointerMove={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
        onPointerLeave={() => setActive(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") setActive((a) => Math.min(points.length - 1, (a ?? -1) + 1));
          if (e.key === "ArrowLeft") setActive((a) => Math.max(0, (a ?? points.length) - 1));
        }}
        onBlur={() => setActive(null)}
      >
        <YAxis max={100} width={width} format={(v) => `${v} %`} />
        {area && <path d={area} className="fill-chart-1" opacity={0.1} />}
        {line && (
          <path d={line} className="stroke-chart-1" fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        )}
        {[0, Math.floor((points.length - 1) / 2), points.length - 1]
          .filter((v, i, all) => all.indexOf(v) === i && points[v])
          .map((index) => (
            <text
              key={`${id}-${index}`}
              x={xy[index].x}
              y={HEIGHT - 6}
              textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}
              className="fill-muted-foreground text-[11px]"
            >
              {points[index].label}
            </text>
          ))}
        {last >= 0 && active === null && (
          <circle cx={drawn[last].x} cy={drawn[last].y} r={4} className="fill-chart-1 stroke-card" strokeWidth={2} />
        )}
        {active !== null && (
          <g>
            <line
              x1={xy[active].x}
              x2={xy[active].x}
              y1={PAD.top}
              y2={PAD.top + plot.h}
              className="stroke-muted-foreground/50"
              strokeWidth={1}
            />
            {xy[active].y !== null && (
              <circle cx={xy[active].x} cy={xy[active].y!} r={4} className="fill-chart-1 stroke-card" strokeWidth={2} />
            )}
          </g>
        )}
      </svg>
      {active !== null && points[active] && (
        <Tooltip x={xy[active].x} y={(xy[active].y ?? PAD.top + plot.h) - 8} width={width}>
          <span className="text-muted-foreground">{points[active].label}</span>{" "}
          <span className="font-medium tabular-nums">
            {points[active].value === null ? "—" : `${points[active].value} %`}
          </span>
          {detail && <span className="text-muted-foreground block">{detail(active)}</span>}
        </Tooltip>
      )}
    </div>
  );
}
