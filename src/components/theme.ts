import { useColorScheme } from 'react-native';

// Tokens visuais do OTCB (spec 16.2, 16.3 e 16.5). Sem vermelho como cor principal.
export const palette = {
  amber: '#F2A900',
  amberDeep: '#C98C00', // sombra sólida do botão âmbar (efeito botão de jogo, 16.1)
  foam: '#FFF6E3',
  bottle: '#1F6F5C',
  tile: '#2B59C3',
  ink: '#22201C',
  inkCard: '#332E27', // card marrom-escuro do modo escuro (16.5)
  confirmed: '#2E8B57',
  probable: '#6B7FD7',
  unconfirmed: '#8A8578',
  error: '#D64545',
} as const;

export type Theme = {
  background: string;
  card: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryShadow: string;
  onPrimary: string;
  accent: string;
  border: string;
  error: string;
  dark: boolean;
};

const light: Theme = {
  background: palette.foam,
  card: '#FFFFFF',
  text: palette.ink,
  textMuted: '#5E574C',
  primary: palette.amber,
  primaryShadow: palette.amberDeep,
  onPrimary: palette.ink,
  accent: palette.bottle,
  border: '#E8DCC2',
  error: palette.error,
  dark: false,
};

const dark: Theme = {
  background: palette.ink,
  card: palette.inkCard,
  text: palette.foam,
  textMuted: '#CFC4AE',
  primary: palette.amber,
  primaryShadow: palette.amberDeep,
  onPrimary: palette.ink,
  accent: '#5FB39D',
  border: '#4A4238',
  error: '#F07A7A',
  dark: true,
};

// Tema do sistema (16.5: modo escuro obrigatório e seguindo o sistema).
// Recebe: nada. Devolve: os tokens do modo atual.
export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

// Famílias tipográficas (16.3): Baloo 2 nos títulos, Nunito (peso mínimo 500) no texto.
export const fonts = {
  title: 'Baloo2_800ExtraBold',
  body: 'Nunito_600SemiBold',
  bodyBold: 'Nunito_800ExtraBold',
} as const;
