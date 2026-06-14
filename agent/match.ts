import * as fs from "node:fs";
import * as path from "node:path";

/**
 * MATCH DE IMÓVEIS — núcleo determinístico do SDR (SEM LLM).
 * --------------------------------------------------------
 * O LLM (no agent.ts) só extrai os filtros da conversa e escreve a
 * justificativa. QUEM RANKEIA é esta função — assim a demo é previsível
 * e reproduzível. Regra de ouro do dia: julgamento ambíguo -> LLM;
 * filtrar/somar/ordenar -> código.
 *
 * buscarImoveis(filtros) -> top-N imóveis com score e os campos que casaram
 * (matchedFields), que o agente usa pra justificar cada recomendação.
 */

export interface Imovel {
  id: string;
  tipo: string; // "apartamento" | "casa"
  finalidade: string; // "compra" | "aluguel"
  cidade: string;
  bairro: string;
  preco: number;
  quartos: number;
  area: number;
  vagas: number;
  lat: number; // coordenadas para o mapa
  lng: number;
  destaque: string;
}

export interface Filtros {
  finalidade: string; // obrigatório: compra ou aluguel
  orcamento?: number; // teto de preço
  quartos?: number; // nº de quartos desejado
  bairro?: string; // bairro/região preferido
  tipo?: string; // apartamento | casa
}

export interface Resultado {
  imovel: Imovel;
  score: number; // 0..1, quanto maior melhor
  matchedFields: string[]; // o que casou, p/ justificativa
}

// Tolerância: imóvel até 15% acima do teto ainda aparece (com penalidade).
const TOLERANCIA_PRECO = 0.15;

let cache: Imovel[] | null = null;
function carregarImoveis(): Imovel[] {
  if (cache) return cache;
  const arq = path.join(__dirname, "imoveis.json");
  try {
    cache = JSON.parse(fs.readFileSync(arq, "utf-8")) as Imovel[];
  } catch {
    throw new Error(`Não foi possível carregar a base de imóveis em: ${arq}`);
  }
  return cache;
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function buscarImoveis(
  filtros: Filtros,
  imoveis: Imovel[] = carregarImoveis(),
  topN = 4,
): Resultado[] {

  // --- Hard constraints: finalidade sempre; preço com tolerância ---
  const candidatos = imoveis.filter((im) => {
    if (norm(im.finalidade) !== norm(filtros.finalidade)) return false;
    if (
      filtros.orcamento != null &&
      im.preco > filtros.orcamento * (1 + TOLERANCIA_PRECO)
    )
      return false;
    return true;
  });

  // --- Score por proximidade (cada critério ativo entra normalizado) ---
  const resultados = candidatos.map((im) => {
    const pesos: number[] = [];
    const notas: number[] = [];
    const matched: string[] = [];

    // Preço: dentro do teto = ótimo; acima (até tolerância) penaliza.
    if (filtros.orcamento != null) {
      pesos.push(0.3);
      if (im.preco <= filtros.orcamento) {
        notas.push(1);
        matched.push(`dentro do orçamento (R$ ${im.preco.toLocaleString("pt-BR")})`);
      } else {
        const excesso = (im.preco - filtros.orcamento) / filtros.orcamento;
        notas.push(Math.max(0, 1 - excesso / TOLERANCIA_PRECO));
        matched.push(`um pouco acima do teto (R$ ${im.preco.toLocaleString("pt-BR")})`);
      }
    }

    // Quartos: exato = 1, ±1 = 0.5, resto cai rápido.
    if (filtros.quartos != null) {
      pesos.push(0.35);
      const diff = Math.abs(im.quartos - filtros.quartos);
      const nota = diff === 0 ? 1 : diff === 1 ? 0.5 : 0.1;
      notas.push(nota);
      if (diff === 0) matched.push(`${im.quartos} quartos como você pediu`);
      else matched.push(`${im.quartos} quartos (você queria ${filtros.quartos})`);
    }

    // Bairro: exato = 1; mesma cidade = 0.3.
    if (filtros.bairro) {
      pesos.push(0.25);
      if (norm(im.bairro) === norm(filtros.bairro)) {
        notas.push(1);
        matched.push(`no bairro ${im.bairro}`);
      } else if (norm(im.cidade) === norm(filtros.bairro)) {
        notas.push(0.3);
        matched.push(`em ${im.cidade}`);
      } else {
        notas.push(0.2);
        matched.push(`no bairro ${im.bairro} (você pediu ${filtros.bairro})`);
      }
    }

    // Tipo: só conta se o lead especificou.
    if (filtros.tipo) {
      pesos.push(0.1);
      if (norm(im.tipo) === norm(filtros.tipo)) {
        notas.push(1);
        matched.push(`é ${im.tipo}`);
      } else {
        notas.push(0);
      }
    }

    const somaPesos = pesos.reduce((a, b) => a + b, 0) || 1;
    const score =
      pesos.reduce((acc, p, i) => acc + p * notas[i], 0) / somaPesos;

    return { imovel: im, score, matchedFields: matched };
  });

  resultados.sort((a, b) => b.score - a.score);
  return resultados.slice(0, topN);
}

// --- Modo de teste: npx tsx agent/match.ts — roda cenários de exemplo. ----
if (require.main === module) {
  const cenarios: { nome: string; filtros: Filtros }[] = [
    { nome: "Família comprando 3q em Moema até 1M", filtros: { finalidade: "compra", orcamento: 1000000, quartos: 3, bairro: "Moema" } },
    { nome: "Investidor compra 1-2q em Pinheiros até 700k", filtros: { finalidade: "compra", orcamento: 700000, quartos: 1, bairro: "Pinheiros" } },
    { nome: "Aluguel urgente 2q aceita pet, até 4k", filtros: { finalidade: "aluguel", orcamento: 4000, quartos: 2 } },
    { nome: "Casa pra comprar com 4 quartos", filtros: { finalidade: "compra", quartos: 4, tipo: "casa" } },
  ];

  for (const c of cenarios) {
    console.log(`\n=== ${c.nome} ===`);
    console.log("filtros:", c.filtros);
    const res = buscarImoveis(c.filtros);
    for (const r of res) {
      console.log(
        `  [${r.score.toFixed(2)}] ${r.imovel.id} ${r.imovel.bairro} ` +
          `R$${r.imovel.preco.toLocaleString("pt-BR")} ${r.imovel.quartos}q ` +
          `(${r.imovel.tipo}) — ${r.matchedFields.join("; ")}`
      );
    }
  }
}
