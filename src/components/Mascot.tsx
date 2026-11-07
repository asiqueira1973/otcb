import { Image, StyleSheet, View } from 'react-native';

import { useTheme } from './theme';

export type MascotMood = 'feliz' | 'mapa' | 'gentil' | 'triste' | 'comemora';

const IMAGES = {
  feliz: require('../../assets/images/bolacha-feliz.png'),
  mapa: require('../../assets/images/bolacha-mapa.png'),
  gentil: require('../../assets/images/bolacha-gentil.png'),
  triste: require('../../assets/images/bolacha-triste.png'),
  comemora: require('../../assets/images/bolacha-comemora.png'),
} as const;

type Props = { mood: MascotMood; size?: number };

// Mascote Bolacha (16.4): bolacha de chopp com rosto simples, ilustrações originais (Higgsfield, 8.1).
// No modo escuro ganha um halo claro, porque braços e pernas são cor de tinta e sumiriam no fundo (16.5).
// Decorativa para o leitor de tela: o texto da tela carrega o significado (seção 17).
// Recebe: humor e tamanho. Devolve: a figura.
export function Mascot({ mood, size = 160 }: Props) {
  const theme = useTheme();
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[styles.wrap, { width: size, height: size }]}
    >
      {theme.dark ? (
        <View style={[styles.halo, { width: size * 0.98, height: size * 0.98, borderRadius: size }]} />
      ) : null}
      <Image source={IMAGES[mood]} style={{ width: size, height: size }} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', backgroundColor: '#F4E9D2', opacity: 0.9 },
});
