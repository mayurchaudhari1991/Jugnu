import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import type { ItemIcon, RoutineIcon } from '@/core/types';

type P = { size?: number; color?: string; stroke?: number };

const UI: Record<string, React.ReactNode> = {
  bell: (
    <>
      <Path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <Path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </>
  ),
  check: <Path d="M20 6 9 17l-5-5" />,
  plus: <Path d="M12 5v14M5 12h14" />,
  minus: <Path d="M5 12h14" />,
  chevL: <Path d="m15 18-6-6 6-6" />,
  chevR: <Path d="m9 18 6-6-6-6" />,
  chevD: <Path d="m6 9 6 6 6-6" />,
  clock: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 7v5l3 2" />
    </>
  ),
  trash: <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />,
  today: (
    <>
      <Rect x="3" y="4" width="18" height="18" rx="3" />
      <Path d="M16 2v4M8 2v4M3 10h18" />
      <Path d="m9 16 2 2 4-4" />
    </>
  ),
  routines: (
    <>
      <Path d="M9 6h12M9 12h12M9 18h12" />
      <Circle cx="4.5" cy="6" r="1.2" />
      <Circle cx="4.5" cy="12" r="1.2" />
      <Circle cx="4.5" cy="18" r="1.2" />
    </>
  ),
  history: <Path d="M3 3v18h18M8 17v-5M13 17V8M18 17v-9" />,
  settings: <Path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />,
  x: <Path d="M18 6 6 18M6 6l12 12" />,
  edit: <Path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />,
  up: <Path d="M12 19V5M5 12l7-7 7 7" />,
  down: <Path d="M12 5v14M19 12l-7 7-7-7" />,
  skip: (
    <>
      <Path d="m5 4 10 8-10 8V4z" />
      <Path d="M19 5v14" />
    </>
  ),
  snooze: (
    <>
      <Circle cx="12" cy="13" r="8" />
      <Path d="M12 9v4l2 2M5 3 2 6M22 6l-3-3" />
    </>
  ),
  alert: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 8v4M12 16h.01" />
    </>
  ),
  sound: <Path d="M11 5 6 9H2v6h4l5 4V5zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />,
  battery: (
    <>
      <Rect x="2" y="7" width="16" height="10" rx="2" />
      <Path d="M22 11v2M6 11v2M10 11v2" />
    </>
  ),
  shield: <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  calendar: (
    <>
      <Rect x="3" y="4" width="18" height="18" rx="3" />
      <Path d="M16 2v4M8 2v4M3 10h18" />
    </>
  ),
  repeat: <Path d="m17 2 4 4-4 4M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4M21 13v1a4 4 0 0 1-4 4H3" />,
  info: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 16v-4M12 8h.01" />
    </>
  ),
  pause: <Path d="M8 5v14M16 5v14" />,
};

export type UIIconName = keyof typeof UI;

export function Icon({ name, size = 22, color = '#12172A', stroke = 2 }: P & { name: UIIconName }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      {UI[name]}
    </Svg>
  );
}

const ITEM: Record<ItemIcon, React.ReactNode> = {
  pills: (
    <>
      <Circle cx="8" cy="9" r="3" />
      <Circle cx="16" cy="9" r="3" />
      <Circle cx="12" cy="16" r="3" />
    </>
  ),
  drops: <Path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />,
  tablet: (
    <>
      <Ellipse cx="12" cy="9.5" rx="8" ry="4.5" />
      <Path d="M4 9.5v4c0 2.5 3.6 4.5 8 4.5s8-2 8-4.5v-4M9 8l6 3" />
    </>
  ),
  capsule: <Path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7ZM8.5 8.5l7 7" />,
  hair: <Path d="M10 2h4M12 2v3M8 9a4 4 0 0 1 8 0v11a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2ZM8 13h8" />,
  task: (
    <>
      <Rect x="3" y="3" width="18" height="18" rx="4" />
      <Path d="m8 12 3 3 5-6" />
    </>
  ),
  gym: <Path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12" />,
  water: <Path d="M6 3h12l-1.5 17a2 2 0 0 1-2 1.8h-5a2 2 0 0 1-2-1.8zM6.5 9h11" />,
  bill: <Path d="M5 3v18l2.5-1.5L10 21l2-1.5 2 1.5 2.5-1.5L19 21V3l-2.5 1.5L14 3l-2 1.5L10 3 7.5 4.5zM9 9h6M9 13h6" />,
  book: <Path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" />,
  phone: (
    <Path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
  ),
  walk: (
    <Path d="M4 16v-2.4C4 11.5 3 10.5 3 8c0-2.7 1.5-6 4.5-6C9.4 2 10 3.8 10 5.5c0 3.1-2 5.7-2 8.7V16a2 2 0 1 1-4 0ZM20 20v-2.4c0-2.1 1-3.1 1-5.6 0-2.7-1.5-6-4.5-6C14.6 6 14 7.8 14 9.5c0 3.1 2 5.7 2 8.7V20a2 2 0 1 0 4 0Z" />
  ),
  cake: <Path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1M2 21h20M7 8v3M12 8v3M17 8v3M7 4h.01M12 4h.01M17 4h.01" />,
  bell: UI.bell,
};

