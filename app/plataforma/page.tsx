"use client";

import { useState, useEffect, useCallback } from "react";
import LastroIcon from "../LastroIcon";

type Tier = "Premium" | "Pro" | "Basic";

interface Corretor {
  id: string;
  nome: string;
  tier: Tier;
  regiao: string;
  iniciais: string;
}

interface Lead {
  id: string;
  nome?: string;
  contato?: string;
  finalidade?: string;
  orcamento?: number;
  quartos?: number;
  bairro?: string;
  tipo?: string;
  imoveis_interesse?: string[];
  observacoes?: string;
  score_qualificacao?: number;
  status: "disponivel" | "aceito";
  aceito_por?: string | null;
  aceito_por_nome?: string | null;
  aceito_em?: string | null;
  registrado_em?: string;
}

const CORRETORES: Corretor[] = [
  { id: "c1", nome: "Ana Costa",    tier: "Premium", regiao: "São Paulo",      iniciais: "AC" },
  { id: "c2", nome: "Bruno Lima",   tier: "Pro",     regiao: "Rio de Janeiro", iniciais: "BL" },
  { id: "c3", nome: "Carla Mendes", tier: "Basic",   regiao: "São Paulo",      iniciais: "CM" },
  { id: "c4", nome: "Diego Ramos",  tier: "Basic",   regiao: "Belo Horizonte", iniciais: "DR" },
];

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function leadsVisiveis(leads: Lead[], corretor: Corretor): Lead[] {
  return leads.filter((lead) => {
    if (corretor.tier === "Premium") return true;
    if (corretor.tier === "Pro") {
      return (lead.orcamento ?? 0) >= 500000;
    }
    // Basic: bairro do lead inclui parte do nome da região do corretor
    if (!lead.bairro) return false;
    const bairroNorm = normalize(lead.bairro);
    const regiaoNorm = normalize(corretor.regiao);
    // Testa se qualquer palavra da regiao aparece no bairro
    return regiaoNorm.split(" ").some((word) => word.length > 2 && bairroNorm.includes(word));
  });
}

function mascaraNome(nome?: string): string {
  if (!nome) return "***";
  const primeiros = nome.slice(0, 2);
  return primeiros + "***";
}

function formatOrcamento(v?: number): string {
  if (!v) return "—";
  return "R$ " + v.toLocaleString("pt-BR");
}

