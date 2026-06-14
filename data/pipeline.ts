import Anthropic from "@anthropic-ai/sdk";
import * as fs from "node:fs";

/**
 * ESQUELETO DE PROCESSAMENTO DE DADOS / CLI (genérico)
 * ----------------------------------------------------
 * Para QUANDO o desafio for "processe/analise estes dados" em vez de
 * "construa um agente conversacional". Cobre o segundo formato mais
 * provável de um desafio de IA: pegar um arquivo, transformar/analisar,
 * cuspir resultado — opcionalmente usando o Claude para a parte que
 * exige julgamento (classificar, extrair, resumir).
 *
 * No dia você mexe em 2 lugares:
 *   1. transformar()  -> sua lógica determinística (parse, filtro, agregação)
 *   2. analisarComLLM() -> só o que precisa de julgamento do modelo
 *
 * Regra de decisão (vale ouro num desafio de dados): use código para o que
 * é determinístico (somar, filtrar, agrupar) e LLM só para o que é
 * ambíguo (esta review é positiva? qual a categoria deste texto livre?).
 * Jogar tudo no LLM é lento, caro e não-reprodutível.
 */

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.MODEL ?? "claude-sonnet-4-6";

// --- 1. Carregar dados (auto-detecta JSON x texto/CSV pela extensão) -------
function carregar(caminho: string): unknown {
  const raw = fs.readFileSync(caminho, "utf-8");
  if (caminho.endsWith(".json")) return JSON.parse(raw);
  // CSV simples: cabeçalho na 1ª linha, vírgula como separador.
  // Para CSV de verdade (vírgulas em campos, aspas), troque por papaparse.
  const linhas = raw.trim().split("\n");
  const cab = linhas[0].split(",").map((c) => c.trim());
  return linhas.slice(1).map((l) => {
    const cels = l.split(",");
    return Object.fromEntries(cab.map((c, i) => [c, cels[i]?.trim() ?? ""]));
  });
}

// --- 2. Transformação determinística (sua lógica vai aqui) -----------------
function transformar(dados: any): any {
  // Exemplo: contar registros. Troque pela sua agregação/filtro real.
  const total = Array.isArray(dados) ? dados.length : 1;
  return { total, amostra: Array.isArray(dados) ? dados.slice(0, 3) : dados };
}

// --- 3. Análise com LLM (só para o que exige julgamento) -------------------
// Peça JSON e parseie. Instrua o modelo a responder SÓ JSON, sem cercas.
async function analisarComLLM(contexto: unknown): Promise<unknown> {
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system:
      "Você analisa dados e responde APENAS com JSON válido, sem texto " +
      "antes ou depois, sem cercas de código.",
    messages: [
      {
        role: "user",
        content:
          "Analise os dados a seguir e retorne um JSON com {resumo, insights:[]}.\n\n" +
          JSON.stringify(contexto),
      },
    ],
  });
  const texto = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  const limpo = texto.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(limpo);
  } catch {
    return { erro: "resposta não-JSON", bruto: texto };
  }
}

// --- Orquestração ----------------------------------------------------------
async function main() {
  const caminho = process.argv[2];
  if (!caminho) {
    console.error("uso: npx tsx data/pipeline.ts <arquivo.csv|json>");
    process.exit(1);
  }
  const dados = carregar(caminho);
  const transformado = transformar(dados);
  console.log("--- transformação determinística ---");
  console.log(transformado);

  // Comente a linha abaixo se o desafio não precisar de julgamento do LLM.
  const analise = await analisarComLLM(transformado);
  console.log("\n--- análise com LLM ---");
  console.log(analise);
}

if (require.main === module) main();
