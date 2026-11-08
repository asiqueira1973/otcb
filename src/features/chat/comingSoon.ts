import { Alert } from 'react-native';

import { copy } from '../../lib/copy';

// Câmera (Colarinhômetro, 8.6) e Passaporte (8.7) ainda não existem: avisa "em breve" (plano 8.4).
export function showComingSoon(): void {
  Alert.alert(copy.chat.comingSoonTitle, copy.chat.comingSoon);
}
