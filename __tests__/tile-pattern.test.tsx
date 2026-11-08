import { fireEvent, render, screen } from '@testing-library/react-native';

import { TilePattern } from '../src/components/TilePattern';

// Bug real do 8.11 (prints no iPhone 17 Pro Max, 440 pt): com flexWrap, o 5º ladrilho de cada linha
// (5 × 96 = 480 > 440) quebrava para a linha de baixo e sobrava uma faixa sem azulejo à direita.
it('cada linha tem ladrilhos suficientes para cobrir a largura toda', async () => {
  await render(<TilePattern />);
  const layer = screen.UNSAFE_root.findAll((n) => typeof n.props.onLayout === 'function')[0];
  await fireEvent(layer, 'layout', { nativeEvent: { layout: { width: 440, height: 956 } } });
  const rows = screen.getAllByTestId('azulejo-linha');
  expect(rows).toHaveLength(Math.ceil(956 / 96));
  for (const row of rows) {
    expect(row.props.style).toEqual(expect.objectContaining({ flexDirection: 'row', overflow: 'hidden' }));
    expect(row.findAll((n) => n.props.testID === 'azulejo').length).toBeGreaterThanOrEqual(Math.ceil(440 / 96));
  }
});
