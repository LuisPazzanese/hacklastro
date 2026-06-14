"use client";

import { useState, useEffect, useCallback } from "react";
import LastroIcon from "../LastroIcon";

interface Funcionario {
  id: string;
  nome: string;
  iniciais: string;
  cargo: string;
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
  status: "novo" | "em_atendimento" | "fechado";
  atribuido_para?: string;
  atribuido_para_nome?: string;
  registrado_em?: string;
}

const FUNCIONARIOS: Funcionario[] = [
  { id: "c1", nome: "Ana Costa",    iniciais: "AC", cargo: "Corretora Sênior" },
  { id: "c2", nome: "Bruno Lima",   iniciais: "BL", cargo: "Corretor Pleno" },
  { id: "c3", nome: "Carla Mendes", iniciais: "CM", cargo: "Corretora Pleno" },
  { id: "c4", nome: "Diego Ramos",  iniciais: "DR", cargo: "Corretor Júnior" },
];

function formatOrcamento(v?: number): string {
  if (!v) return "—";
  return "R$ " + v.toLocaleString("pt-BR");
}

function statusLabel(s: Lead["status"]) {
  if (s === "novo") return { label: "Novo", cls: "status-novo" };
  if (s === "em_atendimento") return { label: "Em atendimento", cls: "status-andamento" };
  return { label: "Fechado", cls: "status-fechado" };
}

export default function PlataformaPage() {
  const [funcionario, setFuncionario] = useState<Funcionario>(FUNCIONARIOS[0]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [atualizando, setAtualizando] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    try {
      const res = await fetch(`/api/leads?funcionario=${funcionario.id}`);
      if (res.ok) setLeads(await res.json());
    } catch {}
  }, [funcionario.id]);

  useEffect(() => {
    fetchLeads();
    const t = setInterval(fetchLeads, 3000);
    return () => clearInterval(t);
  }, [fetchLeads]);

  async function mudarStatus(leadId: string, status: Lead["status"]) {
    setAtualizando(leadId);
    try {
      await fetch("/api/leads", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leadId, status }),
      });
      await fetchLeads();
    } finally {
      setAtualizando(null);
    }
  }

  const novos = leads.filter((l) => l.status === "novo").length;

  return (
    <div className="plataforma-page">
      <header className="plataforma-header">
        <div className="plataforma-brand">
          <LastroIcon size={22} color="#6d44c0" />
          <span className="plataforma-title">Lastro — Painel Interno</span>
        </div>

        <div className="plataforma-controls">
          <div className="corretor-selector">
            <span className="selector-label">Acessar como</span>
            <select
              value={funcionario.id}
              onChange={(e) => {
                const f = FUNCIONARIOS.find((f) => f.id === e.target.value);
                if (f) setFuncionario(f);
              }}
            >
              {FUNCIONARIOS.map((f) => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>
          </div>

          <div className="corretor-badge">
            <div className="corretor-iniciais">{funcionario.iniciais}</div>
            <div className="corretor-info">
              <span className="corretor-nome">{funcionario.nome}</span>
              <span className="corretor-cargo">{funcionario.cargo}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="plataforma-main">
        <div className="leads-header">
          <h2 className="leads-title">Meus leads</h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {novos > 0 && (
              <span className="novos-badge">{novos} novo{novos > 1 ? "s" : ""}</span>
            )}
            <span className="leads-count">{leads.length} total</span>
          </div>
        </div>

        {leads.length === 0 ? (
          <div className="empty-state">
            <LastroIcon size={32} color="rgba(109,68,192,0.25)" />
            <p>Nenhum lead atribuído ainda.</p>
            <p style={{ fontSize: 13, color: "#9b8b7a", marginTop: 4 }}>
              Leads chegam automaticamente via SDR.
            </p>
          </div>
        ) : (
          <div className="leads-grid">
            {leads.map((lead) => {
              const { label, cls } = statusLabel(lead.status);
              return (
                <div key={lead.id} className={`lead-card ${cls}`}>
                  <div className="lead-fields">
                    <div className="lead-field">
                      <span className="field-label">Status</span>
                      <span className={`field-value status-pill ${cls}`}>{label}</span>
                    </div>
                    {lead.nome && (
                      <div className="lead-field">
                        <span className="field-label">Nome</span>
                        <span className="field-value">{lead.nome}</span>
                      </div>
                    )}
                    {lead.contato && (
                      <div className="lead-field">
                        <span className="field-label">Contato</span>
                        <span className="field-value contact-value">{lead.contato}</span>
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
                        <span className="field-value orcamento-value">{formatOrcamento(lead.orcamento)}</span>
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
                  </div>

                  {lead.score_qualificacao !== undefined && (
                    <div className="lead-score">
                      <div className="lead-score-label">
                        Score <strong>{lead.score_qualificacao}</strong>/100
                      </div>
                      <div className="lead-score-track">
                        <div className="lead-score-bar" style={{ width: `${lead.score_qualificacao}%` }} />
                      </div>
                    </div>
                  )}

                  <div className="lead-actions">
                    {lead.status === "novo" && (
                      <button
                        className="aceitar-btn"
                        disabled={atualizando === lead.id}
                        onClick={() => mudarStatus(lead.id, "em_atendimento")}
                      >
                        {atualizando === lead.id ? "..." : "Iniciar atendimento →"}
                      </button>
                    )}
                    {lead.status === "em_atendimento" && (
                      <button
                        className="fechar-btn"
                        disabled={atualizando === lead.id}
                        onClick={() => mudarStatus(lead.id, "fechado")}
                      >
                        {atualizando === lead.id ? "..." : "Marcar como fechado ✓"}
                      </button>
                    )}
                    {lead.status === "fechado" && (
                      <span className="fechado-label">Lead encerrado</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
