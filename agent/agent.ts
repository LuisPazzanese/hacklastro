import Anthropic from "@anthropic-ai/sdk";
import * as fs from "node:fs";
import * as path from "node:path";
import { buscarImoveis, type Filtros } from "./match";

/**
 * SDR Imobiliário — agente de pré-vendas com tool-calling.
 * --------------------------------------------------------
 * Fluxo: o lead conversa -> Claude qualifica (finalidade, orçamento, etc.)
 * -> chama a tool buscar_imoveis -> recomenda imóveis com justificativa.
 *
 * O histórico da conversa fica em `messages`, dando memória multi-turno ao
 * agente. O ranking dos imóveis é determinístico (ver match.ts); o modelo
 * só extrai filtros da conversa e escreve a justificativa de cada match.
 */

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Sonnet 4.6: rápido e barato, resolve a maioria. Suba para "claude-opus-4-8"
// se o desafio exigir raciocínio pesado / multi-passo longo.
const MODEL = process.env.MODEL ?? "claude-sonnet-4-6";
const MAX_STEPS = 8; // trava de segurança: nunca rode loop sem limite numa demo

// ---------------------------------------------------------------------------
// 1. TOOLS — cada uma é schema (o que o Claude vê) + handler (o que roda)
// ---------------------------------------------------------------------------
type ToolHandler = (input: any) => Promise<unknown> | unknown;
interface Tool {
  schema: Anthropic.Tool;
  handler: ToolHandler;
}

/**
 * buscar_imoveis — única tool do SDR. O agente a chama DEPOIS de qualificar
 * o lead (no mínimo finalidade + orçamento). O ranking é determinístico
 * (ver match.ts); aqui só repassamos os filtros extraídos da conversa e
 * devolvemos os imóveis com os campos que casaram (matchedFields) pra que o
 * agente escreva a justificativa de cada recomendação.
 */
const buscarImoveisTool: Tool = {
  schema: {
    name: "buscar_imoveis",
    description:
      "Busca imóveis compatíveis na base. Use SOMENTE depois de ter " +
      "qualificado o lead com, no mínimo, a finalidade (compra ou aluguel) " +
      "e o orçamento. Quanto mais filtros (quartos, bairro, tipo), melhor o " +
      "ranking. Retorna os imóveis ordenados por compatibilidade, cada um " +
      "com 'matchedFields' explicando o que casou — use esses campos para " +
      "justificar cada recomendação ao lead.",
    input_schema: {
      type: "object",
      properties: {
        finalidade: {
          type: "string",
          enum: ["compra", "aluguel"],
          description: "Se o lead quer comprar ou alugar.",
        },
        orcamento: {
          type: "number",
          description: "Teto de preço em reais (valor de compra ou aluguel mensal).",
        },
        quartos: {
          type: "number",
          description: "Número de quartos desejado.",
        },
        bairro: {
          type: "string",
          description: "Bairro ou região de preferência.",
        },
        tipo: {
          type: "string",
          enum: ["apartamento", "casa"],
          description: "Tipo de imóvel, se o lead tiver preferência.",
        },
      },
      required: ["finalidade"],
    },
  },
  handler: async (input) => {
    const resultados = buscarImoveis(input as Filtros);
    if (resultados.length === 0) {
      return { encontrados: 0, imoveis: [], aviso: "Nenhum imóvel bateu com os filtros. Sugira relaxar algum critério (orçamento, bairro ou quartos)." };
    }
    return {
      encontrados: resultados.length,
      imoveis: resultados.map((r) => ({
        id: r.imovel.id,
        tipo: r.imovel.tipo,
        bairro: r.imovel.bairro,
        cidade: r.imovel.cidade,
        preco: r.imovel.preco,
        quartos: r.imovel.quartos,
        area: r.imovel.area,
        vagas: r.imovel.vagas,
        lat: r.imovel.lat,
        lng: r.imovel.lng,
        destaque: r.imovel.destaque,
        compatibilidade: Number(r.score.toFixed(2)),
        matchedFields: r.matchedFields,
      })),
    };
  },
};