export function ItemGlyph({ icon, size = 22, color = '#12172A', stroke = 2 }: P & { icon: ItemIcon }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      {ITEM[icon] ?? ITEM.bell}
    </Svg>
  );
}

const ROUTINE: Record<RoutineIcon, React.ReactNode> = {
  sunrise: <Path d="M12 2v6M4.93 10.93l1.41 1.41M2 18h2M20 18h2M19.07 10.93l-1.41 1.41M22 22H2M8 6l4-4 4 4M16 18a4 4 0 0 0-8 0" />,
  sun: (
    <>
      <Circle cx="12" cy="12" r="4" />
      <Path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </>
  ),
  sunset: <Path d="M12 10V2M4.93 10.93l1.41 1.41M2 18h2M20 18h2M19.07 10.93l-1.41 1.41M22 22H2M16 6l-4 4-4-4M16 18a4 4 0 0 0-8 0" />,
  moon: <Path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />,
  bolt: <Path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />,
  heart: <Path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z" />,
  star: <Path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" />,
  bell: UI.bell,
};

export function RoutineGlyph({ icon, size = 20, color = '#12172A', stroke = 2 }: P & { icon: RoutineIcon }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">
      {ROUTINE[icon] ?? ROUTINE.bell}
    </Svg>
  );
}

/** The Jugnu mark: a firefly whose dotted flight path draws a tick. */
export function JugnuMark({ size = 64, background = true }: { size?: number; background?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="18 18 72 72">
      {background ? <Rect x="18" y="18" width="72" height="72" fill="#0F1A3C" /> : null}
      <Circle cx="30" cy="32" r="0.8" fill="#FFFFFF" opacity={0.55} />
      <Circle cx="40" cy="26" r="0.6" fill="#FFFFFF" opacity={0.45} />
      <Circle cx="78" cy="68" r="0.7" fill="#FFFFFF" opacity={0.5} />
      <Circle cx="34" cy="76" r="0.8" fill="#FFFFFF" opacity={0.45} />
      <Path
        d="M34 58 L44.5 68.5 L62 51"
        fill="none"
        stroke="#FFE45C"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="0.1 4.4"
      />
      <Circle cx="62.5" cy="50.5" r="14" fill="#FFE45C" opacity={0.08} />
      <Circle cx="62.5" cy="50.5" r="9" fill="#FFE45C" opacity={0.16} />
      <G transform="translate(66 47) rotate(-45)">
        <Ellipse cx="-1" cy="-3.4" rx="4.8" ry="2.2" fill="#FFFFFF" opacity={0.55} transform="rotate(-20 -1 -3.4)" />
        <Ellipse cx="-1" cy="3.4" rx="4.8" ry="2.2" fill="#FFFFFF" opacity={0.55} transform="rotate(20 -1 3.4)" />
        <Ellipse cx="-5" cy="0" rx="4.6" ry="3.6" fill="#FFE45C" />
        <Ellipse cx="0.6" cy="0" rx="3" ry="2.6" fill="#FF8A3D" />
        <Circle cx="3.9" cy="0" r="1.8" fill="#2A2F55" />
        <Path d="M4.8 -0.9 L7.6 -3.2 M4.8 0.9 L7.6 3.2" fill="none" stroke="#FFD7A8" strokeWidth={0.8} strokeLinecap="round" />
      </G>
    </Svg>
  );
}
