import { BebasNeue_400Regular } from '@expo-google-fonts/bebas-neue';
import { Nunito_600SemiBold, Nunito_800ExtraBold } from '@expo-google-fonts/nunito';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useTheme } from '../src/components/theme';

// Layout raiz: carrega as fontes da seção 16.3 (Bebas Neue nos títulos, emenda do 8.4) e monta a pilha de telas sem cabeçalho.
// Recebe: nada. Devolve: a navegação; o roteamento inicial (sessão/perfil) fica em app/index.tsx.
export default function RootLayout() {
  const theme = useTheme();
  const [fontsLoaded] = useFonts({ BebasNeue_400Regular, Nunito_600SemiBold, Nunito_800ExtraBold });

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: theme.background }} />;

  return (
    <SafeAreaProvider>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          gestureEnabled: false,
          contentStyle: { backgroundColor: theme.background },
        }}
      />
    </SafeAreaProvider>
  );
}
