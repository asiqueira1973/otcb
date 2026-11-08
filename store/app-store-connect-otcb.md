# App Store Connect — conteúdo pronto para colar (OTCB)

Gerado no épico 8.11 com o skill `app-store-dablab`, a partir do `spec.md` (seções 1, 3, 4, 8, 15.10 e 20).
Checado contra os limites vigentes da App Store Connect (resultado no fim). Localização: Português (Brasil).
Regra da marca: nenhum texto desta ficha cita a marca de cerveja que o app procura (nota sobre a marca do spec; hook `guard-store-brand.sh`).

---

## App Information

- **Nome (≤30):** OTCB
- **Subtítulo (≤30):** Chopp bem tirado em SP
- **Categoria primária:** Food & Drink
- **Categoria secundária:** Lifestyle
- **Copyright:** © 2026 Alexandre Siqueira
- **Bundle ID:** com.dablab.otcb
- **SKU:** com.dablab.otcb
- **Dispositivos:** só iPhone (sem iPad)

---

## Version Information

### Texto promocional (≤170)

Pergunta onde tem chopp bem tirado em São Paulo e o OTCB responde: bares perto de você, nota do colarinho por IA, onde passa o jogo e um passaporte de bares.

### Descrição (≤4.000)

Pergunta onde tem chopp bem tirado e o OTCB responde.

O OTCB é um assistente de conversa para quem gosta de chopp em São Paulo. Você escreve do seu jeito ("chopp perto de mim com balcão", "onde ver o jogo do Corinthians hoje em Pinheiros") e ele responde com os bares certos, em cards com mapa, rota e o que a comunidade já confirmou.

CONVERSA EM VEZ DE LISTA
• Um assistente com inteligência artificial entende a pergunta e busca na nossa base de bares.
• Cada bar mostra se a informação está confirmada ou a confirmar, há quanto tempo foi vista e a distância até você.
• Mini mapa, rota e Uber direto do card.

COLARINHÔMETRO
• Tire uma foto do seu chopp e a IA dá a nota da tirada: altura do colarinho, cremosidade, copo e temperatura aparente.
• A foto confirma o bar na hora e vale carimbo no seu Passaporte.

PASSAPORTE DE BARES
• Carimbos por bar visitado, coleções por bairro e selos por descoberta.
• Recompensa por conhecer bares diferentes, nunca por quantidade.

ONDE VER O JOGO
• Jogos do dia do Brasileirão e das principais ligas.
• Bares que passam o jogo perto de você ou no bairro que você pedir.

OPINIÕES E COMUNIDADE
• Opine sobre o bar, confirme em um toque se ainda serve chopp, se passa jogo ou se fechou.
• As opiniões passam por moderação e cada bar ganha um resumo do que a galera disse.

UMA BASE QUE SE MANTÉM SOZINHA
• Um robô revisita os bares todo dia e a informação perde força com o tempo, então o que você vê está sempre fresco.

SEM CADASTRO
• Você usa sem e-mail, sem telefone e sem senha. Escolhe só um apelido.
• "Apagar meus dados" fica no Perfil e apaga tudo na hora.

Beba com moderação. Proibido para menores de 18 anos.

### Keywords (≤100 bytes)

bar,boteco,cerveja,happy hour,jogo,futebol,colarinho,passaporte,bares perto,onde beber,sao paulo

### Notas da versão (What's New)

Primeira versão do OTCB: conversa para achar chopp bem tirado em São Paulo, Colarinhômetro com nota por IA, Passaporte de bares, onde ver o jogo e opiniões da comunidade.

---

## App Privacy (questionário)

**Resposta: o app coleta dados** (há backend próprio no Supabase e envio de conteúdo para processamento por IA). Nada é usado para rastreamento (tracking) nem para publicidade. Marcar:

