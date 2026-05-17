import { memo } from "react";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";

interface Props {
  kind: "clipboard" | "briefcase";
  size?: number;
}

function ClipboardSketch({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <Defs>
        <LinearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#8B5CF6" />
          <Stop offset="1" stopColor="#F97316" />
        </LinearGradient>
      </Defs>
      <Path
        d="M50 40 H140 V170 H50 Z"
        stroke="url(#g1)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <Path d="M80 30 H110 V50 H80 Z" stroke="url(#g1)" strokeWidth="2" />
      <Path d="M55 75 L40 105 L65 95 Z" stroke="url(#g1)" strokeWidth="2" fill="none" />
      <Path d="M140 170 L160 150 L140 150 Z" stroke="url(#g1)" strokeWidth="2" />
      {[90, 105, 120, 135].map((y) => (
        <Path key={y} d={`M55 ${y + 80} L120 ${y + 80}`} stroke="url(#g1)" strokeWidth="1" opacity="0.5" />
      ))}
    </Svg>
  );
}

function BriefcaseSketch({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <Defs>
        <LinearGradient id="g2" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#8B5CF6" />
          <Stop offset="1" stopColor="#F97316" />
        </LinearGradient>
      </Defs>
      <Rect x="40" y="80" width="120" height="80" stroke="url(#g2)" strokeWidth="2" fill="none" />
      <Path d="M70 80 V60 H130 V80" stroke="url(#g2)" strokeWidth="2" />
      <Path d="M40 160 L155 50" stroke="url(#g2)" strokeWidth="1" opacity="0.5" />
      <Path d="M40 80 L155 50" stroke="url(#g2)" strokeWidth="2" />
      <Path d="M155 50 V130" stroke="url(#g2)" strokeWidth="2" />
      <Path d="M155 130 L160 160" stroke="url(#g2)" strokeWidth="2" />
    </Svg>
  );
}

function SketchIllustrationImpl({ kind, size = 220 }: Props) {
  if (kind === "clipboard") return <ClipboardSketch size={size} />;
  return <BriefcaseSketch size={size} />;
}

export const SketchIllustration = memo(SketchIllustrationImpl);
