import { memo, useMemo } from "react";
import { View } from "react-native";
import Svg, { Path, Defs, LinearGradient, Stop } from "react-native-svg";
import * as shape from "d3-shape";

interface Props {
  data: number[];
  width: number;
  height: number;
  color?: string;
  fill?: string;
}

function SparklineImpl({ data, width, height, color = "#FB7185", fill = "rgba(251,113,133,0.15)" }: Props) {
  const { line, area } = useMemo(() => {
    if (data.length < 2) return { line: "", area: "" };
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    const stepX = width / (data.length - 1);
    const points = data.map((v, i): [number, number] => [i * stepX, height - ((v - min) / range) * height]);
    const lineGen = shape.line<[number, number]>()
      .x((d) => d[0])
      .y((d) => d[1])
      .curve(shape.curveMonotoneX);
    const areaGen = shape.area<[number, number]>()
      .x((d) => d[0])
      .y0(height)
      .y1((d) => d[1])
      .curve(shape.curveMonotoneX);
    return { line: lineGen(points) ?? "", area: areaGen(points) ?? "" };
  }, [data, width, height]);

  return (
    <View>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={fill} stopOpacity="1" />
            <Stop offset="1" stopColor={fill} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Path d={area} fill="url(#grad)" />
        <Path d={line} stroke={color} strokeWidth={2} fill="none" />
      </Svg>
    </View>
  );
}

export const Sparkline = memo(SparklineImpl);
