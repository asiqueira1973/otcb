# Google Play Console — conteúdo pronto para colar (OTCB)

Épico 8.11. Mesmo conteúdo da ficha da App Store (`store/app-store-connect-otcb.md`), adaptado aos campos do Play.
Sem a marca de cerveja em nenhum campo (nota sobre a marca do spec; hook `guard-store-brand.sh`).

## Detalhes do app

- **Nome do app (≤30):** OTCB
- **Pacote:** com.dablab.otcb
- **Descrição breve (≤80):** Pergunta onde tem chopp bem tirado em SP e o OTCB responde.
- **Descrição completa (≤4.000):** a mesma descrição da App Store (seção "Descrição" do arquivo da App Store), sem alterações.
- **Categoria:** Comidas e bebidas
- **Tags:** Bares, Vida noturna
- **E-mail de contato:** alexandre@dablab.com.br
- **Site:** https://suportedablab.carrd.co/
- **Política de privacidade:** o mesmo link público do Notion usado na App Store (com a seção do OTCB).

## Classificação de conteúdo (questionário IARC)

- Categoria: Referência, notícias ou educação → não; **Social ou comunicação / Outros apps com conteúdo gerado por usuários**.
- Álcool, tabaco ou drogas: **Sim — referências e incentivo ao uso responsável de álcool** (o app é sobre bares e chopp; não vende bebida).
- Conteúdo gerado por usuários: **Sim**, com moderação (filtro + IA) e denúncia.
- Compras digitais: Não · Anúncios: Não · Localização compartilhada com outros usuários: Não.
- Expectativa: **18+**.

## Público-alvo e conteúdo

- **Faixa etária do público-alvo:** somente **18 anos ou mais** (spec 8.11).
- **Atrai crianças?** Não.
- **Anúncios:** o app não contém anúncios.
- **Acesso ao app:** todas as funções disponíveis sem login (identidade anônima). Instruções iguais às notas do App Review: data de nascimento 18+ (ex.: 15/03/1990), qualquer apelido.

## Segurança dos dados (Data safety)

- **Coleta dados?** Sim. **Compartilha com terceiros?** Sim, só para processamento (Anthropic / Claude API: textos do chat e fotos) — marcar como "processamento em nome do desenvolvedor" (prestador de serviço), não compartilhamento.
- **Criptografia em trânsito:** Sim (HTTPS).
- **O usuário pode pedir exclusão?** Sim — "Apagar meus dados" no Perfil, imediato; e pelo e-mail de contato.

| Tipo de dado (Play) | Coletado | Opcional? | Finalidade |
|---|---|---|---|
| Local → Local exato | Sim, efêmero (processado na hora, não guardado) | Sim (permissão) | Funcionalidade do app |
| Fotos e vídeos → Fotos | Sim | Sim (só se usar o Colarinhômetro) | Funcionalidade do app |
| Mensagens no app / Outro conteúdo gerado pelo usuário | Sim (chat 30 dias, opiniões) | Sim | Funcionalidade do app |
| IDs do app → ID do usuário | Sim (identidade anônima) | Não | Funcionalidade do app, Análise |
| Atividade no app → Interações | Sim (eventos sem texto nem local) | Não | Análise |

Não coletados: informações pessoais (nome, e-mail, telefone), financeiras, saúde, contatos, histórico de navegação, IDs de publicidade, diagnóstico.

## Países

- Só Brasil (decisão do Alexandre, 8.11).

## Primeira versão

- **Faixa:** teste interno primeiro (`eas submit` com `track: internal`, `releaseStatus: draft`), depois produção.
- **Notas da versão (≤500):** Primeira versão do OTCB: conversa para achar chopp bem tirado em São Paulo, Colarinhômetro com nota por IA, Passaporte de bares, onde ver o jogo e opiniões da comunidade.
- **Gráficos:** ícone 512×512 (`assets/icon.png` reduzido), imagem de destaque 1024×500 e prints em `store/screenshots/android/`.
