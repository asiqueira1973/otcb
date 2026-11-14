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
    withSpring: (value: number) => value,
    withDelay: (_delay: number, value: number) => value,
    withRepeat: (value: number) => value,
    withSequence: (...values: number[]) => values[values.length - 1],
    cancelAnimation: () => undefined,
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

// react-native-maps depende de módulo nativo: nos testes, mapa e marcadores viram Views com os mesmos props.
jest.mock('react-native-maps', () => {
  const { View } = require('react-native');
  const MapView = (props: object) => require('react').createElement(View, { ...props, testID: 'map-view' });
  const Marker = (props: { title?: string }) => require('react').createElement(View, { ...props, accessibilityLabel: props.title });
  return { __esModule: true, default: MapView, Marker };
});

// Módulos nativos do Colarinhômetro (8.6): câmera, manipulação de imagem, arquivos, compartilhar e captura.
jest.mock('expo-camera', () => {
  const React = require('react');
  const { View } = require('react-native');
  const CameraView = React.forwardRef((props: object, ref: unknown) => {
    React.useImperativeHandle(ref, () => ({
      takePictureAsync: () => Promise.resolve({ uri: 'file:///foto.jpg', width: 3024, height: 4032 }),
    }));
    return React.createElement(View, props);
  });
  return {
    CameraView,
    useCameraPermissions: jest.fn(() => [{ granted: true, canAskAgain: true }, jest.fn()]),
  };
});
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(() => Promise.resolve({ uri: 'file:///foto-1280.jpg', width: 960, height: 1280 })),
  SaveFormat: { JPEG: 'jpeg' },
}));
jest.mock('expo-file-system', () => {
  class Directory {
    uri: string;
    exists = true;
    constructor(...partes: unknown[]) { this.uri = partes.map((p) => (typeof p === 'string' ? p : (p as { uri: string }).uri)).join('/'); }
    create() {}
  }
  class File {
    uri: string;
    exists = true;
    constructor(...partes: unknown[]) { this.uri = partes.map((p) => (typeof p === 'string' ? p : (p as { uri: string }).uri)).join('/'); }
    copy() {}
    delete() {}
    // O File real implementa Blob; o expo/fetch lê o conteúdo por bytes() ao montar o multipart.
    bytes() { return Promise.resolve(new Uint8Array([0xff, 0xd8, 0xff])); }
  }
  return { Directory, File, Paths: { document: { uri: 'file:///docs' }, cache: { uri: 'file:///cache' } } };
});
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(() => Promise.resolve(true)), shareAsync: jest.fn(() => Promise.resolve()) }));
jest.mock('react-native-view-shot', () => ({ captureRef: jest.fn(() => Promise.resolve('file:///share.png')) }));
