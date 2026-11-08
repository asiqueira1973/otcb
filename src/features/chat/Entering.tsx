import { useEffect, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

// A2: mensagem e card entram de baixo com leve mola (~300 ms); com "reduzir movimento", só opacidade
// (≤ 200 ms, 16.6). Não bloqueia toque. Recebe: filhos, estilo e se anima. Devolve: o contêiner animado.
export function Entering({ children, style, animate = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; animate?: boolean }) {
  const reduceMotion = useReducedMotion();
  const p = useSharedValue(animate ? 0 : 1);
  useEffect(() => {
    if (animate) p.value = reduceMotion ? withTiming(1, { duration: 200 }) : withSpring(1, { damping: 16, stiffness: 220 });
  }, [animate, reduceMotion, p]);
  const anim = useAnimatedStyle(() =>
    reduceMotion ? { opacity: p.value } : { opacity: Math.min(1, p.value * 2), transform: [{ translateY: (1 - p.value) * 24 }] },
  );
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}
