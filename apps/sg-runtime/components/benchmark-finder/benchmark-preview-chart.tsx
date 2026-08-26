'use client'

import { resolveNiceScaleDomain } from '@/lib/benchmark/chart-scale'
import type { BenchmarkPreviewPoint } from '@/lib/benchmark/contracts'

type BenchmarkPreviewChartProps = {
  points: BenchmarkPreviewPoint[]
  locale: 'pl' | 'en'
}

const WIDTH = 760
const HEIGHT = 260
const PADDING_LEFT = 56
const PADDING_RIGHT = 20
const PADDING_TOP = 20
const PADDING_BOTTOM = 34

function formatDate(locale: 'pl' | 'en', value: string) {
  return new Intl.DateTimeFormat(locale === 'pl' ? 'pl-PL' : 'en-US', {
    year: '2-digit',
    month: 'short',
  }).format(new Date(value))
}

function formatNumber(locale: 'pl' | 'en', value: number) {
  return new Intl.NumberFormat(locale === 'pl' ? 'pl-PL' : 'en-US', {
    maximumFractionDigits: 2,
  }).format(value)
}

export function BenchmarkPreviewChart({ points, locale }: BenchmarkPreviewChartProps) {
  const validPoints = points.filter((point) => point.value !== null)

  if (validPoints.length < 2) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
        {locale === 'pl' ? 'Za mało punktów, aby narysować wykres.' : 'Not enough points to render the chart.'}
      </div>
    )
  }

  const chartWidth = WIDTH - PADDING_LEFT - PADDING_RIGHT
  const chartHeight = HEIGHT - PADDING_TOP - PADDING_BOTTOM
  const scale = resolveNiceScaleDomain(validPoints.map((point) => point.value as number))
  const dates = validPoints.map((point) => point.date)
  const minDate = new Date(dates[0]).getTime()
  const maxDate = new Date(dates[dates.length - 1]).getTime()
  const dateSpan = Math.max(maxDate - minDate, 1)
  const ySpan = Math.max(scale.maximum - scale.minimum, 1)

  const toX = (date: string) => PADDING_LEFT + ((new Date(date).getTime() - minDate) / dateSpan) * chartWidth
  const toY = (value: number) => PADDING_TOP + chartHeight - ((value - scale.minimum) / ySpan) * chartHeight

  const path = validPoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${toX(point.date).toFixed(2)} ${toY(point.value as number).toFixed(2)}`)
    .join(' ')

  const tickDates = Array.from({ length: 5 }, (_, index) => {
    const point = validPoints[Math.min(validPoints.length - 1, Math.floor((index / 4) * (validPoints.length - 1)))]
    return point.date
  })

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-64 w-full overflow-visible rounded-xl border border-slate-200 bg-white">
      {scale.ticks.map((tick) => {
        const y = PADDING_TOP + chartHeight - tick.offset * chartHeight
        return (
          <g key={tick.value}>
            <line x1={PADDING_LEFT} x2={WIDTH - PADDING_RIGHT} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="4 4" />
            <text x={PADDING_LEFT - 10} y={y + 4} textAnchor="end" className="fill-slate-500 text-[11px]">
              {formatNumber(locale, tick.value)}
            </text>
          </g>
        )
      })}

      {tickDates.map((date, index) => {
        const x = PADDING_LEFT + (index / 4) * chartWidth
        return (
          <g key={date}>
            <line x1={x} x2={x} y1={PADDING_TOP} y2={PADDING_TOP + chartHeight} stroke="#f1f5f9" />
            <text x={x} y={HEIGHT - 8} textAnchor="middle" className="fill-slate-500 text-[11px]">
              {formatDate(locale, date)}
            </text>
          </g>
        )
      })}

      <path d={path} fill="none" stroke="#0f766e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

      {validPoints.map((point) => (
        <circle key={point.date} cx={toX(point.date)} cy={toY(point.value as number)} r="2.5" fill="#134e4a" />
      ))}
    </svg>
  )
}