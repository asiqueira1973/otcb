// Avaliação do agente do chat (seção 22; épico 8.4): roda as perguntas de avaliacao.json contra a
// otcb-agente publicada no BANCO DE TESTE, confere o esperado e mede a latência (critério 8: p95 < 8 s).
// Cria um usuário anônimo descartável, limpa a conversa antes de cada pergunta (critério 7) e apaga a conta
// no fim (otcb-apagar-conta). Uso: npm run agente:avaliar [-- --repetir N]. Não imprime chaves nem tokens.
import { readFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

type Espera = {
  status?: number; bloqueada_guardrail?: boolean; texto_igual?: string;
  algum_bloco?: string[]; sem_blocos?: boolean; acoes?: string[];
  bares_incluem?: string[]; bairro?: string; max_distancia_m?: number; so_status_visiveis?: boolean;
  texto_contem?: string[]; texto_nao_contem?: string[];
};
type Pergunta = { id: string; pergunta: string; local?: string; espera: Espera };
type CardBar = { nome: string; bairro: string; status: string; distancia_metros: number | null };
type Bloco = { tipo: string; bares?: CardBar[]; bar?: CardBar; pontos?: { nome: string; status: string }[]; acao?: string };

const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const arquivo = JSON.parse(readFileSync("supabase/functions/otcb-agente/avaliacao.json", "utf8")) as {
  locais: Record<string, { latitude: number; longitude: number }>; perguntas: Pergunta[];
};

// Bares citados nos blocos (lista, card e mapa).
function baresDosBlocos(blocos: Bloco[]): CardBar[] {
  return blocos.flatMap((b) => b.tipo === "lista_bares" ? b.bares ?? [] : b.tipo === "card_bar" && b.bar ? [b.bar]
    : b.tipo === "mapa" ? (b.pontos ?? []).map((p) => ({ ...p, bairro: "", distancia_metros: null })) : []);
}

// Confere a resposta contra o esperado. Devolve: lista de falhas (vazia = passou).
function conferir(e: Espera, status: number, corpo: { texto?: string; blocos?: Bloco[]; bloqueada_guardrail?: boolean }): string[] {
  const falhas: string[] = [];
  const blocos = corpo.blocos ?? [];
  const texto = (corpo.texto ?? "").toLowerCase();
  const bares = baresDosBlocos(blocos);
  if (e.status !== undefined && status !== e.status) falhas.push(`status ${status}`);
  if (e.bloqueada_guardrail !== undefined && corpo.bloqueada_guardrail !== e.bloqueada_guardrail) falhas.push("guardrail");
  if (e.texto_igual && corpo.texto !== e.texto_igual) falhas.push("texto fixo diferente");
  if (e.algum_bloco && !blocos.some((b) => e.algum_bloco!.includes(b.tipo))) falhas.push(`sem bloco ${e.algum_bloco.join("/")}`);
  if (e.sem_blocos && blocos.some((b) => b.tipo !== "acao")) falhas.push("blocos inesperados");
  for (const a of e.acoes ?? []) if (!blocos.some((b) => b.tipo === "acao" && b.acao === a)) falhas.push(`sem ação ${a}`);
  for (const n of e.bares_incluem ?? []) if (!bares.some((b) => b.nome === n)) falhas.push(`sem ${n}`);
  if (e.bairro && bares.some((b) => b.bairro && b.bairro !== e.bairro)) falhas.push("bar de outro bairro");
  if (e.max_distancia_m && bares.some((b) => b.distancia_metros !== null && b.distancia_metros > e.max_distancia_m!)) falhas.push("bar fora do raio");
  if (e.so_status_visiveis !== false && bares.some((b) => !["confirmado", "provavel", "incerto"].includes(b.status))) falhas.push("status invisível");
  for (const r of e.texto_contem ?? []) if (!new RegExp(r, "i").test(texto)) falhas.push(`texto sem /${r}/`);
  for (const r of e.texto_nao_contem ?? []) if (new RegExp(r, "i").test(texto)) falhas.push(`texto com /${r}/`);
  return falhas;
}

function p95(ms: number[]): number {
  const o = [...ms].sort((a, b) => a - b);
  return o[Math.min(o.length - 1, Math.ceil(o.length * 0.95) - 1)];
}

async function main() {
  const repetir = Number(process.argv[process.argv.indexOf("--repetir") + 1]) || 1;
  const supa = createClient(url, anon, { auth: { persistSession: false } });
  const { data: sessao, error } = await supa.auth.signInAnonymously();
  if (error || !sessao.session) throw new Error("falha no login anônimo");
  const uid = sessao.user!.id;
  const token = sessao.session.access_token;
  const { error: ePerfil } = await supa.from("otcb_perfis").insert({ id: uid, apelido: `aval_${uid.slice(0, 8)}`, maioridade_confirmada_em: new Date().toISOString() });
  if (ePerfil) throw new Error(`perfil: ${ePerfil.message}`);

  const tempos: number[] = [];
  let passou = 0;
  try {
    for (let r = 0; r < repetir; r++) {
      for (const p of arquivo.perguntas) {
        await supa.from("otcb_mensagens").delete().eq("usuario_id", uid); // critério 7: cada pergunta sem contexto
        const local = p.local ? arquivo.locais[p.local] : undefined;
        const t0 = Date.now();
        const res = await fetch(`${url}/functions/v1/otcb-agente`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, apikey: anon, "Content-Type": "application/json" },
          body: JSON.stringify({ mensagem: p.pergunta, ...(local ?? {}) }),
        });
        const ms = Date.now() - t0;
        const corpo = await res.json().catch(() => ({}));
        if (!corpo.bloqueada_guardrail && res.status === 200) tempos.push(ms);
        const falhas = conferir(p.espera, res.status, corpo);
        if (falhas.length === 0) passou += 1;
        const tipos = (corpo.blocos ?? []).map((b: Bloco) => b.tipo + (b.acao ? `:${b.acao}` : "")).join(",");
        console.log(`${falhas.length ? "FALHOU" : "ok    "} ${p.id.padEnd(20)} ${String(ms).padStart(6)} ms  [${tipos}]  ${falhas.join("; ")}`);
        console.log(`        ↳ ${(corpo.texto ?? "").replace(/\s+/g, " ").slice(0, 160)}`);
      }
    }
  } finally {
    await fetch(`${url}/functions/v1/otcb-apagar-conta`, { method: "POST", headers: { Authorization: `Bearer ${token}`, apikey: anon } });
  }
  const total = arquivo.perguntas.length * repetir;
  console.log(`\n${passou}/${total} passaram. Latência (respostas do modelo, n=${tempos.length}): p50 ${[...tempos].sort((a, b) => a - b)[Math.floor(tempos.length / 2)]} ms, p95 ${p95(tempos)} ms.`);
  if (passou < total) process.exitCode = 1;
}

main().catch((e) => { console.error(e instanceof Error ? e.message : "erro"); process.exitCode = 1; });
