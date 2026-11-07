import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { fonts, useTheme } from './theme';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
};

const SHADOW = 5;

// Botão "gordinho" com sombra sólida (16.1 e 16.4) e animação A3: afunda na sombra ao tocar (~120 ms),
// com haptics leve (16.6). Com "reduzir movimento", vira só mudança de opacidade (seção 17).
// Recebe: rótulo, ação e variante. Devolve: o botão acessível com área de toque ≥ 44 pt.
export function Button({ label, onPress, variant = 'primary', disabled, loading, testID }: Props) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const pressed = useSharedValue(0);
  const inactive = disabled || loading;

  const faceStyle = useAnimatedStyle(() =>
    reduceMotion
      ? { opacity: 1 - pressed.value * 0.25 }
      : { transform: [{ translateY: pressed.value * SHADOW }] },
  );

  const isPrimary = variant === 'primary';

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPressIn={() => {
        pressed.value = withTiming(1, { duration: 60 });
      }}
      onPressOut={() => {
        pressed.value = withTiming(0, { duration: 60 });
      }}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={[styles.wrap, { opacity: inactive ? 0.55 : 1 }]}
    >
      {isPrimary && <Animated.View style={[styles.shadow, { backgroundColor: theme.primaryShadow }]} />}
      <Animated.View
        style={[
          styles.face,
          isPrimary
            ? { backgroundColor: theme.primary }
            : { backgroundColor: 'transparent', borderColor: theme.border, borderWidth: 2 },
          faceStyle,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={isPrimary ? theme.onPrimary : theme.text} />
        ) : (
          <Text style={[styles.label, { color: isPrimary ? theme.onPrimary : theme.text }]}>{label}</Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { minHeight: 56 + SHADOW, justifyContent: 'flex-start' },
  shadow: { position: 'absolute', left: 0, right: 0, top: SHADOW, height: 56, borderRadius: 18 },
  face: { height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  label: { fontFamily: fonts.bodyBold, fontSize: 18, letterSpacing: 0.3 },
});
