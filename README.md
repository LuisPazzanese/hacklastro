# HackLastro 🏠 — meu posto de comando do hackathon

Hackathon da **Lastro** (proptech de agentes de IA) — **14/06/2026**, ~11h,
sozinho. Entrega até as 21h: **vídeo de ~2 min + repositório**. O tema só é
revelado no dia.

Este diretório é auto-suficiente: os subagents e skills viajam dentro de
`.claude/`, então **basta abrir o Claude Code aqui** que tudo funciona.

## Como usar no dia (3 passos)

1. **Abra o Claude Code dentro deste diretório:**
   ```
   cd ~/Documents/HackLastro && claude
   ```
2. **Cole a chave da Lastro** no terminal antes (ou na primeira mensagem):
   ```
   export ANTHROPIC_API_KEY=sk-...
   ```
3. **Primeira mensagem pro Claude:**
   > "Leia o CLAUDE.md e me conduza. Aqui está o desafio: «cole o enunciado inteiro»"

   A partir daí o Claude segue o fluxo sozinho — ele roda o intake, chama o
   planner, escolhe o esqueleto e te diz a cada passo o que fazer. **Você não
   precisa decorar os nomes das skills/agents.**

## O fluxo que o Claude vai conduzir (pra você saber onde está)

```
1. enunciado        -> skill  intake-desafio   -> paragrafo destilado
2. paragrafo        -> agent  hack-planner     -> plano (tarefas em minutos)
3. escolher esqueleto: agent.ts | pipeline.ts | scaffold-rapido (web)
4. atacar o spike (parte incerta) PRIMEIRO
5. construir caminho feliz -> agent hack-reviewer (a cada marco)
6. quebrou? -> agent hack-buildfixer
7. ~19h30 PARA -> hack-reviewer (limpa repo) -> skill video-entrega
8. ate 21h: entrega = video + repo
```

## O que tem aqui
- `CLAUDE.md` — as instruções que fazem o Claude te conduzir (ele lê sozinho).
- `agent/agent.ts` — esqueleto de **agente com tool-calling** (mexe em TOOLS + SYSTEM).
- `data/pipeline.ts` — esqueleto de **processar/analisar dados** (transformar + analisarComLLM).
- `.claude/agents/` — `hack-planner`, `hack-reviewer`, `hack-buildfixer`.
- `.claude/skills/` — `intake-desafio`, `construir-com-llm`, `scaffold-rapido`, `deploy-rapido`, `video-entrega`.
- `.gitignore` — já ignora `.env`/`.env.local` (a chave NUNCA vai pro repo).

## Lembretes que decidem a nota
- **Intake primeiro, sempre.** Não codar antes de entender o critério de avaliação.
- **Atacar a parte incerta no começo** (o spike), não no fim.
- **Feature freeze às 19h30.** Repo limpo + vídeo é metade da entrega.
- **A chave é segredo com custo** — env var, nunca commit. Confira o diff antes de `push`.
- Uma coisa funcionando vence três pela metade.

## Antes do dia 14 (faça já, com calma)
- [ ] Testar a chave: `export ANTHROPIC_API_KEY=...` e rodar
      `npx tsx agent/agent.ts "oi"` para confirmar SDK + chave (precisa de Node + `npm i @anthropic-ai/sdk tsx`).
- [ ] Confirmar que abrir o CC aqui carrega as skills (digite `/` e veja a lista).
- [ ] Testar o software de gravação de tela (OBS ou nativo) — ver skill `video-entrega`.
