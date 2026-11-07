import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { useTheme } from './theme';

const TILE = 96;

// Textura discreta de azulejo (16.4) no fundo da Boas-vindas e de telas vazias: o ladrilho ilustrado
// repetido em grade (medida pelo onLayout) com opacidade baixa. Puramente decorativa.
// Recebe: nada. Devolve: camada atrás do conteúdo.
export function TilePattern() {
  const theme = useTheme();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const cols = Math.ceil(size.width / TILE);
  const rows = Math.ceil(size.height / TILE);

  return (
    <View
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.grid, { opacity: theme.dark ? 0.1 : 0.12 }]}
      onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      {Array.from({ length: cols * rows }, (_, i) => (
        <Image key={i} source={require('../../assets/images/azulejo.png')} style={styles.tile} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', overflow: 'hidden' },
  tile: { width: TILE, height: TILE },
});
