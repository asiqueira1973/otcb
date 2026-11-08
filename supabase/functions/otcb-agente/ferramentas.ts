import type Anthropic from "npm:@anthropic-ai/sdk@^0";

import { CacheTurno, montarBlocos, paraCardBar } from "./blocos.ts";
import type { AgenteDb, Bloco, CardBar } from "./tipos.ts";

// Ferramentas do agente (seção 13.3). Nenhuma grava dado do usuário (o agente não escreve no banco; 8.5).

export const FERRAMENTAS: Anthropic.Tool[] = [
  {
    name: "buscar_bares",
    description: "Busca bares com chopp Brahma (regra 11.9) por nome (texto), bairro ou perto de um ponto. Sem texto e sem bairro, busca perto da pessoa. Devolve bares ordenados por status e distância.",
    input_schema: {
      type: "object",
      properties: {
        texto: { type: "string", description: "Nome do bar ou bairro, livre." },
        bairro: { type: "string" },
        latitude: { type: "number", description: "Latitude do ponto de busca (a da pessoa vem no contexto, quando ela permitiu)." },
        longitude: { type: "number" },
        raio_metros: { type: "integer", description: "Padrão 2000; máximo 10000." },
        tem_balcao: { type: "boolean" },
        transmite_jogos: { type: "boolean" },
        classico: { type: "boolean" },
      },
    },
  },
  {
    name: "detalhes_bar",
    description: "Detalhes de um bar pelo id: endereço, status, notas, última confirmação e resumo das opiniões.",
    input_schema: { type: "object", properties: { bar_id: { type: "string" } }, required: ["bar_id"] },
  },
  {
    name: "opinioes_do_bar",
    description: "Opiniões publicadas de um bar (até 10 por página): apelido, nota, texto e data.",
    input_schema: { type: "object", properties: { bar_id: { type: "string" }, pagina: { type: "integer" } }, required: ["bar_id"] },
  },
  {
    name: "jogos_de_hoje",
    description: "Jogos de futebol de hoje ou dos próximos dias (0 a 7), opcionalmente de um time.",
    input_schema: { type: "object", properties: { time: { type: "string" }, dias_a_frente: { type: "integer" } } },
  },
  {
    name: "meu_passaporte",
    description: "Resumo do Passaporte da pessoa: carimbos, bairros conquistados e selos.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "mostrar",
    description: "Mostra cards na resposta. Use os ids que vieram das outras ferramentas. Tipos: lista_bares (titulo, bar_ids), card_bar (bar_id), mapa (bar_ids), jogos (jogo_ids), passaporte, acao (acao: abrir_rota | chamar_uber | abrir_ficha | abrir_camera | abrir_passaporte; bar_id quando for de um bar; rotulo curto).",
    input_schema: {
      type: "object",
      properties: {
        blocos: {
          type: "array",
          items: {
            type: "object",
            properties: {
              tipo: { type: "string", enum: ["lista_bares", "card_bar", "mapa", "jogos", "passaporte", "acao"] },
              titulo: { type: "string" },
              bar_id: { type: "string" },
              bar_ids: { type: "array", items: { type: "string" } },
              jogo_ids: { type: "array", items: { type: "string" } },
              acao: { type: "string", enum: ["abrir_rota", "chamar_uber", "abrir_ficha", "abrir_camera", "abrir_passaporte"] },
              rotulo: { type: "string" },
            },
            required: ["tipo"],
          },
        },
      },
      required: ["blocos"],
    },
  },
];

// Versão do CardBar mostrada ao modelo: "incerto" vira "a_confirmar" (critério 4 do 8.4).
function paraModelo(b: CardBar) {
  return {
    bar_id: b.bar_id, nome: b.nome, bairro: b.bairro, endereco: b.endereco,
    status: b.status === "incerto" ? "a_confirmar" : b.status,
    distancia_metros: b.distancia_metros, tem_balcao: b.tem_balcao, transmite_jogos: b.transmite_jogos, classico: b.classico,
    nota_colarinho_media: b.nota_colarinho_media, nota_opinioes_media: b.nota_opinioes_media, qtd_opinioes: b.qtd_opinioes,
    ultima_confirmacao_em: b.ultima_confirmacao_em, resumo_opinioes: b.resumo_opinioes,
  };
}