/**
 * registrar_lead — fecha o ciclo do SDR. Quando o lead demonstra interesse
 * num imóvel, o agente grava o lead qualificado em leads.json, simulando o
 * handoff para um corretor humano (o CRM). É a entrega de valor do SDR: não
 * só conversar, mas deixar o lead pronto para o time comercial agir.
 */
const registrarLeadTool: Tool = {
  schema: {
    name: "registrar_lead",
    description:
      "Registra o lead qualificado no CRM para o corretor dar seguimento. " +
      "Use quando o lead demonstrar interesse em algum imóvel recomendado ou " +
      "pedir para ser contatado/agendar visita. Capture o que já souber da " +
      "conversa — não invente dados que o lead não deu.",
    input_schema: {
      type: "object",
      properties: {
        nome: { type: "string", description: "Nome do lead, se informado." },
        contato: {
          type: "string",
          description: "Telefone, e-mail ou outro contato, se informado.",
        },
        finalidade: { type: "string", enum: ["compra", "aluguel"] },
        orcamento: { type: "number", description: "Teto de preço em reais." },
        quartos: { type: "number" },
        bairro: { type: "string", description: "Região de interesse." },
        tipo: { type: "string", enum: ["apartamento", "casa"] },
        imoveis_interesse: {
          type: "array",
          items: { type: "string" },
          description: "IDs dos imóveis recomendados que o lead curtiu.",
        },
        observacoes: {
          type: "string",
          description: "Resumo livre do que importa para o corretor.",
        },
      },
      required: ["finalidade"],
    },
  },
  handler: async (input) => {
    const lead = {
      registrado_em: new Date().toISOString(),
      ...(input as Record<string, unknown>),
    };
    const arq = path.join(__dirname, "..", "leads.json");
    let leads: unknown[] = [];
    try {
      leads = JSON.parse(fs.readFileSync(arq, "utf-8"));
    } catch {
      leads = []; // arquivo ainda não existe — começa a lista
    }
    leads.push(lead);
    fs.writeFileSync(arq, JSON.stringify(leads, null, 2));
    return {
      ok: true,
      mensagem: "Lead registrado no CRM. Um corretor dará seguimento.",
      total_leads: leads.length,
    };
  },
};

const TOOLS: Tool[] = [buscarImoveisTool, registrarLeadTool];

const handlerByName = new Map(TOOLS.map((t) => [t.schema.name, t.handler]));
const toolSchemas = TOOLS.map((t) => t.schema);

// ---------------------------------------------------------------------------
// 2. PERSONA / REGRAS — o que o SDR pode e não pode fazer
// ---------------------------------------------------------------------------
const SYSTEM = `Você é um SDR (pré-vendas) de uma imobiliária — simpático,
objetivo e consultivo. Seu trabalho é qualificar o lead numa conversa curta e
recomendar imóveis da base que façam sentido pra ele.

COMO CONDUZIR:
- Faça UMA pergunta por vez, em tom natural. Não despeje um formulário.
- Antes de buscar, descubra no MÍNIMO: finalidade (compra ou aluguel) e
  orçamento. Procure saber também quartos, bairro/região e tipo (apto/casa),
  mas não trave a conversa se o lead não souber — esses são opcionais.
- Faça no máximo 2-3 perguntas. Assim que tiver finalidade + orçamento (e o
  que o lead quis dar de bairro/quartos), chame a tool buscar_imoveis.

AO RECOMENDAR:
- Apresente 2 a 4 imóveis, do mais compatível pro menos.
- Para CADA imóvel, escreva uma justificativa curta usando os matchedFields e
  o destaque que a tool retornou (ex.: "3 quartos como você pediu, R$50 mil
  abaixo do teto, em Moema"). Conecte ao que o lead disse.
- Seja honesto sobre matches parciais ("esse tem 2 quartos em vez de 3, mas...").

FECHAMENTO (a parte que entrega valor pro corretor):
- Quando o lead curtir algum imóvel, pedir para agendar visita ou deixar
  contato, chame a tool registrar_lead com tudo que você apurou na conversa.
- Antes de registrar, se ainda não tiver, pergunte nome e um contato (telefone
  ou e-mail) de forma natural — sem soar como formulário.
- Depois de registrar, confirme pro lead que um corretor vai dar seguimento.

REGRAS:
- NUNCA invente imóveis, preços ou bairros. Use somente o que a tool devolveu.
- Se a tool não achar nada, sugira relaxar um critério em vez de inventar.
- Responda sempre em português brasileiro, de forma calorosa e concisa.`;

