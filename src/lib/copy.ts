// Textos da interface (spec seção 15: textos finais, não placeholders). Nenhum texto de tela fora daqui.
// Entradas marcadas "(design)" vêm do prompt-design-otcb.md; "(aprovado 8.1)" estão no plano 8.1 para revisão.

export const copy = {
  // 15.10: nome do produto (sem a marca de cerveja)
  brand: 'OTCB',
  welcome: {
    // 15.1, com a emenda "só Brahma" do Alexandre (8.4)
    title: 'Onde tem chopp Brahma bem tirado?',
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
    // 15.3, com a emenda "só Brahma" (8.4)
    explain:
      'Pra achar o chopp Brahma mais perto, a gente usa sua localização só na hora da pergunta ou da foto. Não guardamos por onde você anda.',
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
    // 15.13, com a emenda "só Brahma" (8.4)
    inputPlaceholder: 'Pergunta onde tem chopp Brahma…',
    // 15.4, com a emenda do Alexandre (8.4): "Chopp Brahma perto de mim"
    suggestions: ['Chopp Brahma perto de mim', 'Onde ver o jogo hoje?', 'Bar com balcão em Pinheiros', 'Meu Passaporte'],
    // 15.8
    limit: 'Por hoje deu de conversa. Amanhã tem mais.',
    send: 'Enviar', // (proposto 8.4)
    camera: 'Colarinhômetro', // (proposto 8.4) rótulo do botão da câmera
    typing: 'Pensando na resposta…', // (proposto 8.4) leitor de tela do A1
    notSent: 'Não enviada', // (proposto 8.4)
    passport: 'Passaporte', // (proposto 8.4) atalho
    profile: 'Perfil', // (proposto 8.4) atalho
    comingSoonTitle: 'Chega já já', // (proposto 8.4)
    comingSoon: 'Essa parte ainda está no forno. Por enquanto, pergunta aqui no chat.', // (proposto 8.4)
  },
  bar: {
    // 16.4: pílulas de status e etiquetas
    status: { confirmado: 'confirmado', provavel: 'provável', incerto: 'a confirmar' },
    counter: 'balcão',
    games: 'passa jogo',
    classic: 'clássico',
    distanceM: (m: number) => `a ${m} m`, // (proposto 8.4)
    distanceKm: (km: string) => `a ${km} km`, // (proposto 8.4)
    collar: (n: string) => `Colarinho ${n}`, // (proposto 8.4)
    noCollar: 'Colarinho sem nota ainda', // (proposto 8.4)
    opinions: (n: number) => (n === 1 ? '1 opinião' : `${n} opiniões`), // (proposto 8.4)
    lastConfirmation: (d: string) => `Última confirmação em ${d}`, // (proposto 8.4)
    noConfirmation: 'Ainda sem confirmação de quem foi lá', // (proposto 8.4)
    open: (nome: string) => `Abrir a ficha do ${nome}`, // (proposto 8.4) leitor de tela
  },
  sheet: {
    // T6
    giveOpinion: 'Dar opinião',
    hasBrahma: 'Tem Brahma?',
    report: 'Denunciar',
    route: 'Como chegar',
    uber: 'Chamar Uber',
    summary: 'O que a galera diz', // (proposto 8.4)
    opinions: 'Opiniões', // (proposto 8.4)
    // 15.16
    noOpinions: 'Ninguém opinou ainda. Seja o primeiro.',
    close: 'Fechar', // (proposto 8.4)
    loadError: 'Não deu pra abrir a ficha agora.', // (proposto 8.4)
  },
  blocks: {
    games: 'Jogos', // (proposto 8.4)
    noGames: 'Nenhum jogo na lista por enquanto.', // (proposto 8.4)
    passport: 'Seu Passaporte', // (proposto 8.4)
    stamps: (n: number) => (n === 1 ? '1 carimbo' : `${n} carimbos`), // (proposto 8.4)
    neighborhoods: (n: number) => (n === 1 ? '1 bairro conquistado' : `${n} bairros conquistados`), // (proposto 8.4)
    lastSeal: (s: string) => `Último selo: ${s}`, // (proposto 8.4)
    map: (n: number) => `Mapa com ${n} bares`, // (proposto 8.4) leitor de tela
  },
  // Cards de entrada (8.5): rótulos dos botões da tabela da 8.5; os demais "(proposto 8.5)"
  cards: {
    yes: 'Tem sim',
    noMore: 'Não tem mais',
    closed: 'Fechou',
    shows: 'Passa',
    doesntShow: 'Não passa',
    askHasBrahma: (bar: string) => `O ${bar} ainda tem chopp Brahma?`, // (proposto 8.5) mesma do servidor
    registered: 'Valeu! Tá registrado.', // (proposto 8.5)
    // 15.8 — confirmação repetida no dia
    alreadyToday: 'Você já contou isso hoje. Valeu!',
    opinionTitle: (bar: string) => `Sua opinião sobre o ${bar}`, // (proposto 8.5)
    opinionPlaceholder: 'Como tá o chopp Brahma, o colarinho, o atendimento?', // (proposto 8.5)
    counter: (n: number) => `${n}/500`, // (proposto 8.5)
    minChars: 'Mínimo de 10 caracteres.', // (proposto 8.5)
    ratingLabel: 'Nota (opcional)', // (proposto 8.5)
    star: (n: number) => (n === 1 ? '1 estrela' : `${n} estrelas`), // (proposto 8.5) leitor de tela
    publish: 'Publicar', // (proposto 8.5)
    published: 'Opinião publicada. Valeu!', // (proposto 8.5)
    // 15.7
    rejected: 'Não deu pra publicar essa opinião. Tenta reescrever sem ofensas nem dados pessoais.',
    editLimit: 'Hoje você já mexeu nessa opinião 5 vezes. Amanhã dá pra editar de novo.', // (proposto 8.5)
    suggestionTitle: 'Sugerir um bar com chopp Brahma', // (proposto 8.5)
    barName: 'Nome do bar', // (proposto 8.5)
    address: 'Endereço', // (proposto 8.5)
    neighborhood: 'Bairro', // (proposto 8.5)
    hereNow: 'Estou no bar agora', // (proposto 8.5)
    hasBrahmaQuestion: 'Tem chopp Brahma?', // (proposto 8.5)
    dontKnow: 'Não sei', // tabela da 8.5
    suggest: 'Sugerir', // (proposto 8.5)
    dontKnowNotice: 'Valeu! Aqui só entram bares com chopp Brahma. Se descobrir que tem, é só me contar.', // (proposto 8.5)
    suggested: 'Bar sugerido! Ele entra como a confirmar.', // (proposto 8.5)
    // 15.18
    alreadyExisted: 'Esse bar já estava aqui — sua confirmação foi registrada.',
    suggestionLimit: 'Por hoje já foram 5 sugestões. Amanhã tem mais.', // (proposto 8.5)
    addressNotFound: 'Não achei esse endereço. Confere e tenta de novo.', // (proposto 8.5)
    noLocation: 'Não consegui sua localização. Desmarca "Estou no bar agora" e escreve o endereço.', // (proposto 8.5)
    reportTitle: 'Denunciar opinião', // (proposto 8.5)
    reason: 'Motivo (opcional)', // (proposto 8.5)
    reported: 'Denúncia enviada. Valeu por ajudar.', // (proposto 8.5)
    alreadyReported: 'Você já denunciou essa opinião.', // (proposto 8.5)
    cantReportOwn: 'Essa opinião é sua.', // (proposto 8.5)
  },
  // Nomes dos selos da regra 11.11 (proposto 8.4)
  seals: {
    primeira_tirada: 'Primeira tirada',
    explorador: 'Explorador',
    andarilho: 'Andarilho',
    olho_clinico: 'Olho clínico',
    informante: 'Informante',
  } as Record<string, string>,
  profile: {
    title: 'Perfil', // (proposto 8.4)
    back: 'Voltar', // (proposto 8.4)
    clearChat: 'Limpar conversa', // T9
    clearConfirm: 'Isso apaga as mensagens do chat. Não dá pra desfazer.', // (proposto 8.4)
    clearAction: 'Limpar', // (proposto 8.4)
    cancel: 'Cancelar', // (proposto 8.4)
    cleared: 'Conversa limpa.', // (proposto 8.4)
    // 15.20
    passportNotice: 'Seu passaporte fica neste celular. Se reinstalar o app ou trocar de aparelho, ele não volta.',
    // 15.12
    footer: 'Beba com moderação. Se beber, não dirija.',
  },
} as const;
