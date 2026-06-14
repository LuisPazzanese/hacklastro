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
  { status: "novo",           label: "Novo",           cor: "#dc2626" },
  { status: "em_atendimento", label: "Em atendimento", cor: "#2563eb" },
  { status: "fechado",        label: "Fechado",         cor: "#6b6560" },
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

function scoreColor(s: number): string {
  return s >= 80 ? "#16a34a" : s >= 60 ? "#d97706" : "#dc2626";
}

function LeadModal({
  lead,
  onClose,
  onSave,
}: {
  lead: Lead;
  onClose: () => void;
  onSave: (leadId: string, obs: string) => Promise<void>;
}) {
  const [obs, setObs] = useState(lead.observacoes ?? "");
  const [salvando, setSalvando] = useState(false);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{lead.nome ?? "Lead"}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-fields">
          {lead.atribuido_para_nome && (
            <div className="modal-field">
              <span className="kfield-label">Corretor</span>
              <span className="kfield-val">{lead.atribuido_para_nome}</span>
            </div>
          )}
          {lead.contato && (
            <div className="modal-field">
              <span className="kfield-label">Contato</span>
              <span className="kfield-val contact-value">{lead.contato}</span>
            </div>
          )}
          {lead.finalidade && (
            <div className="modal-field">
              <span className="kfield-label">Finalidade</span>
              <span className="kfield-val" style={{ textTransform: "capitalize" }}>{lead.finalidade}</span>
            </div>
          )}
          {lead.tipo && (
            <div className="modal-field">
              <span className="kfield-label">Tipo</span>
              <span className="kfield-val" style={{ textTransform: "capitalize" }}>{lead.tipo}</span>
            </div>
          )}
          {lead.orcamento && (
            <div className="modal-field">
              <span className="kfield-label">Orçamento</span>
              <span className="kfield-val orcamento-value">{formatOrcamento(lead.orcamento)}</span>
            </div>
          )}
          {lead.bairro && (
            <div className="modal-field">
              <span className="kfield-label">Região</span>
              <span className="kfield-val">{lead.bairro}</span>
            </div>
          )}
          {lead.quartos && (
            <div className="modal-field">
              <span className="kfield-label">Quartos</span>
              <span className="kfield-val">{lead.quartos}</span>
            </div>
          )}
          {lead.imoveis_interesse?.length ? (
            <div className="modal-field">
              <span className="kfield-label">Imóveis</span>
              <span className="kfield-val imovel-tag">{lead.imoveis_interesse.join(", ")}</span>
            </div>
          ) : null}
          {lead.score_qualificacao !== undefined && (
            <div className="modal-field">
              <span className="kfield-label">Score</span>
              <span className="kfield-val" style={{ color: scoreColor(lead.score_qualificacao), fontWeight: 700 }}>
                {lead.score_qualificacao}
              </span>
            </div>
          )}
        </div>

        <div className="modal-obs-section">
          <div className="modal-obs-label">Observações do corretor</div>
          <textarea
            className="modal-obs-area"
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="Adicione uma nota sobre este lead..."
          />
          <button
            className="modal-save-btn"
            disabled={salvando}
            onClick={async () => {
              setSalvando(true);
              await onSave(lead.id, obs);
              setSalvando(false);
            }}
          >
            {salvando ? "Salvando..." : "Salvar nota"}
          </button>
        </div>
      </div>
    </div>
  );
}

