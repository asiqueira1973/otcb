import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

import { supabase } from '../../lib/supabase';
import { track } from '../../lib/telemetry';

export type OrigemCompartilhamento = 'colarinho' | 'passaporte';

// Compartilhar imagem (8.6 passo 6; selo Divulgador do 8.12): captura a View fora da tela, abre a folha de
// compartilhar do sistema e, quando ela fecha, registra o compartilhamento na confiança (o sistema não diz se a
// pessoa postou de verdade) com otcb_registrar_compartilhamento e o evento otcb_compartilhou. Tudo é opcional:
// qualquer falha é silenciosa. Recebe: ref da View e origem. Devolve: true se o registro foi aceito.
export async function compartilharImagem(ref: unknown, origem: OrigemCompartilhamento): Promise<boolean> {
  try {
    const uri = await captureRef(ref as Parameters<typeof captureRef>[0], { format: 'png', quality: 1 });
    if (!(await Sharing.isAvailableAsync())) return false;
    await Sharing.shareAsync(uri, { mimeType: 'image/png' });
  } catch {
    return false;
  }
  track('otcb_compartilhou', { origem });
  try {
    const { error } = await supabase.rpc('otcb_registrar_compartilhamento', { p_origem: origem });
    return !error;
  } catch {
    return false;
  }
}
