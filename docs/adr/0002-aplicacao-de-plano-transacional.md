# Aplicação de Plano via endpoint transacional com optimistic locking

A aplicação de um **Plano de Mudanças** (produzido pelo **Agente de Escrita**) acontece num endpoint dedicado — algo como `POST /api/assistente/aplicar-plano` — que recebe o array de operações e aplica tudo dentro de uma única `prisma.$transaction(...)`. Cada operação que referencia um registro existente carrega o `dataAtualizacao` original capturado quando o Plano foi gerado; no momento de aplicar, o backend valida que esse carimbo ainda bate — caso contrário, **a transação inteira rola atrás** e o usuário recebe a mensagem *"o estado mudou desde a proposta — recarregue"*.

Alternativas consideradas e rejeitadas:
- **Agente chama as APIs REST existentes uma a uma** — perde atomicidade (uma falha na operação 7 deixa as 6 anteriores aplicadas), e o caos parcial é pior do que o usuário recomeçar.
- **Agente executa Prisma direto via tool calls** — exige replicar a validação Zod fora dos endpoints REST e abre superfície de ataque (LLM gerando query maliciosa).
- **Last-write-wins sem optimistic locking** — corrompe configuração quando o estado mudou entre propor e aplicar (cenário comum: 5min lendo o Plano enquanto outra aba edita).

O endpoint transacional reaproveita os schemas Zod dos endpoints REST existentes (extraídos para `lib/validators/` quando preciso), preserva consistência sob concorrência, e mantém o LLM como **gerador de operações** — nunca executor.
