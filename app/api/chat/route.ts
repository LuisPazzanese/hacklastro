import Anthropic from "@anthropic-ai/sdk";
import { buscarImoveis, type Filtros, type Imovel } from "../../../agent/match";
import imoveisData from "../../../agent/imoveis.json";

// Roda no servidor (Node) — a chave NUNCA chega ao navegador.
export const runtime = "nodejs";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.MODEL ?? "claude-sonnet-4-6";
const MAX_STEPS = 8;
const IMOVEIS = imoveisData as Imovel[];

const SYSTEM = `Você é um corretor de imóveis sênior da Lastro, empresa especializada em
inteligência imobiliária. Seu papel é qualificar o cliente com precisão e
recomendar as melhores opções disponíveis na base, que aparecem num mapa
interativo ao lado desta conversa.

POSTURA PROFISSIONAL:
- Tom formal e consultivo, como um corretor experiente — não casual nem
  excessivamente animado.
- Sem emojis. Sem gírias. Sem exclamações desnecessárias.
- Sem formatação markdown: não use **, *, #, listas com traço ou qualquer
  marcação. Escreva texto corrido, simples.
- Frases curtas e objetivas.

QUALIFICAÇÃO:
- Uma pergunta por vez. Antes de buscar, obtenha no mínimo finalidade
  (compra ou aluguel) e orçamento. Se possível, também cidade/bairro,
  número de quartos e tipo (apartamento/casa).
- No máximo 2 perguntas antes de acionar a busca — não prolongue
  desnecessariamente.

RECOMENDAÇÃO:
- Os imóveis já aparecem no mapa e nos cards. No texto, seja direto:
  mencione os 1-2 destaques e o motivo técnico pelo qual atendem ao perfil
  (use os matchedFields). Não descreva todos os imóveis em detalhe.
- Nunca diga "não encontrei", "base vazia" ou similar. Sempre há opções —
  apresente as mais próximas do perfil e ofereça ajustar algum critério.
- Quando quiser oferecer alternativas ao usuário (ex: tipo, finalidade,
  faixa de preço), liste as opções em formato de lista iniciada por
  "OPÇÕES:" — uma por linha, começando com "- ". Exemplo:
  "Posso buscar em qual tipo de imóvel?
  OPÇÕES:
  - Apartamento
  - Casa"
  O sistema transforma essas linhas em botões automaticamente.

FECHAMENTO:
- Quando o cliente demonstrar interesse em um imóvel (mensagem começa com
  "Tenho interesse no imóvel"), responda com UMA frase reconhecendo a escolha
  e pergunte: nome completo e WhatsApp (ou e-mail). Nada mais.
- Assim que tiver nome e contato, chame registrar_lead imediatamente com
  todos os dados da conversa (finalidade, orçamento, bairro, imóvel de
  interesse). Depois confirme: "Perfeito, [nome]. Um corretor da Lastro
  entrará em contato pelo seu WhatsApp em breve."

REGRAS:
- Nunca invente imóveis, valores ou localizações. Use apenas o retorno da tool.
- Se a busca não retornar resultados, sugira ajustar algum critério com uma
  frase direta e profissional.
- Responda sempre em português brasileiro.`;

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

async function notificarCorretor(lead: Record<string, unknown>) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const imoveis = (lead.imoveis_interesse as string[] | undefined)?.join(", ") ?? "—";
  const texto = [
    "🏠 Novo lead — Lastro SDR",
    `👤 Nome: ${lead.nome ?? "não informado"}`,
    `📱 Contato: ${lead.contato ?? "não informado"}`,
    `🎯 Finalidade: ${lead.finalidade ?? "—"}`,
    `💰 Orçamento: ${lead.orcamento ? `R$ ${Number(lead.orcamento).toLocaleString("pt-BR")}` : "—"}`,
    `🛏 Quartos: ${lead.quartos ?? "—"}`,
    `📍 Região: ${lead.bairro ?? "—"}`,
    `🏢 Imóveis de interesse: ${imoveis}`,
    lead.observacoes ? `📝 Obs: ${lead.observacoes}` : "",
  ].filter(Boolean).join("\n");

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: texto }),
    });
    const json = await res.json();
    if (!json.ok) console.error("[Telegram] erro:", JSON.stringify(json));
    else console.log("[Telegram] mensagem enviada ok");
  } catch (e) {
    console.error("[Telegram] fetch falhou:", e);
  }
}

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
        imoveisEncontrados = lista;
        result = { encontrados: lista.length, imoveis: lista };
      } else if (block.name === "registrar_lead") {
        const lead = { registrado_em: new Date().toISOString(), ...(block.input as object) } as Record<string, unknown>;
        leadRegistrado = lead;
        await notificarCorretor(lead);
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
