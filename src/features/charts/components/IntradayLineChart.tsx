import { memo, useMemo } from "react";
import { View } from "react-native";
import Svg, {
  Defs,
  LinearGradient,
  Line,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import * as shape from "d3-shape";
import { colors } from "@shared/theme";

interface Props {
  data: number[];
  width: number;
  height: number;
  // First-tick + last-tick wall-clock timestamps (ms). Used to label the
  // bottom axis. If omitted, the chart draws without time labels.
  startTs?: number;
  endTs?: number;
  // Stroke + fill color — defaults to the buy/sell sign of the series.
  color?: string;
}

const RIGHT_GUTTER = 56;
const BOTTOM_GUTTER = 26;
const TOP_PAD = 16;
const LEFT_PAD = 4;

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}

function IntradayLineChartImpl({
  data,
  width,
  height,
  startTs,
  endTs,
  color,
}: Props) {
  const plot = useMemo(() => {
    if (data.length < 2) return null;
    const max = Math.max(...data);
    const min = Math.min(...data);
    const pad = (max - min) * 0.1 || max * 0.001 || 1;
    const yMin = min - pad;
    const yMax = max + pad;
    const range = yMax - yMin;

    const plotW = width - RIGHT_GUTTER - LEFT_PAD;
    const plotH = height - BOTTOM_GUTTER - TOP_PAD;
    const stepX = plotW / (data.length - 1);

    const points = data.map((v, i): [number, number] => [
      LEFT_PAD + i * stepX,
      TOP_PAD + plotH - ((v - yMin) / range) * plotH,
    ]);
    const lineGen = shape
      .line<[number, number]>()
      .x((d) => d[0])
      .y((d) => d[1])
      .curve(shape.curveMonotoneX);
    const areaGen = shape
      .area<[number, number]>()
      .x((d) => d[0])
      .y0(TOP_PAD + plotH)
      .y1((d) => d[1])
      .curve(shape.curveMonotoneX);

    // Three evenly-spaced grid lines + Y-axis labels. Rounded to a
    // sensible step so the labels don't look like 23583.27 — pick the
    // nearest power of ten that gives 2-3 sigfig labels.
    const ticks = [yMax, (yMax + yMin) / 2, yMin];
    const labelFor = (v: number) => {
      if (Math.abs(v) >= 1000) return Math.round(v).toLocaleString("en-IN");
      if (Math.abs(v) >= 10) return v.toFixed(1);
      return v.toFixed(2);
    };

    const lastPt = points[points.length - 1]!;
    const lastVal = data[data.length - 1]!;

    return {
      line: lineGen(points) ?? "",
      area: areaGen(points) ?? "",
      plotH,
      plotW,
      ticks,
      labelFor,
      lastPt,
      lastVal,
      yMin,
      yMax,
    };
  }, [data, width, height]);

  if (!plot) {
    return (
      <View
        style={{
          height,
          width,
          borderRadius: 12,
          backgroundColor: colors.bgElevated,
        }}
      />
    );
  }

  const stroke =
    color ?? (data[data.length - 1]! >= data[0]! ? colors.buy : colors.sell);
  const fillId = "intraday-area";

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={stroke} stopOpacity="0.30" />
            <Stop offset="1" stopColor={stroke} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Horizontal dashed grid lines + right-side y-axis labels */}
        {plot.ticks.map((v, i) => {
          const y =
            TOP_PAD + plot.plotH - ((v - plot.yMin) / (plot.yMax - plot.yMin)) * plot.plotH;
          return (
            <Line
              key={`grid-${i}`}
              x1={LEFT_PAD}
              x2={width - RIGHT_GUTTER}
              y1={y}
              y2={y}
              stroke={colors.border}
              strokeDasharray="3 6"
              strokeWidth={1}
            />
          );
        })}
        {plot.ticks.map((v, i) => {
          const y =
            TOP_PAD + plot.plotH - ((v - plot.yMin) / (plot.yMax - plot.yMin)) * plot.plotH;
          return (
            <SvgText
              key={`yl-${i}`}
              x={width - RIGHT_GUTTER + 6}
              y={y + 4}
              fill={colors.textMuted}
              fontSize={10}
            >
              {plot.labelFor(v)}
            </SvgText>
          );
        })}

        {/* Area + line */}
        <Path d={plot.area} fill={`url(#${fillId})`} />
        <Path
          d={plot.line}
          stroke={stroke}
          strokeWidth={2}
          fill="none"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Current-price pill anchored to the last point */}
        <Rect
          x={Math.min(plot.lastPt[0] + 6, width - 56)}
          y={plot.lastPt[1] - 10}
          width={50}
          height={20}
          rx={4}
          fill={stroke}
        />
        <SvgText
          x={Math.min(plot.lastPt[0] + 6, width - 56) + 25}
          y={plot.lastPt[1] + 4}
          fill="#fff"
          fontSize={11}
          fontWeight="700"
          textAnchor="middle"
        >
          {plot.labelFor(plot.lastVal)}
        </SvgText>

        {/* X-axis labels */}
        {startTs ? (
          <SvgText
            x={LEFT_PAD + 2}
            y={height - 8}
            fill={colors.textMuted}
            fontSize={10}
          >
            {fmtTime(startTs)}
          </SvgText>
        ) : null}
        {endTs ? (
          <SvgText
            x={width - RIGHT_GUTTER}
            y={height - 8}
            fill={colors.textMuted}
            fontSize={10}
            textAnchor="end"
          >
            {fmtTime(endTs)}
          </SvgText>
        ) : null}
        {endTs ? (
          <SvgText
            x={(LEFT_PAD + (width - RIGHT_GUTTER)) / 2}
            y={height - 8}
            fill={colors.textMuted}
            fontSize={10}
            textAnchor="middle"
          >
            {fmtDate(endTs)}
          </SvgText>
        ) : null}
      </Svg>
    </View>
  );
}

export const IntradayLineChart = memo(IntradayLineChartImpl);
