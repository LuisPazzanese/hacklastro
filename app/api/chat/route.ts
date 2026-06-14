import Anthropic from "@anthropic-ai/sdk";
import * as fs from "node:fs";
import * as path from "node:path";
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

QUALIFICAÇÃO — siga esta ordem, sem exceção:
1. Se o cliente já mencionou cidade/bairro: chame buscar_imoveis IMEDIATAMENTE
   com o bairro informado. Não faça nenhuma pergunta antes.
2. Se não mencionou região: pergunte cidade ou bairro. Essa é a única pergunta
   obrigatória antes de buscar.
3. Finalidade (compra/aluguel) e orçamento são opcionais para a primeira busca
   — se não souber, omita da tool call. O mapa precisa mostrar pins logo.
4. Refine com finalidade/orçamento/quartos na conversa subsequente, re-chamando
   buscar_imoveis conforme o cliente responde.
- REGRA: se a mensagem do cliente contém qualquer cidade ou bairro brasileiro,
  chame buscar_imoveis antes de responder qualquer outra coisa.

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

const FUNCIONARIOS = [
  { id: "c1", nome: "Ana Costa" },
  { id: "c2", nome: "Bruno Lima" },
  { id: "c3", nome: "Carla Mendes" },
  { id: "c4", nome: "Diego Ramos" },
];

const tools: Anthropic.Tool[] = [
  {
    name: "buscar_imoveis",
    description:
      "Busca imóveis compatíveis na base. Use assim que souber a região — " +
      "não espere todos os filtros. Retorna imóveis ordenados por " +
      "compatibilidade, cada um com matchedFields (o que casou) — use para " +
      "justificar as recomendações. Preço é flexível: mostra até ~40% acima do orçamento.",
    input_schema: {
      type: "object",
      properties: {
        finalidade: { type: "string", enum: ["compra", "aluguel"] },
        orcamento: { type: "number", description: "Orçamento ideal — a busca inclui imóveis até ~40% acima deste valor." },
        quartos: { type: "number", description: "Número de quartos desejado." },
        bairro: { type: "string", description: "Cidade, bairro ou região. OBRIGATÓRIO — sempre passe este campo." },
        tipo: { type: "string", enum: ["apartamento", "casa"] },
      },
      required: ["bairro"],
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
        model: MODEL,
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
        const input = block.input as Record<string, unknown>;
        // Round-robin: atribui ao próximo funcionário na fila
        const statePath = path.join(process.cwd(), "agent", "state.json");
        let state = { proximoCorretor: 0 };
        try { state = JSON.parse(fs.readFileSync(statePath, "utf-8")); } catch {}
        const funcionario = FUNCIONARIOS[state.proximoCorretor % FUNCIONARIOS.length];
        state.proximoCorretor = (state.proximoCorretor + 1) % FUNCIONARIOS.length;
        fs.writeFileSync(statePath, JSON.stringify(state), "utf-8");

        // Score de qualificação (0–100)
        let score = 0;
        if (input.nome) score += 20;
        if (input.contato) score += 20;
        if (input.orcamento) score += 20;
        if (input.bairro) score += 20;
        if (Array.isArray(input.imoveis_interesse) && input.imoveis_interesse.length > 0) score += 20;

        const lead: Record<string, unknown> = {
          id: Date.now().toString(36),
          registrado_em: new Date().toISOString(),
          status: "novo",
          atribuido_para: funcionario.id,
          atribuido_para_nome: funcionario.nome,
          score_qualificacao: score,
          ...input,
        };

        // Persistir em agent/leads.json
        const leadsPath = path.join(process.cwd(), "agent", "leads.json");
        let leads: Record<string, unknown>[] = [];
        try {
          leads = JSON.parse(fs.readFileSync(leadsPath, "utf-8"));
        } catch {
          leads = [];
        }
        leads.push(lead);
        fs.writeFileSync(leadsPath, JSON.stringify(leads, null, 2), "utf-8");

        leadRegistrado = lead;
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
