import { render, screen } from '@testing-library/react-native';

import Index from '../../../app/index';

// Teste de fumaça do esqueleto (épico 8.0): prova que o jest-expo renderiza uma rota do app.
describe('esqueleto do app', () => {
  it('renderiza a tela provisória com o nome OTCB', async () => {
    await render(<Index />);
    expect(screen.getByText('OTCB')).toBeTruthy();
  });
});
