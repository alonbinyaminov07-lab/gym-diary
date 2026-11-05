import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmtNum } from '../../utils/format';

export interface ChartDatum {
  /** уникальный ключ точки (например, id тренировки или дата) */
  key: string;
  /** короткая подпись на оси X */
  label: string;
  value: number;
  /** подробная подпись в подсказке (дата целиком, «80 кг × 5» и т. п.) */
  tip?: string;
}

/** Цвета берём из CSS-переменных — так график следует теме (в т. ч. теме Telegram). */
function chartColors() {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string) => s.getPropertyValue(name).trim();
  return { accent: v('--accent'), hint: v('--hint'), line: v('--line'), card: v('--card'), card2: v('--card-2') };
}

/** Подпись оси: 12 500 → «12,5 т», 850 → «850». */
export function compactKg(n: number): string {
  return n >= 1000 ? `${fmtNum(n / 1000)} т` : fmtNum(n);
}

/**
 * Однорядный график изменения во времени: линия (вес, замеры) или столбики (тоннаж, количество).
 * Одна величина на график — разные величины не смешиваются на двух осях.
 */
export function TrendChart({
  data,
  kind,
  unit,
  height = 180,
  axisFormat = fmtNum,
  ariaLabel,
}: {
  data: ChartDatum[];
  kind: 'line' | 'bar';
  unit: string;
  height?: number;
  axisFormat?: (n: number) => string;
  ariaLabel: string;
}) {
  const c = chartColors();
  const labelOf = new Map(data.map((d) => [d.key, d.label]));

  const axisProps = {
    tick: { fill: c.hint, fontSize: 12 },
    axisLine: false,
    tickLine: false,
  } as const;

  const tooltip = (
    <Tooltip
      cursor={kind === 'line' ? { stroke: c.hint, strokeWidth: 1, strokeDasharray: '3 3' } : { fill: c.card2 }}
      isAnimationActive={false}
      content={(p) => {
        const d = p.payload?.[0]?.payload as ChartDatum | undefined;
        if (!p.active || !d) return null;
        return (
          <div className="chart-tip">
            <span className="chart-tip-label">{d.tip ?? d.label}</span>
            <span className="chart-tip-value">
              {fmtNum(d.value)} {unit}
            </span>
          </div>
        );
      }}
    />
  );

  const xAxis = (
    <XAxis
      dataKey="key"
      {...axisProps}
      tickFormatter={(k: string) => labelOf.get(k) ?? ''}
      interval="preserveStartEnd"
      minTickGap={18}
      tickMargin={8}
    />
  );
  const yAxis = (
    <YAxis
      {...axisProps}
      width={44}
      tickCount={4}
      tickFormatter={axisFormat}
      domain={kind === 'line' ? ['auto', 'auto'] : [0, 'auto']}
      allowDecimals={false}
    />
  );
  const grid = <CartesianGrid vertical={false} stroke={c.line} />;

  return (
    <div className="chart" role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height={height}>
        {kind === 'line' ? (
          <LineChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
            {grid}
            {xAxis}
            {yAxis}
            {tooltip}
            <Line
              type="linear"
              dataKey="value"
              stroke={c.accent}
              strokeWidth={2}
              dot={{ r: 4, fill: c.accent, stroke: c.card, strokeWidth: 2 }}
              activeDot={{ r: 6, fill: c.accent, stroke: c.card, strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        ) : (
          <BarChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
            {grid}
            {xAxis}
            {yAxis}
            {tooltip}
            <Bar dataKey="value" fill={c.accent} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
