import { LegalScreen } from '../src/features/profile/LegalScreen';
import { termsOfUse } from '../src/lib/legal';

// Termos de uso (épico 8.10; T9; 25.4: Dab Lab). Recebe: nada. Devolve: a tela.
export default function Terms() {
  return <LegalScreen doc={termsOfUse} testID="tela-termos" />;
}
