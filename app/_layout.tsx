import { Stack } from 'expo-router';

// Layout raiz do Expo Router: pilha de telas sem cabeçalho.
// Recebe: nada. Devolve: a navegação em pilha das rotas de app/.
// Implementa a seção 18 (rotas do Expo Router em app/); telas T1–T10 entram a partir do épico 8.1.
export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
