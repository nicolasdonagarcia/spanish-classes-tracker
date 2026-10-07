"use client";

import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { BarShapeProps, XAxisTickContentProps } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { money, monthLabel, moneyShort } from "@/lib/format";
import type { ChartPoint } from "@/lib/types";

const config = {
  paid: { label: "Pagado", color: "var(--chart-paid)" },
  pending: { label: "Pendiente", color: "var(--chart-pending)" },
} satisfies ChartConfig;

const GAP = 2;
const R = 4;

/** Rounded data-end on whichever segment is on top; 2px surface gap between segments. */
function segmentShape(kind: "paid" | "pending") {
  function Shape(props: BarShapeProps) {
    const { x, y, width, height, fill, payload } = props;
    const p = payload as ChartPoint;
    if (!height || height <= 0 || !width) return <g />;
    const isTop = kind === "pending" || p.pending <= 0;
    let h = height;
    if (kind === "pending" && p.paid > 0) h = Math.max(0, height - GAP);
    if (h <= 0) return <g />;
    const r = isTop ? Math.min(R, h, width / 2) : 0;
    const d = [
      `M${x},${y + h}`,
      `V${y + r}`,
      r ? `Q${x},${y} ${x + r},${y}` : "",
      `H${x + width - r}`,
      r ? `Q${x + width},${y} ${x + width},${y + r}` : "",
      `V${y + h}`,
      "Z",
    ].join(" ");
    return <path d={d} fill={fill} />;
  }
  return Shape;
}
const PaidShape = segmentShape("paid");
const PendingShape = segmentShape("pending");

export function EarningsChart({ data, selected }: { data: ChartPoint[]; selected: string }) {
  const router = useRouter();
  const empty = data.every((d) => d.paid + d.pending === 0);
  const total = data.reduce((s, d) => s + d.paid + d.pending, 0);

  return (
    <Card className="gap-2 py-5">
      <CardHeader className="px-5">
        <CardTitle className="text-base">Ingresos por mes</CardTitle>
        <CardDescription>
          {empty ? "Aún no hay clases en estos meses." : `${money(total)} en 12 meses · toca una barra para ver ese mes`}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 sm:px-4">
        <ChartContainer config={config} className="aspect-auto h-44 w-full sm:h-52">
          <BarChart
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            barCategoryGap="22%"
            onClick={(state) => {
              const i = Number(state?.activeTooltipIndex);
              const point = Number.isInteger(i) ? data[i] : undefined;
              if (point) router.push(`?mes=${point.month}`, { scroll: false });
            }}
            className="cursor-pointer"
            accessibilityLayer
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval={0}
              tick={(props: XAxisTickContentProps) => {
                const m = String(props.payload?.value ?? "");
                const x = Number(props.x);
                const y = Number(props.y);
                const isSel = m === selected;
                const p = data.find((d) => d.month === m);
                return (
                  <text
                    x={x}
                    y={y + 10}
                    textAnchor="middle"
                    className={isSel ? "fill-foreground text-[11px] font-semibold" : "fill-muted-foreground text-[11px]"}
                  >
                    {p?.label}
                    {isSel && <tspan x={x} dy={12}>•</tspan>}
                  </text>
                );
              }}
              height={34}
            />
            <YAxis
              width={44}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => moneyShort(v)}
              className="text-[11px]"
            />
            <ChartTooltip
              cursor={{ fillOpacity: 0.5 }}
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) => {
                    const m = (payload?.[0]?.payload as ChartPoint | undefined)?.month;
                    return m ? monthLabel(m) : "";
                  }}
                  formatter={(value, name, item) => (
                    <div className="flex w-full items-center justify-between gap-4">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <span className="size-2.5 rounded-[2px]" style={{ background: item.color }} />
                        {config[name as keyof typeof config]?.label ?? name}
                      </span>
                      <span className="font-mono font-medium tabular-nums text-foreground">{money(Number(value))}</span>
                    </div>
                  )}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="paid" stackId="a" fill="var(--color-paid)" shape={PaidShape} />
            <Bar dataKey="pending" stackId="a" fill="var(--color-pending)" shape={PendingShape} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
