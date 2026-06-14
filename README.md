# Lastro SDR — Assessoria imobiliária com IA

Solução desenvolvida para o Hackathon Lastro (14/06/2026).

Um SDR (Sales Development Representative) com IA que qualifica leads imobiliários via chat, exibe imóveis em mapa interativo e distribui os leads automaticamente para corretores internos.

---

## O problema

Imobiliárias perdem leads porque o primeiro contato é lento, genérico e manual. O corretor recebe um formulário sem saber se o cliente está pronto para comprar ou só explorando.

## A solução

Um agente de IA conversa com o cliente, descobre o que ele realmente quer (finalidade, orçamento, região, tipo de imóvel) e mostra as opções progressivamente — afunilando os pins no mapa a cada resposta. Quando o cliente manifesta interesse, o lead é registrado com score de qualificação e distribuído automaticamente ao próximo corretor.

---

## Funcionalidades

### SDR conversacional
- Chat com Claude Sonnet via Anthropic SDK (tool use)
- Qualificação em etapas: finalidade → orçamento → região → tipo
- Respostas com botões de opção gerados dinamicamente
- Tools: `buscar_imoveis` e `registrar_lead`

### Mapa interativo (estilo Zillow)
- Tiles CartoDB Voyager (cores naturais — terra verde, água azul)
- 63 imóveis em 15 cidades brasileiras com coordenadas reais
- Clique no estado → zoom imediato + todos os pins do estado aparecem
- A cada resposta do SDR os pins se refinam até sobrar os mais compatíveis
- Estados interativos com hover e tooltip (desabilitados quando pins visíveis)

### Score de qualificação
Cada lead recebe score 0–100 (+20 por campo preenchido: nome, contato, orçamento, região, imóvel de interesse).

### Plataforma interna (`/plataforma`)
- Distribuição sequencial automática (round-robin) entre corretores
- Cada corretor vê apenas seus próprios leads
- Status: **Novo** → **Em atendimento** → **Fechado**
- Polling a cada 3s para novos leads em tempo real

---

## Stack

| Camada | Tecnologia |
|--------|------------|
| Framework | Next.js 14 (App Router) |
| IA | Anthropic Claude Sonnet (`claude-sonnet-4-6`) |
| Mapa | Leaflet + CartoDB Voyager tiles |
| Dados | JSON local (`agent/imoveis.json`, `agent/leads.json`) |

---

## Arquitetura

```
app/
├── page.tsx              # UI: landing → chat sidebar + mapa
├── Map.tsx               # Mapa Leaflet com estados e pins
├── api/
│   ├── chat/route.ts     # SDR: loop de tool use com Claude
│   ├── leads/route.ts    # GET/PATCH de leads
│   └── imoveis/route.ts  # Pins imediatos ao clicar no estado

agent/
├── imoveis.json          # 63 imóveis com coordenadas reais
├── leads.json            # Leads registrados
├── state.json            # Contador round-robin
└── match.ts              # Hard filters + soft scoring
```

### Fluxo

```
Usuário clica no estado no mapa
  → Pins do estado aparecem imediatamente
  → SDR inicia qualificação

Usuário conversa com o SDR
  → Cada resposta afunila os pins
  → Até sobrar os imóveis mais compatíveis

Usuário clica "Tenho interesse"
  → SDR coleta nome + contato
  → Lead registrado com score de qualificação
  → Round-robin atribui ao próximo corretor

Corretor abre /plataforma
  → Vê seus leads em tempo real
  → Atualiza status: Novo → Em atendimento → Fechado
```

### Motor de match (`agent/match.ts`)

- **Hard filters**: finalidade + localização + tipo
- **Soft scoring**: quartos + preço → compatibilidade 0–1
- **Fallback**: relaxa filtro de tipo se geo retornar zero resultados
- Retorna top 5 por score

---

## Como rodar

```bash
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Preencher ANTHROPIC_API_KEY

npm run dev
# http://localhost:3000        → SDR + mapa
# http://localhost:3000/plataforma → painel do corretor
```

### Variáveis de ambiente

| Variável | Descrição |
|----------|-----------|
| `ANTHROPIC_API_KEY` | Chave da API Anthropic |
| `MODEL` | Opcional — padrão `claude-sonnet-4-6` |

> A chave nunca chega ao cliente. A API route roda exclusivamente no servidor Node.js.

---

## Decisões de produto

**SDR em vez de busca tradicional**: o cliente raramente sabe o que quer com precisão. Qualificar antes de mostrar reduz sobrecarga de opções e melhora a qualidade do lead.

**Round-robin**: distribuição justa e simples. O lead vai para o próximo corretor da fila — sem gamificação, sem complexidade de tiers.

**Persistência local**: escolha deliberada para o hackathon — zero infraestrutura, zero latência. Em produção: substituir por Postgres.

---

## Trabalho futuro

- Autenticação real para corretores
- Banco de dados persistente
- Filtros avançados no mapa (preço, quartos, tipo)
- Integração com WhatsApp Business API
- Analytics de conversão por corretor