| Categoria da Apple | O que é no OTCB (spec, seção 20) | Vinculado à identidade? | Finalidade | Tracking |
|---|---|---|---|---|
| Location → Precise Location | Localização enviada só na hora de uma pergunta ou foto, para achar bares perto; não é guardada (da foto fica só a distância até o bar) | Não | App Functionality | Não |
| User Content → Photos or Videos | Fotos do Colarinhômetro (bucket privado, até a pessoa apagar) | Sim | App Functionality | Não |
| User Content → Other User Content | Mensagens do chat (30 dias), opiniões, confirmações e sugestões de bares | Sim | App Functionality | Não |
| Identifiers → User ID | Identidade anônima do aparelho (sem e-mail, telefone ou nome), apelido | Sim | App Functionality | Não |
| Usage Data → Product Interaction | Eventos de uso sem texto, localização ou foto (Visão de Produto) | Sim (ID anônimo) | Analytics | Não |

Não coletados: Contact Info, Health & Fitness, Financial Info, Browsing History, Search History fora do chat, Contacts, Diagnostics (não há Crashlytics/Sentry), identificador de publicidade.

---

## URLs obrigatórias

- **Support URL:** https://suportedablab.carrd.co/
- **Privacy Policy URL:** o link público do documento "Política de Privacidade — Aplicativos da Dab Lab" no Notion (o mesmo dos outros apps), depois de colar nele a seção abaixo.
- **Marketing URL:** em branco.

### Seção nova para colar no documento de privacidade (Notion)

> **OTCB**
>
> **1. Coleta de Dados.** O OTCB funciona sem cadastro: o app cria uma identidade anônima no aparelho e não pede e-mail, telefone nem nome. Guardamos o apelido e o time do coração que você escolher, o momento em que você confirmou ter 18 anos ou mais (a data de nascimento não é guardada), as fotos que você enviar ao Colarinhômetro, as mensagens trocadas com o assistente, e as opiniões, confirmações e sugestões de bares que você enviar. A localização é usada só no momento de uma pergunta ou de uma foto, com a sua permissão, e não é guardada; da foto, guardamos apenas a distância até o bar. O app usa a câmera só para fotografar o chopp; não acessa a galeria, o microfone nem envia notificações. O OTCB não usa Firebase, Crashlytics nem identificador de publicidade.
>
> **2. Uso dos Dados.** Os dados servem para responder às suas perguntas, dar a nota do colarinho, montar o seu Passaporte, mostrar opiniões e manter a base de bares atualizada. Contamos eventos de uso do app (por exemplo, "uma foto foi avaliada"), sem o texto das mensagens, sem localização e sem fotos, para melhorar o produto. Não usamos dados para publicidade nem para rastreamento entre apps.
>
> **3. Armazenamento e Segurança.** Os dados ficam no Supabase, com acesso restrito por usuário. As fotos ficam num armazenamento privado. As mensagens do chat são apagadas após 30 dias; as fotos ficam até você apagar. Em Perfil › "Apagar meus dados" você apaga apelido, fotos, carimbos, opiniões e conversa na hora; confirmações sobre bares continuam na base sem ligação com você.
>
> **4. Compartilhamento com Terceiros.** Os textos do chat e as fotos são enviados à Anthropic (Claude API) apenas para processamento por inteligência artificial (resposta do assistente, nota do colarinho e moderação de opiniões). O apelido aparece publicamente junto às suas opiniões. Não vendemos dados.
>
> **5. Contato.** Para dúvidas ou para pedir uma cópia dos seus dados (atendida em até 15 dias): alexandre@dablab.com.br.

---

## Pricing and Availability

- **Preço:** Grátis (Tier 0). Sem In-App Purchase.
- **Disponibilidade:** só Brasil (decisão do Alexandre, 8.11; o conteúdo cobre a cidade de São Paulo).

---

## App Review Information

- **Sign-in Required:** **Não.** O app não tem login: cria uma identidade anônima no aparelho (spec, seção 6). O revisor entra direto pelo onboarding.
- **Contact Information:** Alexandre Siqueira · alexandre@dablab.com.br
- **Notes:**

