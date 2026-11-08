import { Linking, Platform } from 'react-native';

import { track } from '../../lib/telemetry';

type Destino = { latitude: number; longitude: number; nome: string };

// URL do Uber da seção 13.2 (pickup na localização atual, destino no bar). Recebe: destino. Devolve: URL.
export function uberUrl(d: Destino): string {
  return `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[latitude]=${d.latitude}&dropoff[longitude]=${d.longitude}&dropoff[nickname]=${encodeURIComponent(d.nome)}`;
}

// URL do app de mapas padrão do sistema (13.2 abrir_rota). Recebe: destino. Devolve: URL.
export function routeUrl(d: Destino): string {
  const nome = encodeURIComponent(d.nome);
  return Platform.OS === 'ios'
    ? `maps:?daddr=${d.latitude},${d.longitude}&q=${nome}`
    : `geo:${d.latitude},${d.longitude}?q=${d.latitude},${d.longitude}(${nome})`;
}

// Abre rota ou Uber e registra otcb_rota_aberta (seção 21). Recebe: tipo e destino. Devolve: nada.
export async function openDirections(kind: 'mapas' | 'uber', d: Destino): Promise<void> {
  track('otcb_rota_aberta', { destino: kind });
  try {
    await Linking.openURL(kind === 'uber' ? uberUrl(d) : routeUrl(d));
  } catch {
    // Sem app de mapas: cai no Google Maps web.
    await Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${d.latitude},${d.longitude}`).catch(() => undefined);
  }
}
