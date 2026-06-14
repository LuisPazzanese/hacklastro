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

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function buscarImoveis(
  filtros: Filtros,
  imoveis: Imovel[],
  topN = 5,
): Resultado[] {
  const local = filtros.bairro ? norm(filtros.bairro) : null;

  // ── Hard filters ────────────────────────────────────────────────
  // Localização e tipo são eliminatórios. Preço nunca elimina.
  let candidatos = imoveis.filter((im) => {
    if (norm(im.finalidade) !== norm(filtros.finalidade)) return false;
    if (filtros.tipo && norm(im.tipo) !== norm(filtros.tipo)) return false;
    if (local) {
      const campos = norm(`${im.bairro} ${im.cidade}`);
      if (!campos.includes(local)) return false;
    }
    return true;
  });

  // Se tipo + geo zerou, relaxa só o tipo (mantém geo).
  if (candidatos.length === 0 && filtros.tipo && local) {
    candidatos = imoveis.filter((im) => {
      if (norm(im.finalidade) !== norm(filtros.finalidade)) return false;
      const campos = norm(`${im.bairro} ${im.cidade}`);
      return campos.includes(local!);
    });
  }

  // ── Soft scoring: quartos + preço ───────────────────────────────
  const resultados = candidatos.map((im) => {
    let score = 0;
    const matched: string[] = [];

    // Quartos: exato = 1.0, ±1 = 0.5, mais longe = 0.1
    if (filtros.quartos != null) {
      const diff = Math.abs(im.quartos - filtros.quartos);
      score += diff === 0 ? 1.0 : diff === 1 ? 0.5 : 0.1;
      if (diff <= 1) matched.push(`${im.quartos} quartos`);
    } else {
      score += 0.5; // neutro quando não especificado
    }

    // Preço: flexível — mostra até ~40% acima do teto com penalidade suave.
    if (filtros.orcamento != null) {
      if (im.preco <= filtros.orcamento) {
        score += 1.0;
        matched.push(`dentro do orçamento (R$ ${im.preco.toLocaleString("pt-BR")})`);
      } else {
        const excesso = (im.preco - filtros.orcamento) / filtros.orcamento;
        score += Math.max(0, 1 - excesso * 1.5); // 40% acima → score 0.4 (ainda aparece)
        if (excesso <= 0.4) matched.push(`próximo ao orçamento (R$ ${im.preco.toLocaleString("pt-BR")})`);
      }
    } else {
      score += 0.5;
    }

    if (local) {
      if (norm(im.bairro).includes(local)) matched.push(`no bairro ${im.bairro}`);
      else matched.push(`em ${im.cidade}`);
    }
    if (filtros.tipo) matched.push(`é ${im.tipo}`);

    return { imovel: im, score, matchedFields: matched };
  });

  resultados.sort((a, b) => b.score - a.score);
  return resultados.slice(0, topN);
}

