import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

// The logo's tick, in its 72-unit artboard (viewBox starts at 18,18): down-right, then up-right.
const P0 = { x: 34, y: 58 };
const P1 = { x: 44.5, y: 68.5 };
const P2 = { x: 62, y: 51 };
const BEND = 14.85 / (14.85 + 24.75); // share of the path before the corner
const DOTS = 10;

function pointAt(t: number) {
  if (t <= BEND) {
    const u = t / BEND;
    return { x: P0.x + (P1.x - P0.x) * u, y: P0.y + (P1.y - P0.y) * u };
  }
  const u = (t - BEND) / (1 - BEND);
  return { x: P1.x + (P2.x - P1.x) * u, y: P1.y + (P2.y - P1.y) * u };
}

/** The firefly, facing right, centred on (0,0). */
function Firefly({ size }: { size: number }) {
  return (
    <Svg width={size} height={size * 0.8} viewBox="-10 -8 20 16">
      <Ellipse cx="-1" cy="-3.4" rx="4.8" ry="2.2" fill="#FFFFFF" opacity={0.6} transform="rotate(-20 -1 -3.4)" />
      <Ellipse cx="-1" cy="3.4" rx="4.8" ry="2.2" fill="#FFFFFF" opacity={0.6} transform="rotate(20 -1 3.4)" />
      <Ellipse cx="-5" cy="0" rx="4.6" ry="3.6" fill="#FFE45C" />
      <Ellipse cx="0.6" cy="0" rx="3" ry="2.6" fill="#FF8A3D" />
      <Circle cx="3.9" cy="0" r="1.8" fill="#2A2F55" />
      <Path d="M4.8 -0.9 L7.6 -3.2 M4.8 0.9 L7.6 3.2" fill="none" stroke="#FFD7A8" strokeWidth={0.8} strokeLinecap="round" />
    </Svg>
  );
}

/**
 * Jugnu's logo, alive: the firefly flies along its dotted tick, lighting each dot as it passes,
 * while its glow blinks. Used while Jugnu AI is working.
 */
export function FireflyLoader({ size = 128 }: { size?: number }) {
  const k = size / 72;
  const px = (v: number) => (v - 18) * k;
  const progress = useRef(new Animated.Value(0)).current;
  const blink = useRef(new Animated.Value(0)).current;
  const flutter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const fly = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, { toValue: 1, duration: 2300, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.delay(700),
        Animated.timing(progress, { toValue: 1.15, duration: 350, useNativeDriver: true }), // trail fades out
        Animated.timing(progress, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    const glow = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 1, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(blink, { toValue: 0.25, duration: 520, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    );
    const wings = Animated.loop(
      Animated.sequence([
        Animated.timing(flutter, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.timing(flutter, { toValue: 0, duration: 90, useNativeDriver: true }),
      ]),
    );
    fly.start();
    glow.start();
    wings.start();
    return () => {
      fly.stop();
      glow.stop();
      wings.stop();
    };
  }, [progress, blink, flutter]);

  const clamp = { extrapolate: 'clamp' as const };
  const x = progress.interpolate({ inputRange: [0, BEND, 1, 1.15], outputRange: [px(P0.x), px(P1.x), px(P2.x), px(P2.x)], ...clamp });
  const y = progress.interpolate({ inputRange: [0, BEND, 1, 1.15], outputRange: [px(P0.y), px(P1.y), px(P2.y), px(P2.y)], ...clamp });
  const rotate = progress.interpolate({ inputRange: [0, BEND - 0.03, BEND + 0.03, 1], outputRange: ['45deg', '45deg', '-45deg', '-45deg'], ...clamp });
  const trailFade = progress.interpolate({ inputRange: [0, 1, 1.15], outputRange: [1, 1, 0], ...clamp });
  const flySize = 20 * k * 0.9;
  const glowSize = 22 * k;

  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.22, backgroundColor: '#0F1A3C', overflow: 'hidden' }} accessibilityRole="progressbar" accessibilityLabel="Jugnu AI is working">
      {/* stars */}
      <Svg width={size} height={size} viewBox="18 18 72 72" style={{ position: 'absolute' }}>
        <Circle cx="30" cy="32" r="0.8" fill="#FFFFFF" opacity={0.55} />
        <Circle cx="40" cy="26" r="0.6" fill="#FFFFFF" opacity={0.45} />
        <Circle cx="78" cy="68" r="0.7" fill="#FFFFFF" opacity={0.5} />
        <Circle cx="34" cy="76" r="0.8" fill="#FFFFFF" opacity={0.45} />
        <Circle cx="74" cy="30" r="0.6" fill="#FFFFFF" opacity={0.4} />
      </Svg>

      {/* dotted trail: each dot lights up as the firefly passes it */}
      {Array.from({ length: DOTS }, (_, i) => {
        const t = i / (DOTS - 1);
        const p = pointAt(t);
        const d = 2.4 * k;
        const lit = progress.interpolate({ inputRange: [Math.max(0, t - 0.02), t + 0.001], outputRange: [0, 1], ...clamp });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: px(p.x) - d / 2,
              top: px(p.y) - d / 2,
              width: d,
              height: d,
              borderRadius: d / 2,
              backgroundColor: '#FFE45C',
              opacity: Animated.multiply(lit, trailFade),
            }}
          />
        );
      })}

      {/* glow + firefly, moving together */}
      <Animated.View style={{ position: 'absolute', left: 0, top: 0, transform: [{ translateX: x }, { translateY: y }] }}>
        <Animated.View
          style={{
            position: 'absolute',
            left: -glowSize / 2,
            top: -glowSize / 2,
            width: glowSize,
            height: glowSize,
            borderRadius: glowSize / 2,
            backgroundColor: '#FFE45C',
            opacity: blink.interpolate({ inputRange: [0, 1], outputRange: [0.06, 0.32] }),
            transform: [{ scale: blink.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1.15] }) }],
          }}
        />
        <Animated.View
          style={{
            position: 'absolute',
            left: -flySize / 2,
            top: -(flySize * 0.8) / 2,
            transform: [{ rotate }, { scaleY: flutter.interpolate({ inputRange: [0, 1], outputRange: [1, 0.86] }) }],
          }}
        >
          <Firefly size={flySize} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}
