import {
  Chart,
  ChartAxis,
  ChartGroup,
  ChartLine,
  ChartLegend,
  ChartThemeColor,
  ChartCursorTooltip,
  createContainer,
} from '@patternfly/react-charts/victory'
import { Card, CardBody, CardTitle } from '@patternfly/react-core'

// Prometheus matrix result structure
export interface PrometheusMetric {
  [key: string]: string
}

export interface PrometheusMatrixResult {
  metric: PrometheusMetric
  values: [number, string][] // [timestamp, value]
}

export interface PrometheusData {
  resultType: 'matrix' | 'vector' | 'scalar' | 'string'
  result: PrometheusMatrixResult[]
}

export interface PrometheusMetadata {
  timestamp?: number
  source?: string
  result_type?: string
  description?: string
  query?: string
}

export interface PrometheusToolResult {
  title?: string
  query?: string
  data: PrometheusData
  metadata?: PrometheusMetadata
}

interface TimeSeriesChartProps {
  data: PrometheusToolResult
}

// Generate a label for a metric based on its labels
function getSeriesLabel(metric: PrometheusMetric, index: number): string {
  // If metric is empty or undefined, return descriptive fallback
  if (!metric || Object.keys(metric).length === 0) {
    return '(unlabeled)'
  }

  // Try common identifying labels in order of preference
  const labelPriority = ['pod', 'container', 'namespace', 'node', 'instance', 'job', 'name', 'id']

  for (const label of labelPriority) {
    if (metric[label]) {
      // For node/instance, extract a shorter name if possible
      if (label === 'node' || label === 'instance') {
        const value = metric[label]
        // Extract hostname or IP without domain/port
        const match = value.match(/^([^.:]+)/)
        if (match) return match[1]
      }
      return metric[label]
    }
  }

  // If no priority labels found, use the first available label value
  const firstLabel = Object.entries(metric).find(([key]) => key !== '__name__')
  if (firstLabel) {
    return firstLabel[1]
  }

  // Last fallback to series index
  return `Series ${index + 1}`
}

// Format timestamp for display
function formatTime(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// Format value for tooltip
function formatValue(value: number): string {
  if (value >= 1) {
    return value.toFixed(2)
  }
  return value.toPrecision(3)
}

export function TimeSeriesChart({ data }: TimeSeriesChartProps) {
  const { data: prometheusData, title, query } = data

  // Only support matrix type
  if (prometheusData.resultType !== 'matrix' || !prometheusData.result?.length) {
    return (
      <Card isCompact>
        <CardBody>No time series data available</CardBody>
      </Card>
    )
  }

  const results = prometheusData.result

  // Transform Prometheus data to chart format
  // Each series becomes a line
  const chartData = results.map((series, seriesIndex) => {
    const label = getSeriesLabel(series.metric, seriesIndex)
    return {
      label,
      data: series.values.map(([timestamp, value]) => ({
        x: timestamp,
        y: parseFloat(value),
        name: label,
      })),
    }
  })

  // Calculate domain
  const allTimestamps = results.flatMap((s) => s.values.map(([t]) => t))
  const allValues = results.flatMap((s) => s.values.map(([, v]) => parseFloat(v)))

  const xDomain: [number, number] = [Math.min(...allTimestamps), Math.max(...allTimestamps)]
  const yMin = Math.min(...allValues)
  const yMax = Math.max(...allValues)
  const yPadding = (yMax - yMin) * 0.1 || 0.1
  const yDomain: [number, number] = [Math.max(0, yMin - yPadding), yMax + yPadding]

  // Create x-axis tick values (5-7 ticks)
  const xRange = xDomain[1] - xDomain[0]
  const tickInterval = xRange / 5
  const xTickValues: number[] = []
  for (let i = 0; i <= 5; i++) {
    xTickValues.push(xDomain[0] + i * tickInterval)
  }

  // Legend data for tooltip
  const legendData = chartData.map((series) => ({
    name: series.label,
  }))

  // Create combined cursor + voronoi container for tooltip interaction
  const CursorVoronoiContainer = createContainer('voronoi', 'cursor')

  // Calculate legend height based on number of items (for proper chart sizing)
  const legendItemsPerRow = 3
  const legendRows = Math.ceil(legendData.length / legendItemsPerRow)
  const legendHeight = legendRows * 25 + 10

  return (
    <Card isCompact style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
      {title && <CardTitle>{title}</CardTitle>}
      <CardBody>
        <div style={{ height: `${250 + legendHeight}px`, width: '100%' }}>
          <Chart
            ariaDesc={title || 'Time series chart'}
            ariaTitle={title || 'Metrics'}
            containerComponent={
              <CursorVoronoiContainer
                cursorDimension="x"
                voronoiDimension="x"
                voronoiPadding={50}
                mouseFollowTooltips
                labels={({ datum }: { datum: { name: string; y: number } }) =>
                  `${datum.name}: ${formatValue(datum.y)}`
                }
                labelComponent={
                  <ChartCursorTooltip />
                }
              />
            }
            domain={{ x: xDomain, y: yDomain }}
            height={250 + legendHeight}
            legendComponent={
              <ChartLegend
                data={legendData}
                itemsPerRow={legendItemsPerRow}
                orientation="horizontal"
              />
            }
            legendPosition="bottom"
            padding={{ top: 20, right: 20, bottom: 50 + legendHeight, left: 60 }}
            themeColor={ChartThemeColor.multi}
          >
            <ChartAxis
              tickValues={xTickValues}
              tickFormat={(t: number) => formatTime(t)}
              style={{
                tickLabels: { fontSize: 10, angle: -45, textAnchor: 'end' },
              }}
            />
            <ChartAxis
              dependentAxis
              tickFormat={(t: number) => formatValue(t)}
              style={{
                tickLabels: { fontSize: 10 },
              }}
            />
            <ChartGroup>
              {chartData.map((series, index) => (
                <ChartLine
                  key={index}
                  data={series.data}
                  name={series.label}
                />
              ))}
            </ChartGroup>
          </Chart>
        </div>
        {query && (
          <div style={{ fontSize: '0.75rem', color: 'var(--pf-t--global--text--color--subtle)', marginTop: '0.5rem' }}>
            Query: <code style={{ color: 'var(--pf-t--global--text--color--regular)' }}>{query}</code>
          </div>
        )}
      </CardBody>
    </Card>
  )
}
