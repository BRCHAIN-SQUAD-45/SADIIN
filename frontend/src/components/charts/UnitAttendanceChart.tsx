import { Bar, BarChart, Cell, Tooltip, XAxis } from 'recharts';
import { mapAttendanceHistoryToChartView } from '../../api/mappers';
import type { AttendanceHistory } from '../../api/types';
import { ProvenanceTags } from '../ui/States';

interface UnitAttendanceChartProps {
  history: AttendanceHistory;
  hoveredDay: string | null;
  onHoverDay: (day: string | null) => void;
}

/**
 * Gráfico de barras diário de atendimentos da UBS (Issues #20 e #21 — US-04.4).
 * Utiliza a biblioteca Recharts mantendo a identidade visual do protótipo e a
 * camada de acessibilidade por teclado/leitor de tela.
 */
export function UnitAttendanceChart({ history, hoveredDay, onHoverDay }: UnitAttendanceChartProps) {
  const chart = mapAttendanceHistoryToChartView(history);

  return (
    <>
      <div className="recharts-flow-wrapper" aria-label="Gráfico Recharts de atendimentos diários">
        <BarChart
          width={440}
          height={118}
          data={chart.bars}
          margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
        >
          <XAxis
            dataKey="weekdayLabel"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#6c8480', fontSize: 11, fontWeight: 700 }}
          />
          <Tooltip
            cursor={{ fill: '#eef5f3' }}
            formatter={(value: number) => [`${value} atendimentos`, 'Volume diário']}
            contentStyle={{
              borderRadius: 7,
              border: '1px solid #dce8e5',
              fontSize: 12,
              fontWeight: 600,
            }}
          />
          <Bar dataKey="attendances" radius={[6, 6, 3, 3]} maxBarSize={36}>
            {chart.bars.map((entry) => (
              <Cell key={entry.date} fill={hoveredDay === entry.date ? '#087e70' : '#2aa691'} />
            ))}
          </Bar>
        </BarChart>
      </div>

      <div className="flow-chart" role="list" aria-label="Atendimentos nos últimos 7 dias">
        {chart.bars.map((d) => {
          const isHovered = hoveredDay === d.date;
          return (
            <div
              key={d.date}
              role="listitem"
              tabIndex={0}
              className="flow-bar"
              title={`${d.weekdayLabel}: ${d.attendances} atendimentos`}
              aria-label={d.ariaLabel}
              onMouseEnter={() => onHoverDay(d.date)}
              onMouseLeave={() => onHoverDay(null)}
              onFocus={() => onHoverDay(d.date)}
              onBlur={() => onHoverDay(null)}
            >
              <span>{isHovered ? `${d.attendances} atend.` : d.attendances}</span>
              <div>
                <i style={{ height: `${d.heightPct}%` }} />
              </div>
              <small>{d.weekdayLabel}</small>
            </div>
          );
        })}
      </div>

      <div className="chart-summary">
        <span>
          <i /> {chart.totalFormatted} atendimentos na semana <ProvenanceTags meta={history.meta} />
        </span>
        <strong>
          {chart.dailyAverageFormatted} <small>média por dia</small>
        </strong>
      </div>
    </>
  );
}
