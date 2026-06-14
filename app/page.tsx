"use client";

import { useState, useRef, useEffect, useCallback, useLayoutEffect } from "react";
import dynamic from "next/dynamic";
import LastroIcon from "./LastroIcon";

const MapView = dynamic(() => import("./Map"), { ssr: false });

type Phase = "landing" | "chatting";
type Display = { role: "user" | "sdr"; text: string };
type Imovel = {
  id: string; tipo: string; cidade: string; bairro: string;
  preco: number; quartos: number; area: number; vagas: number;
  lat: number; lng: number; destaque: string;
  compatibilidade?: number; matchedFields?: string[];
};

export default function Home() {
  const [phase, setPhase] = useState<Phase>("landing");
  const [history, setHistory] = useState<unknown[]>([]);
  const [display, setDisplay] = useState<Display[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [imoveis, setImoveis] = useState<Imovel[]>([]);
  const [selected, setSelected] = useState<Imovel | null>(null);
  const [modelName, setModelName] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Ref sempre aponta para a versão mais recente de sendMessage (evita stale closure no mapa)
  const sendMessageRef = useRef<(text: string) => Promise<void>>(async () => {});

  useLayoutEffect(() => {
    sendMessageRef.current = sendMessage;
  });

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [display, loading]);

  useEffect(() => {
    if (phase === "chatting") setTimeout(() => inputRef.current?.focus(), 300);
  }, [phase]);

  async function sendMessage(text: string) {
    if (!text || loading) return;
    setInput("");
    if (phase === "landing") setPhase("chatting");
    setDisplay((d) => [...d, { role: "user", text }]);
    setLoading(true);
    const novaHistory = [...history, { role: "user", content: text }];
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: novaHistory }),
      });
      const data = await res.json();
      setHistory(data.messages ?? novaHistory);
      setDisplay((d) => [...d, { role: "sdr", text: data.reply ?? "(sem resposta)" }]);
      if (data.imoveis?.length) setImoveis(data.imoveis);
      if (data.model) setModelName(data.model);
    } catch {
      setDisplay((d) => [...d, { role: "sdr", text: "Ops, tive um problema. Tenta de novo?" }]);
    } finally {
      setLoading(false);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text) return;
    await sendMessage(text);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) send();
  }

  const onEstadoClick = useCallback(async (estado: string) => {
    if (phase === "landing") setPhase("chatting");
    // Só exibe pins do estado se o chat ainda não trouxe pins refinados
    fetch(`/api/imoveis?estado=${encodeURIComponent(estado)}`)
      .then((r) => r.json())
      .then((data: Imovel[]) => {
        setImoveis((prev) => (prev.length === 0 && data.length ? data : prev));
      })
      .catch(() => {});
    sendMessageRef.current(`Quero ver imóveis em ${estado}`);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  return (
    <main suppressHydrationWarning>
      <div className={`map-bg ${phase}`}>
        <MapView
          imoveis={imoveis}
          onSelect={setSelected}
          onEstadoClick={onEstadoClick}
        />
      </div>

      {/* LANDING */}
      {phase === "landing" && (
        <div className="landing-content">
          <div className="landing-card">
            <div className="brand-hero">
              <LastroIcon size={32} color="#6d44c0" />
              <span className="brand-wordmark">Lastro</span>
            </div>
            <h1 className="welcome-heading">
              Encontre o imóvel
              <em>ideal para você.</em>
            </h1>
            <p className="welcome-sub">Assessoria imobiliária com IA</p>
            <div className="landing-input">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="O que você está procurando?"
              />
              <button onClick={send} disabled={!input.trim()}>→</button>
            </div>
          </div>
        </div>
      )}

      {/* CHAT SIDEBAR */}
      {phase === "chatting" && (
        <>
          <div className="brand-corner">
            <LastroIcon size={18} color="#6d44c0" />
            LASTRO
          </div>

          <div className="chat-panel">
            <div className="chat-header">
              <LastroIcon size={14} color="#6d44c0" />
              Lastro SDR
              {modelName && <span className="model-badge">{modelName}</span>}
            </div>

            <div className="messages" ref={scrollRef}>
              {display.map((m, i) => {
                if (m.role !== "sdr") return (
                  <div key={i} className="bubble user">
                    <div className="bubble-text">{m.text}</div>
                  </div>
                );
                const optMatch = m.text.match(/OPÇÕES:\n((?:- .+\n?)+)/);
                const opcoes = optMatch
                  ? optMatch[1].trim().split("\n").map(l => l.replace(/^- /, ""))
                  : [];
                const textoLimpo = m.text.replace(/OPÇÕES:\n(?:- .+\n?)+/, "").trim();
                const isLast = i === display.length - 1;
                return (
                  <div key={i} className="bubble sdr">
                    <div className="sdr-avatar"><LastroIcon size={14} color="#fff" /></div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div className="bubble-text">{textoLimpo}</div>
                      {opcoes.length > 0 && isLast && (
                        <div className="opcoes-btns">
                          {opcoes.map((op, j) => (
                            <button key={j} className="opcao-btn" onClick={() => sendMessage(op)}>
                              {op}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {loading && (
                <div className="bubble sdr">
                  <div className="sdr-avatar"><LastroIcon size={14} color="#fff" /></div>
                  <div className="bubble-text">
                    <div className="typing-dots"><span /><span /><span /></div>
                  </div>
                </div>
              )}
            </div>

            <div className="composer">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Continue a conversa…"
              />
              <button onClick={send} disabled={loading}>→</button>
            </div>
          </div>
        </>
      )}

      {/* MODAL */}
      {selected && (
        <div className="modal" onClick={() => setSelected(null)}>
          <div className="modalcard" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setSelected(null)}>×</button>
            <h2>{selected.bairro}, {selected.cidade}</h2>
            <p className="price">R$ {selected.preco.toLocaleString("pt-BR")}</p>
            <p>{selected.quartos} quartos · {selected.area}m² · {selected.vagas} vaga(s) · {selected.tipo}</p>
            <p className="destaque">{selected.destaque}</p>
            {selected.matchedFields?.length ? (
              <ul>{selected.matchedFields.map((f, i) => <li key={i}>{f}</li>)}</ul>
            ) : null}
            <button
              className="interesse-btn"
              onClick={() => {
                const msg = `Tenho interesse no imóvel ${selected.id} — ${selected.bairro}, ${selected.cidade} (R$ ${selected.preco.toLocaleString("pt-BR")})`;
                setSelected(null);
                sendMessage(msg);
              }}
            >
              Tenho interesse →
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
