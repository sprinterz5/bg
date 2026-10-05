import { Canvas, Fill, Group, ImageShader, Shader, Skia, makeImageFromView, type SkImage } from '@shopify/react-native-skia';
import { useMemo, type RefObject } from 'react';
import { StyleSheet, View } from 'react-native';
import { useDerivedValue, type DerivedValue, type SharedValue } from 'react-native-reanimated';

// Page turn: a snapshot of the page is wrapped around a cylinder lying on the screen (GPU shader).
// The fold line moves from the right edge to past the left one as `progress` goes 0 → 1; the lifted part
// rolls over the cylinder and lies flipped on top (paper back), the page underneath gets a soft shadow.

export const CURL_SUPPORTED = true;
export type Snapshot = SkImage;

/** Snapshot of a mounted view (null when it can't be taken). The view must have collapsable={false}. */
export async function snapshotView(ref: RefObject<View | null>): Promise<Snapshot | null> {
  try {
    return await makeImageFromView(ref as RefObject<View>);
  } catch {
    return null;
  }
}

export function disposeSnapshot(image: Snapshot) {
  image.dispose();
}

const SKSL = `
uniform shader image;
uniform float2 res;     // page size
uniform float2 origin;  // a point on the fold line
uniform float2 dir;     // unit vector from the fold towards the lifted edge
uniform float radius;   // cylinder radius
uniform float shadow;   // shadow strength on the page underneath

const float PI = 3.14159265;
const float SHADOW_W = 40.0;

// 1 inside the page, 0 outside, ~0.5pt antialiased edge.
float cover(float2 q) {
  float d = min(min(q.x, q.y), min(res.x - q.x, res.y - q.y));
  return clamp(d * 2.0 + 0.5, 0.0, 1.0);
}

half4 main(float2 p) {
  float d = dot(p - origin, dir);
  float2 base = p - dir * d;
  half4 color = half4(0.0);

  if (d < 0.0) {
    // Flat part, a little darker right next to the fold.
    float a = cover(p);
    float ao = 1.0 - 0.16 * smoothstep(-18.0, 0.0, d);
    color = half4(image.eval(p).rgb * ao, 1.0) * a;
  } else if (d < radius) {
    // Rising side of the roll, front face: darker as it turns away from the light.
    float th = asin(d / radius);
    float2 q = base + dir * (th * radius);
    float a = cover(q);
    float light = mix(1.0, cos(th), 0.55);
    color = half4(image.eval(q).rgb * light, 1.0) * a;
  } else {
    // Revealed page underneath: only the roll's shadow.
    float f = 1.0 - smoothstep(0.0, SHADOW_W, d - radius);
    return half4(0.0, 0.0, 0.0, 0.5 * shadow * f * f);
  }

  // Top layer: the back of the page, over the roll or lying flipped.
  float u = d >= 0.0 ? PI * radius - asin(d / radius) * radius : PI * radius - d;
  float2 q = base + dir * u;
  float a = cover(q);
  if (a > 0.0) {
    float th = u / radius;
    float light = th < PI ? mix(1.0, -cos(th), 0.5) : 1.0;
    float spec = th < PI ? 0.07 * exp(-pow((th - 2.25) / 0.3, 2.0)) : 0.0;
    half3 paper = mix(image.eval(q).rgb, half3(0.2), 0.8) * light + spec * 1.6;
    color = mix(color, half4(paper, 1.0), a);
  }
  return color;
}
`;

type Layer = { id: string; image: Snapshot };
type Uniforms = { res: number[]; origin: number[]; dir: number[]; radius: number; shadow: number };

type Props = {
  layers: Layer[];
  /** Id of the layer being turned; '' = nothing drawn. */
  active: SharedValue<string>;
  /** 0 = page flat, 1 = turned away. */
  progress: SharedValue<number>;
  /** Fold tilt in radians. */
  angle: SharedValue<number>;
  width: number;
  height: number;
};

export function PageCurlCanvas({ layers, active, progress, angle, width, height }: Props) {
  const effect = useMemo(() => Skia.RuntimeEffect.Make(SKSL), []);
  const uniforms = useDerivedValue((): Uniforms => {
    const c = Math.cos(angle.value);
    const s = Math.sin(angle.value);
    const t = Math.min(1, Math.max(0, progress.value));
    // Small roll at the ends, wider in the middle of the turn.
    const radius = width * (0.07 + 0.07 * Math.sin(Math.PI * t));
    // Fold far enough out at both ends that the tilted line misses the page.
    const slope = (height / 2) * Math.abs(s / c);
    const start = width + slope + 2;
    const end = -(width * 0.07) / c - slope - 2;
    return { res: [width, height], origin: [start + (end - start) * t, height / 2], dir: [c, s], radius, shadow: 1 - t };
  });

  if (!effect) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Canvas style={StyleSheet.absoluteFill}>
        {layers.map((l) => (
          <CurlLayer key={l.id} id={l.id} image={l.image} active={active} effect={effect} uniforms={uniforms} width={width} height={height} />
        ))}
      </Canvas>
    </View>
  );
}

function CurlLayer({
  id,
  image,
  active,
  effect,
  uniforms,
  width,
  height,
}: {
  id: string;
  image: Snapshot;
  active: SharedValue<string>;
  effect: NonNullable<ReturnType<typeof Skia.RuntimeEffect.Make>>;
  uniforms: DerivedValue<Uniforms>;
  width: number;
  height: number;
}) {
  const opacity = useDerivedValue(() => (active.value === id ? 1 : 0));
  return (
    <Group opacity={opacity}>
      <Fill>
        <Shader source={effect} uniforms={uniforms}>
          <ImageShader image={image} fit="fill" rect={{ x: 0, y: 0, width, height }} />
        </Shader>
      </Fill>
    </Group>
  );
}
