import { useColorScheme } from 'react-native';

// Tokens visuais do OTCB (16.2, 16.3 e 16.5), com a emenda do Alexandre no 8.4: sair do creme pastel para
// branco, azul e vermelho (inspirado no copo de chopp Brahma, sem copiar a marca). O azul é a cor principal;
// o vermelho é só acento (marca "OTCB" e câmera), nunca a cor dominante; o âmbar fica para o chopp.
export const palette = {
  blue: '#1F4AA8',
  blueDeep: '#14336F', // sombra sólida do botão azul (efeito botão de jogo, 16.1)
  red: '#D22630',
  white: '#FFFFFF',
  mist: '#F4F7FB', // fundo claro, frio, no lugar do creme
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
  accent: string; // acento vermelho: marca e câmera
  link: string; // ações de texto (atalhos, "tentar de novo")
  border: string;
  error: string;
  dark: boolean;
};

const light: Theme = {
  background: palette.mist,
  card: palette.white,
  text: '#14203A',
  textMuted: '#4E5B73',
  primary: palette.blue,
  primaryShadow: palette.blueDeep,
  onPrimary: palette.white,
  accent: palette.red,
  link: palette.blue,
  border: '#D9E1EE',
  error: palette.error,
  dark: false,
};

const dark: Theme = {
  background: '#0E1628',
  card: '#18233D',
  text: '#F4F7FB',
  textMuted: '#AEB9CF',
  primary: '#3566D6',
  primaryShadow: '#1F3F8C',
  onPrimary: palette.white,
  accent: '#E5484D',
  link: '#8FB0FF',
  border: '#2A3858',
  error: '#F07A7A',
  dark: true,
};

// Tema do sistema (16.5: modo escuro obrigatório e seguindo o sistema).
// Recebe: nada. Devolve: os tokens do modo atual.
export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

// Famílias tipográficas (16.3, com a emenda do 8.4): Bebas Neue nos títulos (letreiro condensado, só
// maiúsculas; tamanhos ~20% maiores que os da Baloo 2) e Nunito (peso mínimo 500) no texto.
export const fonts = {
  title: 'BebasNeue_400Regular',
  body: 'Nunito_600SemiBold',
  bodyBold: 'Nunito_800ExtraBold',
} as const;