export type Turno = { cache: CacheTurno; blocos: Bloco[]; local: { latitude: number; longitude: number } | null };

// Executa uma ferramenta. Recebe: nome, entrada, banco e turno. Devolve: o conteúdo (JSON) para o modelo.
// Erros viram { erro } para o modelo — a ferramenta nunca derruba a conversa.
export async function executarFerramenta(nome: string, entrada: Record<string, unknown>, db: AgenteDb, turno: Turno): Promise<string> {
  try {
    switch (nome) {
      case "buscar_bares": {
        // 13.3: latitude/longitude do modelo; sem elas e sem texto/bairro, usa a localização da pessoa no turno.
        const temPonto = typeof entrada.latitude === "number" && typeof entrada.longitude === "number";
        const ponto = temPonto ? { latitude: entrada.latitude as number, longitude: entrada.longitude as number }
          : (!entrada.texto && !entrada.bairro ? turno.local : null);
        const params: Record<string, unknown> = {
          p_texto: entrada.texto ?? null, p_bairro: entrada.bairro ?? null,
          p_raio_metros: entrada.raio_metros ?? null, p_tem_balcao: entrada.tem_balcao ?? null,
          p_transmite_jogos: entrada.transmite_jogos ?? null, p_classico: entrada.classico ?? null,
          p_latitude: ponto?.latitude ?? null,
          p_longitude: ponto?.longitude ?? null,
        };
        if (params.p_latitude === null && !params.p_texto && !params.p_bairro) {
          return JSON.stringify({ erro: "sem_localizacao", instrucao: "Peça o bairro ou o endereço." });
        }
        const linhas = await db.buscarBares(params);
        const bares = linhas.map((l) => paraCardBar(l, turno.local)).filter((b): b is CardBar => !!b);
        for (const b of bares) turno.cache.bares.set(b.bar_id, b);
        return JSON.stringify({ bares: bares.map(paraModelo) });
      }
      case "detalhes_bar": {
        const bar = paraCardBar(await db.detalhesBar(String(entrada.bar_id)), turno.local);
        if (!bar) return JSON.stringify({ erro: "bar_indisponivel" });
        turno.cache.bares.set(bar.bar_id, bar);
        return JSON.stringify({ bar: paraModelo(bar) });
      }
      case "opinioes_do_bar": {
        const ops = await db.opinioesDoBar(String(entrada.bar_id), Number(entrada.pagina ?? 0));
        return JSON.stringify({ opinioes: ops.map(({ apelido, nota, texto, criado_em }) => ({ apelido, nota, texto, criado_em })) });
      }
      case "jogos_de_hoje": {
        const dias = Math.min(Math.max(Number(entrada.dias_a_frente ?? 0), 0), 7);
        const jogos = await db.jogos(typeof entrada.time === "string" ? entrada.time : null, dias);
        for (const j of jogos) turno.cache.jogos.set(j.jogo_id, j);
        return JSON.stringify({ jogos });
      }
      case "meu_passaporte": {
        const p = await db.meuPassaporte();
        const carimbos = Array.isArray(p.carimbos) ? p.carimbos.length : 0;
        const bairros = Array.isArray(p.colecoes_bairro) ? p.colecoes_bairro.filter((c: { conquistado?: boolean }) => c.conquistado).length : 0;
        const selos = Array.isArray(p.selos) ? p.selos.filter((s: { conquistado?: boolean }) => s.conquistado) : [];
        turno.cache.passaporte = { total_carimbos: carimbos, bairros_conquistados: bairros, ultimo_selo: selos.length ? String(selos.at(-1).selo) : null };
        return JSON.stringify(turno.cache.passaporte);
      }
      case "mostrar": {
        const { blocos, descartados } = montarBlocos(entrada.blocos, turno.cache);
        turno.blocos.push(...blocos);
        return JSON.stringify({ mostrados: blocos.length, descartados });
      }
      default:
        return JSON.stringify({ erro: "ferramenta_desconhecida" });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    return JSON.stringify({ erro: /bar_inexistente/.test(msg) ? "bar_inexistente" : "falha_ferramenta" });
  }
}
