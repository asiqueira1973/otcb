import * as Location from 'expo-location';

export type Coords = { latitude: number; longitude: number };

// Localização só na hora da pergunta (seção 17; 15.3): usa a permissão de primeiro plano já dada no
// onboarding, sem pedir de novo nem rastrear. Recebe: nada. Devolve: coordenadas ou null (sem permissão,
// GPS desligado ou demora > 4 s — a pergunta vai sem coordenadas).
export async function getCurrentCoords(): Promise<Coords | null> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const last = await Location.getLastKnownPositionAsync({ maxAge: 120_000, requiredAccuracy: 200 });
    if (last) return { latitude: last.coords.latitude, longitude: last.coords.longitude };
    const pos = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
    ]);
    return pos ? { latitude: pos.coords.latitude, longitude: pos.coords.longitude } : null;
  } catch {
    return null;
  }
}
