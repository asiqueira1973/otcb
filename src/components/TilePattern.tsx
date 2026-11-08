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

  // Uma View por linha, sem quebra: o último ladrilho passa da borda e é cortado (overflow), em vez de
  // descer para a linha de baixo e deixar uma faixa vazia à direita (bug do 8.11 no iPhone de 440 pt).
  return (
    <View
      testID="azulejo-camada"
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, styles.layer, { opacity: theme.dark ? 0.1 : 0.12 }]}
      onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      {Array.from({ length: rows }, (_, r) => (
        <View key={r} testID="azulejo-linha" style={styles.row}>
          {Array.from({ length: cols }, (_, c) => (
            <Image key={c} testID="azulejo" source={require('../../assets/images/azulejo.png')} style={styles.tile} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { overflow: 'hidden' },
  row: { flexDirection: 'row', overflow: 'hidden' },
  tile: { width: TILE, height: TILE },
});
