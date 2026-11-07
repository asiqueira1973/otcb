// Textos da interface (spec seção 15: textos finais, não placeholders). Nenhum texto de tela fora daqui.
// Entradas marcadas "(design)" vêm do prompt-design-otcb.md; "(aprovado 8.1)" estão no plano 8.1 para revisão.

export const copy = {
  // 15.10: nome do produto (sem a marca de cerveja)
  brand: 'OTCB',
  welcome: {
    // 15.1
    title: 'Onde tem chopp bem tirado?',
    subtitle: 'Pergunta pra gente. A gente garimpa os bares de SP pra você.',
    footer: 'Proibido para menores de 18 anos.',
    // 15.19
    start: 'Bora começar',
  },
  age: {
    // (aprovado 8.1) reaproveita a 15.11b
    explain: 'O OTCB é só para maiores de 18 anos.',
    question: 'Quando você nasceu?', // (aprovado 8.1)
    fieldLabel: 'Data de nascimento', // (aprovado 8.1)
    placeholder: 'DD/MM/AAAA',
    confirm: 'Confirmar', // (design)
    invalidDate: 'Confere a data: dia/mês/ano.', // (aprovado 8.1)
  },
  // 15.2
  blocked: 'Aqui é só pra maiores de 18. Volta daqui a pouco, que o chopp espera.',
  nickname: {
    title: 'Como a galera vai te chamar?', // (aprovado 8.1)
    label: 'Apelido', // (design)
    hint: 'Aparece nas suas opiniões.', // (aprovado 8.1)
    teamLabel: 'Time do coração (opcional)', // (design)
    formatError: 'Use de 3 a 20 letras, números, ponto ou sublinhado.', // (aprovado 8.1)
    takenError: 'Esse apelido já está em uso', // (design)
    // 15.14
    submit: 'Bora',
  },
  location: {
    // 15.3
    explain:
      'Pra achar o chopp mais perto, a gente usa sua localização só na hora da pergunta ou da foto. Não guardamos por onde você anda.',
    allow: 'Permitir', // (design)
    notNow: 'Agora não', // (design)
  },
  errors: {
    // 15.9
    noNetwork: 'Sem sinal por aqui. Tenta de novo quando a rede voltar.',
    aiDown: 'Deu um branco aqui do nosso lado. Tenta de novo em instantes.',
    firstOpenNoNetwork: 'Pra começar a gente precisa de internet. Tenta de novo quando tiver sinal.',
    retry: 'Tentar de novo', // (design)
  },
  chat: {
    // 15.13
    inputPlaceholder: 'Pergunta onde tem chopp…',
  },
} as const;