function LeadCard({
  lead,
  atualizando,
  onMudar,
  onAbrirModal,
}: {
  lead: Lead;
  atualizando: string | null;
  onMudar: (id: string, status: Lead["status"]) => void;
  onAbrirModal: (lead: Lead) => void;
}) {
  const loading = atualizando === lead.id;
  const score = lead.score_qualificacao;

  return (
    <div
      className={`lead-card kcard status-${lead.status === "em_atendimento" ? "andamento" : lead.status}`}
      onClick={() => onAbrirModal(lead)}
      style={{ cursor: "pointer" }}
    >
      {/* topo: nome + tempo */}
      <div className="kcard-top">
        <div className="kcard-avatar">
          {lead.nome ? lead.nome.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() : "?"}
        </div>
        <div className="kcard-identity">
          <span className="kcard-nome">{lead.nome ?? "Lead anônimo"}</span>
          <span className="kcard-tempo">{tempoRelativo(lead.registrado_em)}</span>
        </div>
        {score !== undefined && (
          <div
            className="kcard-score-chip"
            style={{ background: `${scoreColor(score)}22`, color: scoreColor(score) }}
          >
            {score}
          </div>
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
        {lead.observacoes && (
          <div className="kcard-obs">{lead.observacoes}</div>
        )}
      </div>

      {/* score bar */}
      {score !== undefined && (
        <div className="lead-score-track" style={{ marginTop: 2 }}>
          <div
            className="lead-score-bar"
            style={{ width: `${score}%`, background: scoreColor(score) }}
          />
        </div>
      )}

      {/* ação */}
      <div className="lead-actions">
        {lead.status === "novo" && (
          <button className="aceitar-btn" disabled={loading}
            onClick={(e) => { e.stopPropagation(); onMudar(lead.id, "em_atendimento"); }}>
            {loading ? "..." : "Iniciar atendimento →"}
          </button>
        )}
        {lead.status === "em_atendimento" && (
          <button className="fechar-btn" disabled={loading}
            onClick={(e) => { e.stopPropagation(); onMudar(lead.id, "fechado"); }}>
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
  const [todosLeads, setTodosLeads] = useState<Lead[]>([]);
  const [atualizando, setAtualizando] = useState<string | null>(null);
  const [modalLead, setModalLead] = useState<Lead | null>(null);

  const fetchLeads = useCallback(async () => {
    try {
      const res = await fetch(`/api/leads?funcionario=${funcionario.id}`);
      if (res.ok) setLeads(await res.json());
    } catch {}
  }, [funcionario.id]);

  const fetchTodos = useCallback(async () => {
    try {
      const res = await fetch("/api/leads");
      if (res.ok) setTodosLeads(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    fetchLeads();
    fetchTodos();
    const t = setInterval(() => { fetchLeads(); fetchTodos(); }, 3000);
    return () => clearInterval(t);
  }, [fetchLeads, fetchTodos]);

  async function mudarStatus(leadId: string, status: Lead["status"]) {
    setAtualizando(leadId);
    try {
      await fetch("/api/leads", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leadId, status }),
      });
      await fetchLeads();
      await fetchTodos();
    } finally {
      setAtualizando(null);
    }
  }

  async function salvarObservacoes(leadId: string, observacoes: string) {
    await fetch("/api/leads", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ leadId, observacoes }),
    });
    setModalLead(null);
    await fetchLeads();
  }

  const novos = leads.filter((l) => l.status === "novo").length;

  // stats globais (equipe)
  const totalLeads = todosLeads.length;
  const novosTotal = todosLeads.filter(l => l.status === "novo").length;
  const andamentoTotal = todosLeads.filter(l => l.status === "em_atendimento").length;
  const fechadosTotal = todosLeads.filter(l => l.status === "fechado").length;
  const mediaScore = totalLeads > 0
    ? Math.round(todosLeads.reduce((s, l) => s + (l.score_qualificacao ?? 0), 0) / totalLeads)
    : 0;
  const taxaFechamento = totalLeads > 0 ? Math.round((fechadosTotal / totalLeads) * 100) : 0;

  // stats locais (corretor selecionado)
  const localTotal = leads.length;
  const localNovos = leads.filter(l => l.status === "novo").length;
  const localAndamento = leads.filter(l => l.status === "em_atendimento").length;
  const localFechados = leads.filter(l => l.status === "fechado").length;
  const localMediaScore = localTotal > 0
    ? Math.round(leads.reduce((s, l) => s + (l.score_qualificacao ?? 0), 0) / localTotal)
    : 0;
  const localTaxa = localTotal > 0 ? Math.round((localFechados / localTotal) * 100) : 0;

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

      {totalLeads > 0 && (
        <div className="plataforma-stats">
          <span className="stats-section-label">Equipe</span>
          <div className="stat-divider" />
          <div className="stat-item">
            <span className="stat-value">{totalLeads}</span>
            <span className="stat-label">Total</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <span className="stat-value" style={{ color: "#dc2626" }}>{novosTotal}</span>
            <span className="stat-label">Novos</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <span className="stat-value" style={{ color: "#2563eb" }}>{andamentoTotal}</span>
            <span className="stat-label">Em atendimento</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <span className="stat-value" style={{ color: "#6b6560" }}>{fechadosTotal}</span>
            <span className="stat-label">Fechados</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <span className="stat-value">{mediaScore}</span>
            <span className="stat-label">Score médio</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <span className="stat-value" style={{ color: "#16a34a" }}>{taxaFechamento}%</span>
            <span className="stat-label">Taxa de fechamento</span>
          </div>
        </div>
      )}

      {localTotal > 0 && (
        <div className="plataforma-stats-local">
          <div className="stats-local-who">
            <div className="corretor-iniciais" style={{ width: 22, height: 22, fontSize: 9 }}>
              {funcionario.iniciais}
            </div>
            <span className="stats-local-nome">{funcionario.nome}</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item stat-sm">
            <span className="stat-value-sm">{localTotal}</span>
            <span className="stat-label">Total</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item stat-sm">
            <span className="stat-value-sm" style={{ color: "#dc2626" }}>{localNovos}</span>
            <span className="stat-label">Novos</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item stat-sm">
            <span className="stat-value-sm" style={{ color: "#2563eb" }}>{localAndamento}</span>
            <span className="stat-label">Em atendimento</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item stat-sm">
            <span className="stat-value-sm" style={{ color: "#6b6560" }}>{localFechados}</span>
            <span className="stat-label">Fechados</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item stat-sm">
            <span className="stat-value-sm">{localMediaScore}</span>
            <span className="stat-label">Score médio</span>
          </div>
          <div className="stat-divider" />
          <div className="stat-item stat-sm">
            <span className="stat-value-sm" style={{ color: "#16a34a" }}>{localTaxa}%</span>
            <span className="stat-label">Taxa</span>
          </div>
        </div>
      )}

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
                          onAbrirModal={setModalLead}
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

      {modalLead && (
        <LeadModal
          lead={modalLead}
          onClose={() => setModalLead(null)}
          onSave={salvarObservacoes}
        />
      )}
    </div>
  );
}
