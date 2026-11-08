import { LegalScreen } from '../src/features/profile/LegalScreen';
import { privacyPolicy } from '../src/lib/legal';

// Política de privacidade (épico 8.10; T9; seção 20; 25.4: Dab Lab). Recebe: nada. Devolve: a tela.
export default function Privacy() {
  return <LegalScreen doc={privacyPolicy} testID="tela-privacidade" />;
}
