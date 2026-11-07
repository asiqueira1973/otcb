// Configuração dos testes de componente (jest-expo, seção 22): mocks de módulos nativos.

// Mock mínimo do Reanimated 4: o mock oficial depende do runtime nativo do Worklets.
// Cobre só o que os componentes usam; animações viram estilo estático nos testes.
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View },
    useSharedValue: (value: number) => ({ value }),
    useAnimatedStyle: (factory: () => object) => factory(),
    withTiming: (value: number) => value,
    useReducedMotion: () => false,
  };
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
}));

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    AFTER_FIRST_UNLOCK: 0,
    getItemAsync: jest.fn((k: string) => Promise.resolve(store.get(k) ?? null)),
    setItemAsync: jest.fn((k: string, v: string) => Promise.resolve(void store.set(k, v))),
    deleteItemAsync: jest.fn((k: string) => Promise.resolve(void store.delete(k))),
  };
});

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