// ---------------------------------------------------------------------------
// 3. O LOOP — cada iteração chama a API, executa as tools pedidas e repete
//    até o modelo responder em texto (ou atingir MAX_STEPS).
// ---------------------------------------------------------------------------
// `messages` é o histórico da conversa. Numa chamada única ele começa vazio;
// no chat interativo o mesmo array é reaproveitado a cada turno, dando memória
// ao agente (ele lembra o que o lead já respondeu).
export async function runAgent(
  userMessage: string,
  messages: Anthropic.MessageParam[] = []
): Promise<string> {
  messages.push({ role: "user", content: userMessage });

  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM,
      tools: toolSchemas,
      messages,
    });

    messages.push({ role: "assistant", content: res.content });

    // Sem pedido de tool => terminou: extrai e devolve o texto final
    if (res.stop_reason !== "tool_use") {
      return res.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");
    }

    // Executa TODAS as tools pedidas neste turno
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of res.content) {
      if (block.type !== "tool_use") continue;
      const handler = handlerByName.get(block.name);
      let result: unknown;
      try {
        result = handler
          ? await handler(block.input)
          : { error: `tool desconhecida: ${block.name}` };
      } catch (err) {
        result = { error: String(err) }; // erro de tool nunca derruba o loop
      }
      console.log(`\n  🔧 ${block.name}(${JSON.stringify(block.input)})\n`);
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(result),
      });
    }

    messages.push({ role: "user", content: toolResults });
  }

  return "Limite de passos atingido sem resposta final.";
}

// ---------------------------------------------------------------------------
// 4. CHAT INTERATIVO — o lead conversa em vários turnos com o SDR
// ---------------------------------------------------------------------------
async function chatInterativo() {
  const { createInterface } = await import("node:readline/promises");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const historico: Anthropic.MessageParam[] = [];

  console.log("🏠 SDR Imobiliário — me conte o que você procura.");
  console.log("   (digite 'sair' para encerrar)\n");

  try {
    while (true) {
      let entrada: string;
      try {
        entrada = (await rl.question("você: ")).trim();
      } catch {
        break; // stdin encerrado (Ctrl+D ou fim do pipe)
      }
      if (!entrada) continue;
      if (["sair", "exit", "quit"].includes(entrada.toLowerCase())) break;
      const resposta = await runAgent(entrada, historico);
      console.log(`\nSDR: ${resposta}\n`);
    }
  } finally {
    rl.close();
  }
}

// Sem argumento => chat interativo (modo da demo).
// Com argumento => responde uma única mensagem (útil pra teste rápido):
//   npm run agent -- "quero alugar um 2 quartos em Pinheiros até 4 mil"
if (require.main === module) {
  const msg = process.argv[2];
  if (msg) {
    runAgent(msg)
      .then((r) => console.log("\nSDR: " + r))
      .catch((e) => {
        console.error("Erro:", e instanceof Error ? e.message : e);
        process.exit(1);
      });
  } else {
    chatInterativo().catch((e) => {
      console.error("Erro:", e instanceof Error ? e.message : e);
      process.exit(1);
    });
  }
}
