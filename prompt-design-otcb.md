# Prompt para o Claude Design — telas do OTCB

Cole o texto abaixo no Claude Design.

---

Crie as telas de um app mobile (iOS e Android, retrato, 390 × 844) chamado **OTCB**, um app que responde em conversa onde tem chopp bem tirado em São Paulo. O público é adulto (18+). **O app não tem login**: nada de e-mail, telefone, senha ou "Entrar com Google/Apple"; a pessoa abre e usa. A interface principal é um **chat estilo Claude/ChatGPT**, e toda informação que o usuário dá entra por **cards dentro do chat**. Desenhe em modo claro **e** escuro (o app é muito usado à noite, dentro do bar).

Importante: o app **não usa nenhuma marca de cerveja**. Não desenhe logos, rótulos, nomes ou identidade visual de marcas existentes. Nada de vermelho como cor principal.

## Direção visual

**Sensação:** boteco paulistano com alma de app de jogo. Divertido e caloroso, nunca sério nem corporativo, e também nunca infantil.

**Referências:**
- **Duolingo:** formas arredondadas, botões "gordinhos" com sombra sólida embaixo (efeito botão de jogo), texto em peso forte, cores chapadas, mascote como voz do produto, celebrações com confete e carimbo.
- **Bar Ovo (Estúdio Sarau, SP):** boteco retrô despretensioso, letreiro com cara de escrito à mão, expressões locais.
- **Boteco da Mario (268 Estúdio):** selo informal como elemento gráfico.
- **Vernáculo de boteco:** azulejo português, copo americano, toalha xadrez, comanda, guardanapo de papel, letreiro pintado à mão, bolacha de chopp.

**Paleta de marca:** âmbar `#F2A900` (botão principal, destaques, mascote) · colarinho `#FFF6E3` (fundo claro, cards) · verde-garrafa `#1F6F5C` (secundário, cabeçalhos) · azul-azulejo `#2B59C3` (padrões decorativos, links) · tinta `#22201C` (texto; fundo do modo escuro).

**Cores semânticas (só para significado, nunca decoração):** confirmado `#2E8B57` · provável `#6B7FD7` · a confirmar `#8A8578` · erro `#D64545`.

**Tipografia:** títulos e números grandes em sem serifa arredondada encorpada (sugestão: Baloo 2 ExtraBold); texto em sem serifa arredondada legível (sugestão: Nunito, peso mínimo 500); acento "letreiro pintado à mão" só no Passaporte, carimbos e selos.

**Componentes-chave:**
- **Mascote "Bolacha":** uma bolacha de chopp redonda com rosto simples. Aparece ao lado das falas do assistente, em estados vazios, de erro e em celebrações. Original.
- **Bolhas do chat** arredondadas.
- **Card de bar como comanda:** nome em destaque, pílulas de status ("confirmado", "provável", "a confirmar") e de atributos ("passa jogo", "balcão", "clássico"), nota do colarinho com ícone de copo, distância.
- **Resultado do Colarinhômetro como guardanapo de papel:** nota grande "escrita à mão" e quatro notas parciais em barrinhas.
- **Carimbos do Passaporte** como carimbo de borracha levemente torto, com tinta falhada.
- **Botão principal** âmbar com sombra sólida.
- **Textura de azulejo** discreta em fundos de telas vazias e na Boas-vindas.

**Microanimações (indique nos protótipos):** bolhas de espuma subindo num copinho enquanto o assistente digita · mensagens e cards entram de baixo com mola · botão afunda na sombra ao tocar · copo enchendo enquanto a foto é avaliada · nota contando de 0 até o valor e barrinhas crescendo · carimbo batendo na tela com tremida e confete âmbar · selo girando e pousando · check verde com "pop" quando um card é registrado · mascote piscando, triste no erro, comemorando no carimbo.

**Acessibilidade:** contraste AA, área de toque mínima de 44 pt, suporte a fonte grande do sistema.

**Livre para você decidir:** ilustrações, expressões do mascote, ícones, a fonte final dentro dessas características.

## Fluxo principal

Boas-vindas → Maioridade → Apelido e time → Permissão de localização → **Chat**. Do Chat: tocar num card de bar abre a Ficha do bar (bottom sheet); o botão de câmera abre a Câmera do Colarinhômetro e o resultado volta como card no Chat; ícones no topo do Chat levam ao Passaporte e ao Perfil.

## Telas (todas do perfil usuário)

### T1 — Boas-vindas
Logo OTCB, ilustração da Bolacha com textura de azulejo, título "Onde tem chopp bem tirado?", subtítulo "Pergunta pra gente. A gente garimpa os bares de SP pra você.", um único botão "Bora começar", rodapé "Proibido para menores de 18 anos." Estado sem internet na primeira abertura: "Pra começar a gente precisa de internet. Tenta de novo quando tiver sinal." com botão "Tentar de novo".

### T2 — Maioridade
Pergunta da data de nascimento (seletor de data) e botão "Confirmar". Texto curto explicando que o app é só para maiores de 18.

### T3 — Apelido e time
Campo "Apelido" (3 a 20 caracteres, letras, números, ponto e sublinhado) com erro inline "Esse apelido já está em uso", campo opcional "Time do coração", botão "Bora".

### T4 — Permissão de localização
Bolacha com um mapinha. Texto: "Pra achar o chopp mais perto, a gente usa sua localização só na hora da pergunta ou da foto. Não guardamos por onde você anda." Botões "Permitir" e "Agora não".

