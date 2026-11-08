import { StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { palette, useTheme } from '../../components/theme';
import { copy } from '../../lib/copy';
import type { Bloco } from '../chat/types';

type Ponto = Extract<Bloco, { tipo: 'mapa' }>['pontos'][number];

const COLOR = { confirmado: palette.confirmed, provavel: palette.probable, incerto: palette.unconfirmed } as const;

// Região que enquadra todos os pontos com folga. Recebe: pontos. Devolve: região do MapView.
export function regionFor(pontos: Ponto[]) {
  const lats = pontos.map((p) => p.latitude);
  const lngs = pontos.map((p) => p.longitude);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.6, 0.01),
    longitudeDelta: Math.max((maxLng - minLng) * 1.6, 0.01),
  };
}

// Mini mapa do bloco 'mapa' (13.2; mapa não é aba, seção 28). Marcadores na cor do status; tocar abre a ficha.
// Recebe: pontos e ação de abrir. Devolve: o mapa estático (sem rolagem para não brigar com o chat).
export function MiniMap({ pontos, onOpen }: { pontos: Ponto[]; onOpen: (barId: string) => void }) {
  const theme = useTheme();
  if (pontos.length === 0) return null;
  return (
    <View
      testID="bloco-mapa"
      accessible
      accessibilityLabel={copy.blocks.map(pontos.length)}
      style={[styles.wrap, { borderColor: theme.border }]}
    >
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={regionFor(pontos)}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        userInterfaceStyle={theme.dark ? 'dark' : 'light'}
      >
        {pontos.map((p) => (
          <Marker
            key={p.bar_id}
            coordinate={{ latitude: p.latitude, longitude: p.longitude }}
            title={p.nome}
            description={copy.bar.status[p.status]}
            pinColor={COLOR[p.status]}
            onCalloutPress={() => onOpen(p.bar_id)}
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 200, borderRadius: 14, overflow: 'hidden', borderWidth: 2 },
});
