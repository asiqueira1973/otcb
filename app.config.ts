import type { ExpoConfig } from 'expo/config';

// Configuração do app (épico 8.11; 24.8: com.dablab.otcb; conta Expo alexsiq, padrão da Dab Lab).
// Nome na loja e no aparelho é só "OTCB" (nota sobre a marca; hook guard-store-brand.sh). Só iPhone,
// sem iPad (decisão do Alexandre no 8.11). Criptografia: só HTTPS padrão (App Encryption: isento).
const config: ExpoConfig = {
  name: 'OTCB',
  slug: 'otcb',
  owner: 'alexsiq',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  scheme: 'otcb',
  ios: {
    bundleIdentifier: 'com.dablab.otcb',
    buildNumber: '1',
    supportsTablet: false,
    config: { usesNonExemptEncryption: false },
  },
  android: {
    package: 'com.dablab.otcb',
    versionCode: 1,
    adaptiveIcon: {
      backgroundColor: '#1F4AA8',
      foregroundImage: './assets/android-icon-foreground.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    // Só câmera e localização em uso (sem galeria, microfone nem localização em segundo plano).
    blockedPermissions: ['android.permission.RECORD_AUDIO', 'android.permission.ACCESS_BACKGROUND_LOCATION'],
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-font',
    // Splash: a bolacha sobre o fundo claro da paleta (16; theme.ts mist).
    ['expo-splash-screen', { image: './assets/splash-icon.png', imageWidth: 200, resizeMode: 'contain', backgroundColor: '#F4F7FB' }],
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Pra achar o chopp mais perto, a gente usa sua localização só na hora da pergunta ou da foto. Não guardamos por onde você anda.',
        isAndroidBackgroundLocationEnabled: false,
        isIosBackgroundLocationEnabled: false,
      },
    ],
    'expo-sharing',
    [
      'expo-camera',
      {
        cameraPermission: 'A câmera é usada só para fotografar o chopp e avaliar o colarinho.',
        recordAudioAndroid: false,
        microphonePermission: false,
      },
    ],
  ],
  platforms: ['ios', 'android'],
  // Projeto EAS criado no 8.11 (eas init, conta alexsiq).
  extra: { eas: { projectId: 'eea84f03-fde5-44c0-9d71-a7ef254de66f' } },
};

export default config;
