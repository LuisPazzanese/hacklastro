# HackLastro — instruções de orquestração (você, Claude, conduz o dia)

Este projeto é o harness do Luis para o hackathon da Lastro (14/06/2026, ~11h,
sozinho; entrega = vídeo de ~2 min + repositório, até as 21h). Você NÃO sabe o
tema com antecedência — o Luis vai colar o enunciado no início. Seu papel é
**conduzir o fluxo na ordem certa** para ele não se perder entre skills e agents.

## Princípio mestre
NÃO escreva código até o intake estar feito. Atacar o problema certo vale mais
que qualquer linha. Uma coisa funcionando vence três pela metade. Corte escopo
sem dó. Proteja a última 1h30 (a partir das ~19h30) para repo + vídeo.

## O que fazer assim que o Luis colar o enunciado do desafio
Siga esta sequência e, a cada etapa, diga a ele em 1 linha o que está fazendo e
qual é a próxima — ele não precisa lembrar os nomes das skills/agents, você puxa.

1. **Intake** — invoque a skill `intake-desafio` com o enunciado completo.
   Produza o parágrafo final ("o desafio é X, entrego Y, avaliado por Z,
   começando pela parte arriscada W") e qual esqueleto usar. Confirme com o Luis
   se o critério de avaliação está claro; se não, mande ele PERGUNTAR a um
   organizador antes de seguir.
2. **Planejar** — delegue ao subagent `hack-planner` passando o PARÁGRAFO do
   intake (não o enunciado cru). Ele devolve tarefas ordenadas em minutos, MVP,
   maior risco e o bloco final travado. Apresente o plano ao Luis.
3. **Escolher o esqueleto** (o intake aponta qual):
   - agente com ferramentas → use `agent/agent.ts` (mexe em TOOLS + SYSTEM).
   - processar/analisar dados → use `data/pipeline.ts` (mexe em transformar() +
     analisarComLLM()).
   - app web com interface → skill `scaffold-rapido` (só se precisar de UI).
   - outra coisa → desenhe o menor caminho próprio, sem forçar molde.
   Consulte a skill `construir-com-llm` para saber como plugar a lógica.
4. **Atacar a parte incerta PRIMEIRO** (o spike/tarefa 0 do plano), não por
   último. Faça um deploy "hello world" cedo se for web (skill `deploy-rapido`).
5. **Construir** o caminho feliz seguindo o plano. A cada marco importante,
   rode o subagent `hack-reviewer` (pega o que quebra + legibilidade do repo).
6. **Quebrou?** — delegue ao subagent `hack-buildfixer` (uma hipótese por vez).
7. **~19h30: PARE de codar.** Feature freeze; o resto vira "trabalho futuro" no
   README. Rode `hack-reviewer` para limpar repo + README, depois a skill
   `video-entrega` para o roteiro do vídeo de 2 min.
8. **Até 21h:** entrega = vídeo + repo no canal indicado.

## Mapa rápido (quando usar o quê)
| Fase | Ferramenta | Tipo |
|---|---|---|
| Entender o desafio | `intake-desafio` | skill |
| Planejar/cortar escopo | `hack-planner` | subagent |
| Como plugar nos esqueletos | `construir-com-llm` | skill |
| App web (só se tiver UI) | `scaffold-rapido` | skill |
| Subir na Vercel cedo | `deploy-rapido` | skill |
| Revisar (bugs + legibilidade) | `hack-reviewer` | subagent |
| Diagnosticar build/runtime | `hack-buildfixer` | subagent |
| Vídeo de entrega | `video-entrega` | skill |

## Regras invioláveis
- A chave `ANTHROPIC_API_KEY` é fornecida pela Lastro no dia — é segredo com
  custo. Use env var, NUNCA commite. O `.gitignore` já ignora `.env`/`.env.local`.
- Antes de qualquer `git push`, confirme que nenhum segredo está no diff.
- O repositório vai ser LIDO pelos avaliadores — README claro é o item de maior
  retorno depois de "funcionar".
- Modelo padrão dos esqueletos: `claude-sonnet-4-6` (rápido/barato). Suba para
  `claude-opus-4-8` (env `MODEL=`) só se o desafio exigir raciocínio pesado.

## Estado atual (antes do dia 14)
Os esqueletos `agent/agent.ts` e `data/pipeline.ts` estão prontos mas SEM lógica
de domínio (proposital — o tema só sai no dia). No dia, mantenha só o esqueleto
que o formato pedir e apague/ignore o outro.
