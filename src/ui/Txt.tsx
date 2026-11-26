import { Text, type TextProps, type TextStyle } from 'react-native';
import { C, F } from './theme';

type Weight = 'regular' | 'medium' | 'semibold' | 'bold' | 'heavy';

type Props = TextProps & {
  size?: number;
  weight?: Weight;
  /** Bricolage Grotesque for headings and big times. */
  display?: boolean;
  color?: string;
  align?: TextStyle['textAlign'];
  /** Line height as a multiple of size. Defaults keep big text from clipping. */
  lh?: number;
};

const FAMILY: Record<Weight, string> = {
  regular: F.regular,
  medium: F.medium,
  semibold: F.semibold,
  bold: F.bold,
  heavy: F.heavy,
};

export function Txt({ size = 15, weight = 'regular', display, color = C.ink, align, lh, style, ...rest }: Props) {
  const family = display ? (weight === 'heavy' ? F.displayHeavy : F.display) : FAMILY[weight];
  const lineHeight = Math.round(size * (lh ?? (display ? 1.15 : 1.38)));
  return (
    <Text
      {...rest}
      style={[{ fontFamily: family, fontSize: size, lineHeight, color, textAlign: align }, style]}
    />
  );
}