### T5 — Chat (tela principal)
Topo: logo pequeno, ícone do Passaporte (com contador de carimbos) e ícone do Perfil. Corpo: conversa. Rodapé: campo "Pergunta onde tem chopp…", botão de câmera fixo ao lado, botão enviar.

Estados a desenhar:
- **Vazio:** Bolacha dando oi e sugestões em pílulas: "Chopp perto de mim" · "Onde ver o jogo hoje?" · "Bar com balcão em Pinheiros" · "Meu Passaporte".
- **Digitando:** animação do copinho com bolhas.
- **Resposta com lista de bares:** texto curto do assistente + mini mapa com pins coloridos pelo status + lista de até 8 cards-comanda. Inclua um bar "a confirmar" com a pílula cinza.
- **Resposta com card de um bar** e botões de ação "Como chegar", "Chamar Uber", "Tirar foto".
- **Resposta com jogos do dia:** card com partidas (competição, times, horário) seguido de bares que passam jogo.
- **Resposta com resumo do Passaporte.**
- **Mensagem não enviada** (sem rede): mensagem marcada com "tentar de novo". Texto: "Sem sinal por aqui. Tenta de novo quando a rede voltar."
- **Erro da IA:** Bolacha triste, "Deu um branco aqui do nosso lado. Tenta de novo em instantes."
- **Limite diário:** "Por hoje deu de conversa. Amanhã tem mais."

**Cards de entrada de dados dentro do chat** (cada um com estados: editando, enviando, registrado com check verde, erro com "tentar de novo"):
1. **Confirmação em um toque** — pergunta ("O Bar do Nico ainda tem chopp Brahma?") com botões "Tem sim" / "Não tem mais" / "Fechou"; variação para jogos: "Passa" / "Não passa".
2. **Opinião** — nome do bar, nota de 1 a 5 (copinhos em vez de estrelas, opcional), campo de texto (10 a 500 caracteres, com contador), botão "Publicar". Estado recusado: "Não deu pra publicar essa opinião. Tenta reescrever sem ofensas nem dados pessoais." Variação de edição (já preenchido).
3. **Sugestão de bar** — nome, endereço, bairro, opção "Estou no bar agora", pergunta "Tem chopp Brahma?" (Sim / Não sei), botão "Sugerir". Variação "Esse bar já estava aqui — sua confirmação foi registrada".
4. **Denúncia de opinião** — motivo opcional e botão "Denunciar".
5. **Resultado do Colarinhômetro** (guardanapo) — nota final grande, barrinhas de Altura do colarinho, Cremosidade, Copo e Gelado, comentário bem-humorado, nome do bar, botão "Compartilhar" e, quando houver, a celebração do carimbo novo. Variações: sem bar por perto (nota sem carimbo, oferece sugerir o bar); limite de carimbos ("Já foram 2 carimbos hoje. A nota ficou registrada; o carimbo deste bar te espera outro dia."); enviando (copo enchendo); na fila sem rede ("vai enviar quando a rede voltar").

### T6 — Ficha do bar (bottom sheet sobre o Chat)
Nome, bairro, endereço, distância, pílula de status, pílulas de atributos, nota média do colarinho (com quantas fotos), nota média das opiniões, "confirmado há X dias por N pessoas", resumo das opiniões feito pela IA (quando houver), lista de opiniões (apelido, nota em copinhos, data, texto, "Denunciar"), botões "Como chegar", "Chamar Uber", "Tem Brahma?", "Dar opinião". Estado sem opiniões: "Ninguém opinou ainda. Seja o primeiro." Mostre também uma opinião própria oculta com o aviso "oculta".

### T7 — Câmera do Colarinhômetro
Visor em tela cheia com guia de enquadramento em forma de copo, dica "Copo no meio, colarinho à vista", botão de disparo grande, botão fechar. Sem botão de galeria. Depois da foto: card sobre a imagem perguntando "É chopp Brahma?" com "Sim" / "Não" / "Não sei". Estado de erro: "Hmm, isso não parece um chopp. Tenta de novo com o copo bem no meio da foto."

### T8 — Passaporte
Título em letreiro pintado à mão. Total de bares carimbados; grade de carimbos (nome do bar e data); coleções por bairro com barra de progresso e selo "Bairro conquistado"; coleção "Clássicos"; selos ("Primeira tirada", "Explorador" em 3 níveis, "Andarilho", "Olho clínico", "Informante"), os não conquistados em cinza. Estado vazio: "Seu passaporte tá em branco. Tira a foto do próximo chopp e ganha o primeiro carimbo." Nenhum número de quantidade de chopp.

### T9 — Perfil
Apelido e time (editáveis), "Limpar conversa", "Termos de uso", "Política de privacidade", aviso fixo "Seu passaporte fica neste celular. Se reinstalar o app ou trocar de aparelho, ele não volta.", "Apagar meus dados" (confirmação em duas etapas: "Isso apaga seu apelido, fotos, carimbos, opiniões e conversa. Não dá pra desfazer." e o botão final "Apagar tudo"). Não há botão "Sair". Rodapé fixo: "Beba com moderação. Se beber, não dirija."

### T10 — Bloqueio de menor
Bolacha com expressão gentil e o texto "Aqui é só pra maiores de 18. Volta daqui a pouco, que o chopp espera."

## Entregáveis
Todas as telas e estados acima em modo claro e escuro, mais uma página com os componentes (card-comanda, pílulas, botões, cards de entrada, guardanapo, carimbo, selo, mascote em 4 expressões) e as anotações das microanimações.