```
OTCB is a conversational assistant (in Brazilian Portuguese) for finding well-poured draft beer in São Paulo, Brazil. It is NOT a static list of bars — it is a native, AI-powered experience that only makes sense on a phone:

1. AI CHAT AGENT (main screen): the user asks in natural language ("chopp perto de mim com balcão", "onde ver o jogo do Corinthians hoje") and an AI agent (Claude API, tool use over our own database) answers with interactive cards: bar cards with confirmation status and freshness, a mini map, route and ride buttons, and input cards (one-tap confirmations, opinion and bar-suggestion forms).
2. COLARINHÔMETRO (camera): the user photographs their glass in the bar; AI vision scores the pour (foam height, creaminess, glass, apparent temperature). The photo, combined with the current location (≤150 m from a bar), confirms the bar and grants a stamp. Camera only — no photo library.
3. PASSPORT: stamps per bar visited, neighborhood collections and badges for discovery. It rewards visiting different bars, never quantity consumed (no drinking challenges; daily stamp limit).
4. WHERE TO WATCH THE GAME: today's football matches plus bars nearby that show games.
5. COMMUNITY: moderated opinions (keyword filter + AI moderation, reporting), AI summary per bar, one-tap confirmations. A daily server-side crawler keeps the bar database fresh and evidence decays over time.

HOW TO TEST: no account needed. Open the app → "Bora começar" → enter any birth date 18+ years ago (e.g. 15/03/1990) → choose any nickname → allow or skip location → you are in the chat. Try the suggestion chips ("Onde ver o jogo hoje?", "Bar com balcão em Pinheiros"). Location: we suggest setting the simulator/device location to São Paulo (e.g. -23.567, -46.693, Largo da Batata) — the content covers São Paulo only.

AGE GATE AND RESPONSIBLE USE: users under 18 are blocked at onboarding and their anonymous identity is deleted. The chat has deterministic guardrails (drinking and driving, minors, quantity challenges, alcohol purchase). The app does not sell or deliver alcohol. "Beba com moderação. Se beber, não dirija." is shown in the Profile.

PRIVACY: Terms of Use and Privacy Policy are inside the app (Profile). "Apagar meus dados" (Delete my data) in Profile deletes the nickname, photos, stamps, opinions and chat on the server immediately and starts a fresh anonymous identity. There is no login, password or logout because there is no account.

PERMISSIONS: Camera — only to photograph the beer for the pour score. Location (when in use) — only at the moment of a question or a photo, to find nearby bars; it is not stored.

Support website: https://suportedablab.carrd.co/
Contact: alexandre@dablab.com.br
```

---

## App Encryption Documentation

**Resposta: "None of the algorithms mentioned above".** O app só faz chamadas HTTPS por frameworks padrão (fetch do React Native / supabase-js); não implementa criptografia própria. Já declarado no build: `ios.config.usesNonExemptEncryption: false` (`ITSAppUsesNonExemptEncryption = NO`), então o build não deve pedir "Missing Compliance".

---

## Content Rights

**Resposta recomendada: "No, it does not contain, show, or access third-party content".**

Ressalva para você confirmar: o app mostra dados que vêm de terceiros e são processados pelo nosso servidor — nome, endereço e status de funcionamento de bares (Google Places API) e o calendário de jogos (football-data.org). Não há conteúdo licenciado embutido (imagens, trilhas, fontes de terceiros fora das licenças abertas), e esses dados são exibidos dentro dos termos das APIs. Se preferir a leitura mais conservadora, marque "Yes" e declare que tem os direitos de uso pelos termos das APIs.

---

## Classificação etária (Age Rating)

**Expectativa: 18+.** O questionário oficial da Apple é que decide; respostas que levam a isso:

- Alcohol, Tobacco, or Drug Use or References: **Frequent/Intense** (o app inteiro é sobre bares e chopp).
- User-Generated Content: **Yes** — opiniões públicas com apelido, moderadas (filtro + IA) e com denúncia.
- Unrestricted Web Access: No · Gambling/Contests: No · Violence/Sexual content/Profanity: None.
- AI-generated content / chatbot: Yes (assistente de conversa com guardrails).
- Marcar a restrição de idade 18+ (spec 8.11: classificação 18+ na App Store).

---

## Resultado da checagem de limites (scripts/check_limits.py)

Rodado em 08/11/2026:

```
Nome: 4/30 caracteres [OK]
Subtítulo: 22/30 caracteres [OK]
Texto promocional: 157/170 caracteres [OK]
Descrição: 1664/4000 caracteres [OK]
Keywords: 96/100 bytes [OK]
Notas da versão (What's New): 170/4000 caracteres [OK]
Notas de revisão (App Review): 2722/4000 caracteres [OK]
```
