"use client";

import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";

// Leaflet usa `window`, então o mapa só carrega no cliente.
const MapView = dynamic(() => import("./Map"), { ssr: false });

type Display = { role: "user" | "sdr"; text: string };
type Imovel = {
  id: string;
  tipo: string;
  cidade: string;
  bairro: string;
  preco: number;
  quartos: number;
  area: number;
  vagas: number;
  lat: number;
  lng: number;
  destaque: string;
  compatibilidade?: number;
  matchedFields?: string[];
};

const SAUDACAO =
  "Olá! 👋 Sou o assistente da Lastro. Pra começar: você quer comprar ou alugar, e em qual cidade?";

export default function Home() {
  const [history, setHistory] = useState<unknown[]>([]);
  const [display, setDisplay] = useState<Display[]>([{ role: "sdr", text: SAUDACAO }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [imoveis, setImoveis] = useState<Imovel[]>([]);
  const [selected, setSelected] = useState<Imovel | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [display, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
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
    } catch {
      setDisplay((d) => [...d, { role: "sdr", text: "Ops, tive um problema. Tenta de novo?" }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="layout">
      <div className="mapwrap">
        <MapView imoveis={imoveis} onSelect={setSelected} />
        <div className="brand">
          🏠 Lastro <span>SDR</span>
        </div>
      </div>

      <aside className="chat">
        <div className="messages" ref={scrollRef}>
          {display.map((m, i) => (
            <div key={i} className={`bubble ${m.role}`}>
              {m.text}
            </div>
          ))}
          {loading && <div className="bubble sdr typing">digitando…</div>}
        </div>

        {imoveis.length > 0 && (
          <div className="cards">
            {imoveis.map((im) => (
              <button key={im.id} className="card" onClick={() => setSelected(im)}>
                <strong>
                  {im.bairro}, {im.cidade}
                </strong>
                <span>
                  R$ {im.preco.toLocaleString("pt-BR")} · {im.quartos}q · {im.tipo}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="composer">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Escreva sua mensagem…"
          />
          <button onClick={send} disabled={loading}>
            Enviar
          </button>
        </div>
      </aside>

      {selected && (
        <div className="modal" onClick={() => setSelected(null)}>
          <div className="modalcard" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setSelected(null)}>
              ×
            </button>
            <h2>
              {selected.bairro}, {selected.cidade}
            </h2>
            <p className="price">R$ {selected.preco.toLocaleString("pt-BR")}</p>
            <p>
              {selected.quartos} quartos · {selected.area}m² · {selected.vagas} vaga(s) ·{" "}
              {selected.tipo}
            </p>
            <p className="destaque">{selected.destaque}</p>
            {selected.matchedFields?.length ? (
              <ul>
                {selected.matchedFields.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      )}
    </main>
  );
}
