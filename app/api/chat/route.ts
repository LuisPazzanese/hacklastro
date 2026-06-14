import Anthropic from "@anthropic-ai/sdk";
import { buscarImoveis, type Filtros, type Imovel } from "../../../agent/match";
import imoveisData from "../../../agent/imoveis.json";

// Roda no servidor (Node) — a chave NUNCA chega ao navegador.
export const runtime = "nodejs";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.MODEL ?? "claude-sonnet-4-6";
const MAX_STEPS = 8;
const IMOVEIS = imoveisData as Imovel[];

const SYSTEM = `Você é o SDR (pré-vendas) imobiliário da Lastro — simpático, objetivo e
consultivo. Qualifica o lead numa conversa curta e recomenda imóveis da base, que
aparecem num mapa do Brasil ao lado da conversa.

COMO CONDUZIR:
- Uma pergunta por vez, em tom natural. Antes de buscar, descubra no MÍNIMO a
  finalidade (compra ou aluguel) e o orçamento; tente também cidade/bairro,
  quartos e tipo (apto/casa), mas não trave a conversa se o lead não souber.
- Faça no máximo 2-3 perguntas. Assim que tiver finalidade + orçamento, chame
  a tool buscar_imoveis.

AO RECOMENDAR:
- Os imóveis aparecem no mapa e em cards ao lado, então seja BREVE no texto:
  destaque os 1-2 melhores em uma ou duas frases, dizendo por que casam (use os
  matchedFields). Não descreva todos em detalhe — o mapa e os cards fazem isso.

FECHAMENTO:
- Quando o lead curtir um imóvel ou pedir visita, peça nome e um contato de forma
  natural e chame registrar_lead. Depois confirme que um corretor dará seguimento.

REGRAS:
- Nunca invente imóveis, preços ou bairros — use só o que a tool devolveu.
- Se a busca não achar nada, sugira relaxar um critério.
- Responda sempre em português brasileiro, caloroso e conciso.`;

const tools: Anthropic.Tool[] = [
  {
    name: "buscar_imoveis",
    description:
      "Busca imóveis compatíveis na base. Use só depois de ter finalidade " +
      "(compra/aluguel) e orçamento. Retorna imóveis ordenados por " +
      "compatibilidade, cada um com matchedFields (o que casou) — use para " +
      "justificar as recomendações.",
    input_schema: {
      type: "object",
      properties: {
        finalidade: { type: "string", enum: ["compra", "aluguel"] },
        orcamento: { type: "number", description: "Teto de preço em reais." },
        quartos: { type: "number", description: "Número de quartos desejado." },
        bairro: { type: "string", description: "Cidade, bairro ou região." },
        tipo: { type: "string", enum: ["apartamento", "casa"] },
      },
      required: ["finalidade"],
    },
  },
  {
    name: "registrar_lead",
    description:
      "Registra o lead qualificado no CRM para o corretor dar seguimento. Use " +
      "quando o lead curtir um imóvel ou pedir contato/visita. Capture o que " +
      "souber da conversa; não invente dados.",
    input_schema: {
      type: "object",
      properties: {
        nome: { type: "string" },
        contato: { type: "string", description: "Telefone ou e-mail." },
        finalidade: { type: "string", enum: ["compra", "aluguel"] },
        orcamento: { type: "number" },
        quartos: { type: "number" },
        bairro: { type: "string" },
        tipo: { type: "string", enum: ["apartamento", "casa"] },
        imoveis_interesse: { type: "array", items: { type: "string" } },
        observacoes: { type: "string" },
      },
      required: ["finalidade"],
    },
  },
];

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { reply: "Configuração faltando: ANTHROPIC_API_KEY não definida no servidor." },
      { status: 500 },
    );
  }

  const body = await req.json();
  const history: Anthropic.MessageParam[] = body.messages ?? [];

  let imoveisEncontrados: unknown[] = [];
  let leadRegistrado: unknown = null;

  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM,
      tools,
      messages: history,
    });

    history.push({ role: "assistant", content: res.content });

    if (res.stop_reason !== "tool_use") {
      const reply = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      return Response.json({
        messages: history,
        reply,
        imoveis: imoveisEncontrados,
        lead: leadRegistrado,
      });
    }

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of res.content) {
      if (block.type !== "tool_use") continue;
      let result: unknown;

      if (block.name === "buscar_imoveis") {
        const encontrados = buscarImoveis(block.input as Filtros, IMOVEIS);
        const lista = encontrados.map((r) => ({
          ...r.imovel,
          compatibilidade: Number(r.score.toFixed(2)),
          matchedFields: r.matchedFields,
        }));
        if (lista.length) imoveisEncontrados = lista;
        result = lista.length
          ? { encontrados: lista.length, imoveis: lista }
          : { encontrados: 0, aviso: "Nenhum imóvel bateu. Sugira relaxar um critério." };
      } else if (block.name === "registrar_lead") {
        leadRegistrado = { registrado_em: new Date().toISOString(), ...(block.input as object) };
        result = { ok: true, mensagem: "Lead registrado no CRM. Um corretor dará seguimento." };
      } else {
        result = { error: `tool desconhecida: ${block.name}` };
      }

      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(result),
      });
    }

    history.push({ role: "user", content: toolResults });
  }

  return Response.json({
    messages: history,
    reply: "Desculpe, me enrolei aqui. Pode repetir?",
    imoveis: imoveisEncontrados,
    lead: leadRegistrado,
  });
}
