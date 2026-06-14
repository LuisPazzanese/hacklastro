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

const COLUNAS: { status: Lead["status"]; label: string; cor: string }[] = [
  { status: "novo",          label: "Novo",           cor: "#dc2626" },
  { status: "em_atendimento", label: "Em atendimento", cor: "#2563eb" },
  { status: "fechado",       label: "Fechado",         cor: "#6b6560" },
];

function formatOrcamento(v?: number): string {
  if (!v) return "—";
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}M`;
  if (v >= 1_000) return `R$ ${Math.round(v / 1000)}k`;
  return "R$ " + v.toLocaleString("pt-BR");
}

function tempoRelativo(iso?: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

function LeadCard({
  lead,
  atualizando,
  onMudar,
}: {
  lead: Lead;
  atualizando: string | null;
  onMudar: (id: string, status: Lead["status"]) => void;
}) {
  const loading = atualizando === lead.id;

  return (
    <div className={`lead-card kcard status-${lead.status === "em_atendimento" ? "andamento" : lead.status}`}>
      {/* topo: nome + tempo */}
      <div className="kcard-top">
        <div className="kcard-avatar">
          {lead.nome ? lead.nome.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() : "?"}
        </div>
        <div className="kcard-identity">
          <span className="kcard-nome">{lead.nome ?? "Lead anônimo"}</span>
          <span className="kcard-tempo">{tempoRelativo(lead.registrado_em)}</span>
        </div>
        {lead.score_qualificacao !== undefined && (
          <div className="kcard-score-chip">{lead.score_qualificacao}</div>
        )}
      </div>

      {/* campos */}
      <div className="kcard-fields">
        {lead.contato && (
          <div className="kcard-field">
            <span className="kfield-label">Contato</span>
            <span className="kfield-val contact-value">{lead.contato}</span>
          </div>
        )}
        {lead.finalidade && (
          <div className="kcard-field">
            <span className="kfield-label">Finalidade</span>
            <span className="kfield-val" style={{ textTransform: "capitalize" }}>{lead.finalidade}</span>
          </div>
        )}
        {lead.orcamento && (
          <div className="kcard-field">
            <span className="kfield-label">Orçamento</span>
            <span className="kfield-val orcamento-value">{formatOrcamento(lead.orcamento)}</span>
          </div>
        )}
        {lead.bairro && (
          <div className="kcard-field">
            <span className="kfield-label">Região</span>
            <span className="kfield-val">{lead.bairro}</span>
          </div>
        )}
        {lead.quartos && (
          <div className="kcard-field">
            <span className="kfield-label">Quartos</span>
            <span className="kfield-val">{lead.quartos}</span>
          </div>
        )}
        {lead.imoveis_interesse?.length ? (
          <div className="kcard-field">
            <span className="kfield-label">Imóvel</span>
            <span className="kfield-val imovel-tag">{lead.imoveis_interesse[0]}</span>
          </div>
        ) : null}
      </div>

      {/* score bar */}
      {lead.score_qualificacao !== undefined && (
        <div className="lead-score-track" style={{ marginTop: 2 }}>
          <div className="lead-score-bar" style={{ width: `${lead.score_qualificacao}%` }} />
        </div>
      )}

      {/* ação */}
      <div className="lead-actions">
        {lead.status === "novo" && (
          <button className="aceitar-btn" disabled={loading}
            onClick={() => onMudar(lead.id, "em_atendimento")}>
            {loading ? "..." : "Iniciar atendimento →"}
          </button>
        )}
        {lead.status === "em_atendimento" && (
          <button className="fechar-btn" disabled={loading}
            onClick={() => onMudar(lead.id, "fechado")}>
            {loading ? "..." : "Marcar como fechado ✓"}
          </button>
        )}
        {lead.status === "fechado" && (
          <span className="fechado-label">Lead encerrado</span>
        )}
      </div>
    </div>
  );
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
          {novos > 0 && (
            <span className="novos-badge">{novos} novo{novos > 1 ? "s" : ""}</span>
          )}
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
        {leads.length === 0 ? (
          <div className="empty-state">
            <LastroIcon size={32} color="rgba(109,68,192,0.25)" />
            <p>Nenhum lead atribuído ainda.</p>
            <p style={{ fontSize: 13, color: "#9b8b7a", marginTop: 4 }}>
              Leads chegam automaticamente via SDR.
            </p>
          </div>
        ) : (
          <div className="kanban-board">
            {COLUNAS.map((col) => {
              const colLeads = leads.filter((l) => l.status === col.status);
              return (
                <div key={col.status} className="kanban-col">
                  <div className="kanban-col-header" style={{ borderTopColor: col.cor }}>
                    <span className="kanban-col-title" style={{ color: col.cor }}>{col.label}</span>
                    <span className="kanban-col-count">{colLeads.length}</span>
                  </div>
                  <div className="kanban-col-body">
                    {colLeads.length === 0 ? (
                      <div className="kanban-empty">vazio</div>
                    ) : (
                      colLeads.map((lead) => (
                        <LeadCard
                          key={lead.id}
                          lead={lead}
                          atualizando={atualizando}
                          onMudar={mudarStatus}
                        />
                      ))
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