export default function PlataformaPage() {
  const [corretorAtivo, setCorretorAtivo] = useState<Corretor>(CORRETORES[0]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [aceitando, setAceitando] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    try {
      const res = await fetch("/api/leads");
      if (res.ok) {
        const data = await res.json();
        setLeads(data);
      }
    } catch {
      // silencioso — polling vai tentar novamente
    }
  }, []);

  // Polling a cada 3s
  useEffect(() => {
    fetchLeads();
    const interval = setInterval(fetchLeads, 3000);
    return () => clearInterval(interval);
  }, [fetchLeads]);

  async function aceitarLead(leadId: string) {
    setAceitando(leadId);
    try {
      const res = await fetch("/api/leads", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          leadId,
          corretorId: corretorAtivo.id,
          corretorNome: corretorAtivo.nome,
        }),
      });
      if (res.ok) {
        await fetchLeads();
      }
    } finally {
      setAceitando(null);
    }
  }

  const leadsParaExibir = leadsVisiveis(leads, corretorAtivo);

  return (
    <div className="plataforma-page">
      <header className="plataforma-header">
        <div className="plataforma-brand">
          <LastroIcon size={22} color="#6d44c0" />
          <span className="plataforma-title">Lastro Plataforma</span>
        </div>

        <div className="plataforma-controls">
          <div className="corretor-selector">
            <span className="selector-label">Entrar como</span>
            <select
              value={corretorAtivo.id}
              onChange={(e) => {
                const c = CORRETORES.find((c) => c.id === e.target.value);
                if (c) setCorretorAtivo(c);
              }}
            >
              {CORRETORES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} ({c.tier})
                </option>
              ))}
            </select>
          </div>

          <div className="corretor-badge">
            <div className="corretor-iniciais">{corretorAtivo.iniciais}</div>
            <div className="corretor-info">
              <span className="corretor-nome">{corretorAtivo.nome}</span>
              <span className={`tier-badge ${corretorAtivo.tier.toLowerCase()}`}>
                {corretorAtivo.tier}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="plataforma-main">
        <div className="leads-header">
          <h2 className="leads-title">Leads disponíveis</h2>
          <span className="leads-count">{leadsParaExibir.length} leads</span>
        </div>

        {leadsParaExibir.length === 0 ? (
          <div className="empty-state">
            <LastroIcon size={32} color="rgba(109,68,192,0.25)" />
            <p>Aguardando novos leads...</p>
          </div>
        ) : (
          <div className="leads-grid">
            {leadsParaExibir.map((lead) => {
              const isAceito = lead.status === "aceito";
              const isMeu = isAceito && lead.aceito_por === corretorAtivo.id;
              const isDeOutro = isAceito && lead.aceito_por !== corretorAtivo.id;

              return (
                <div
                  key={lead.id}
                  className={`lead-card${isDeOutro ? " aceito-outro" : ""}${isMeu ? " meu-lead" : ""}`}
                >
                  <div className="lead-fields">
                    {(isMeu || isDeOutro) && (
                      <div className="lead-field">
                        <span className="field-label">Status</span>
                        <span className={`field-value ${isMeu ? "status-meu" : "status-outro"}`}>
                          {isMeu ? "Seu lead" : `Aceito por ${lead.aceito_por_nome ?? "outro corretor"}`}
                        </span>
                      </div>
                    )}
                    {lead.finalidade && (
                      <div className="lead-field">
                        <span className="field-label">Finalidade</span>
                        <span className="field-value">{lead.finalidade}</span>
                      </div>
                    )}
                    {lead.orcamento && (
                      <div className="lead-field">
                        <span className="field-label">Orçamento</span>
                        <span className="field-value orçamento">{formatOrcamento(lead.orcamento)}</span>
                      </div>
                    )}
                    {lead.bairro && (
                      <div className="lead-field">
                        <span className="field-label">Região</span>
                        <span className="field-value">{lead.bairro}</span>
                      </div>
                    )}
                    {lead.quartos && (
                      <div className="lead-field">
                        <span className="field-label">Quartos</span>
                        <span className="field-value">{lead.quartos}</span>
                      </div>
                    )}
                    {lead.tipo && (
                      <div className="lead-field">
                        <span className="field-label">Tipo</span>
                        <span className="field-value">{lead.tipo}</span>
                      </div>
                    )}

                    {/* Lead: nome mascarado para outros; contato revelado só para dono */}
                    <div className="lead-field">
                      <span className="field-label">Lead</span>
                      <span className="field-value">
                        {isMeu ? (lead.nome ?? "—") : mascaraNome(lead.nome)}
                      </span>
                    </div>
                    {isMeu && (
                    <div className="lead-field">
                      <span className="field-label">Contato</span>
                      <span className="field-value">{lead.contato ?? "—"}</span>
                    </div>
                    )}

                  </div>

                  {/* Score bar — sempre visível */}
                  {lead.score_qualificacao !== undefined && (
                    <div className="lead-score">
                      <div className="lead-score-label">
                        Score <strong>{lead.score_qualificacao}</strong>/100
                      </div>
                      <div className="lead-score-track">
                        <div
                          className="lead-score-bar"
                          style={{ width: `${lead.score_qualificacao}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {!isAceito && (
                    <button
                      className="aceitar-btn"
                      disabled={aceitando === lead.id}
                      onClick={() => aceitarLead(lead.id)}
                    >
                      {aceitando === lead.id ? "Aceitando..." : "Aceitar lead →"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
