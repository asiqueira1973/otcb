// Termos de uso e Política de privacidade do OTCB (épico 8.10; seção 20; 25.4: Dab Lab, contato
// alexandre@dablab.com.br). Rascunho escrito no 8.10, pendente de revisão jurídica antes da publicação.
// Mudou o texto → atualizar a versão e a data.

export type LegalSection = { title: string; body: string };
export type LegalDoc = { title: string; updatedAt: string; sections: LegalSection[] };

export const LEGAL_CONTACT = 'alexandre@dablab.com.br';
export const LEGAL_OWNER = 'Dab Lab';

export const privacyPolicy: LegalDoc = {
  title: 'Política de privacidade',
  updatedAt: 'Versão 1 · 8 de novembro de 2026',
  sections: [
    {
      title: 'Quem somos',
      body: `O OTCB é um app da ${LEGAL_OWNER}. Para qualquer assunto sobre seus dados, escreva para ${LEGAL_CONTACT}.`,
    },
    {
      title: 'O que guardamos',
      body:
        'Você usa o OTCB sem cadastro: o app cria uma identidade anônima no seu celular. Não pedimos e-mail, telefone nem nome.\n\n' +
        '• Apelido e time do coração: o apelido aparece nas suas opiniões; o time só você vê.\n' +
        '• O momento em que você confirmou ter 18 anos ou mais. A data de nascimento não é guardada.\n' +
        '• Fotos do Colarinhômetro, num armazenamento privado, até você apagar.\n' +
        '• Conversas com o assistente, por 30 dias.\n' +
        '• Opiniões, confirmações e sugestões de bares que você enviar.\n' +
        '• Carimbos e selos do Passaporte.',
    },
    {
      title: 'Localização',
      body:
        'Só com a sua permissão, e só na hora de uma pergunta ou de uma foto, para achar bares perto de você. ' +
        'Não guardamos por onde você anda: da foto, fica só a distância até o bar.',
    },
    {
      title: 'Com quem compartilhamos',
      body:
        '• Anthropic (Claude): os textos do chat e as fotos são processados por inteligência artificial para responder, dar a nota do colarinho e moderar opiniões.\n' +
        '• Supabase: onde os dados ficam guardados, com acesso restrito.\n' +
        '• Medição de uso: contamos eventos do app (por exemplo, "uma foto foi avaliada") sem o texto das mensagens, sem localização e sem fotos.\n\n' +
        'Não vendemos seus dados e não usamos para publicidade.',
    },
    {
      title: 'Por que tratamos esses dados',
      body:
        'Para prestar o serviço que você pede (LGPD, art. 7º, V): identidade anônima, chat, Colarinhômetro e Passaporte. ' +
        'A medição de uso, sem dado pessoal sensível, é feita por legítimo interesse, para melhorar o app.',
    },
    {
      title: 'Seus direitos',
      body:
        'Em Perfil › "Apagar meus dados" você apaga apelido, fotos, carimbos, opiniões e conversa na hora; isso não dá pra desfazer. ' +
        'Confirmações sobre bares ficam na base sem ligação com você. ' +
        `Para pedir uma cópia dos seus dados, escreva para ${LEGAL_CONTACT}; respondemos em até 15 dias.\n\n` +
        'O Passaporte fica ligado a este celular: se você desinstalar o app, a identidade anônima se perde e não temos como devolvê-la.',
    },
    {
      title: 'Menores de idade',
      body: 'O OTCB é proibido para menores de 18 anos. Uma conta que indique ser de menor é revisada e pode ser apagada.',
    },
    {
      title: 'Mudanças',
      body: 'Se esta política mudar, a nova versão aparece aqui com a data atualizada.',
    },
  ],
};

export const termsOfUse: LegalDoc = {
  title: 'Termos de uso',
  updatedAt: 'Versão 1 · 8 de novembro de 2026',
  sections: [
    {
      title: 'O OTCB',
      body:
        `O OTCB é um app da ${LEGAL_OWNER} que ajuda a achar chopp Brahma em São Paulo, saber se é bem tirado e onde passa o jogo. ` +
        'O OTCB não tem vínculo com a Ambev nem com a marca Brahma.',
    },
    {
      title: 'Só para maiores de 18',
      body: 'Para usar o app você precisa ter 18 anos ou mais. Beba com moderação. Se beber, não dirija.',
    },
    {
      title: 'O que o app não faz',
      body:
        'O OTCB não vende nem entrega bebida, não faz reserva e não incentiva consumo em quantidade. ' +
        'As informações dos bares vêm da comunidade e de fontes públicas e podem estar desatualizadas: confirme no bar antes de ir.',
    },
    {
      title: 'Assistente e Colarinhômetro',
      body:
        'As respostas do assistente e as notas do Colarinhômetro são geradas por inteligência artificial e podem errar. ' +
        'Há limites diários de mensagens e de fotos.',
    },
    {
      title: 'Opiniões e fotos',
      body:
        'Ao opinar ou enviar uma foto, você declara que o conteúdo é seu. Não são publicadas opiniões com ofensa a pessoas ou funcionários, ' +
        'discurso de ódio, dados pessoais de terceiros, incentivo ao consumo excessivo, propaganda ou spam. ' +
        'Opiniões podem ser denunciadas e ocultadas pela moderação.',
    },
    {
      title: 'Responsabilidade',
      body:
        'O app é oferecido como está. A experiência no bar (atendimento, preço, qualidade) é responsabilidade de cada estabelecimento.',
    },
    {
      title: 'Contato',
      body: `Dúvidas, pedidos ou denúncias: ${LEGAL_CONTACT}.`,
    },
  ],
};
