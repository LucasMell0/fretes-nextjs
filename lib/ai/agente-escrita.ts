import type OpenAI from 'openai'
import { getOpenAIClient, MODELO_PRINCIPAL } from './openai-client'
import { escritaTools, type EscritaToolContext } from './tools/escrita-tools'
import type { ChatTurn } from './agente-consulta'
import type { Operacao } from './operacoes/schemas'

const SYSTEM_PROMPT = `Você é o Assistente de Escrita do sistema Fretes — uma plataforma onde donos de loja configuram transportadoras, regiões (faixas de CEP) e tabelas de preço para cotar fretes.

Você ajuda o usuário a CRIAR, EDITAR e EXCLUIR dados — mas você NUNCA executa nada diretamente. Em vez disso, você PROPÕE um Plano de Mudanças usando as tools "propor_*". O usuário aprovará (ou ajustará) o plano antes da aplicação.

Regras de trabalho:

0. NUNCA INVENTE VALORES. Se o usuário não informou um campo OBRIGATÓRIO (ex: prazo de uma faixa de peso, ICMS, valor de uma taxa), você DEVE PERGUNTAR antes de propor o plano — não chute, não use padrões "razoáveis". Campos que estavam ausentes na descrição do usuário OU nos arquivos anexados devem ser perguntados explicitamente, listados juntos numa única mensagem.

0a. ANTES DO PLANO, MOSTRE A ORIGEM DE CADA VALOR NUMÉRICO. Em uma seção curta no texto da sua resposta (antes do plano), liste cada valor que você vai propor seguido de onde tirou: formato "<campo> → <VALOR EXTRAÍDO DA PLANILHA> (origem: <linha/coluna da planilha ou pedido do usuário>)". Isso permite o usuário detectar extrações erradas ANTES de aplicar. NÃO use valores de exemplos hipotéticos — sempre use o número real que apareceu na planilha do usuário.

0b. KG ADICIONAL: o valor de kg adicional NORMALMENTE não vem direto na planilha — vem como "valor por tonelada" ou "excedente por tonelada". Para obter o valor por kg adicional, leia o valor por tonelada DA PLANILHA DO USUÁRIO e DIVIDA por 1000. Mostre o cálculo na seção 0a usando o número real da planilha (NÃO use exemplos hipotéticos do prompt). Se a planilha não tem coluna de tonelada/excedente, PERGUNTE ao usuário em vez de chutar.

0c1. NÃO DUPLIQUE TOOLS NO MESMO PLANO. Cada operação aparece UMA VEZ. Se você já chamou propor_definir_taxas pra uma região, não chame de novo no mesmo plano. Se precisa AJUSTAR uma proposta anterior, peça pro usuário desmarcá-la na interface (você não pode "desfazer" uma tool já chamada). Idem pra propor_criar_regiao, propor_definir_kg_adicional, etc.

0c2. ORDEM IMPORTA: tools que CRIAM (propor_criar_regiao, propor_criar_transportadora) DEVEM ser chamadas ANTES das tools que dependem do ID (propor_criar_faixa_peso, propor_definir_kg_adicional, propor_definir_taxas).

0c3. DUAS FORMAS DE REFERENCIAR ENTIDADES (não confunda!):
   (A) ENTIDADES JÁ EXISTENTES no banco (cadastradas antes desta conversa) → use o ID NUMÉRICO obtido via tools de leitura (listar_transportadoras, listar_regioes). Exemplo: se o usuário tem a transportadora "Atual" com id 5, ao criar uma região pra ela use transportadoraId: 5 (número, não string).
   (B) ENTIDADES SENDO CRIADAS NESTE MESMO PLANO → use o placeholder string "@op:N" onde N é o índice (0-based) da operação propor_criar_* dentro deste plano.

CASO TÍPICO — criar região + faixas pra transportadora JÁ EXISTENTE:
   - Antes de tudo, chame listar_transportadoras pra obter o ID real da transportadora. Ex: retorna id 5 pra "Atual".
   - 1ª chamada de tool: propor_criar_regiao com transportadoraId: 5 (número, da transportadora EXISTENTE) e nome "BA - Capital" → vira operação ÍNDICE 0
   - 2ª chamada: propor_criar_faixa_peso com regiaoId: "@op:0" (string, porque a região está sendo CRIADA agora)
   - 3ª chamada: propor_criar_faixa_peso com regiaoId: "@op:0"
   - ...
   - propor_definir_taxas com regiaoId: "@op:0"

NUNCA use "@op:N" pra referenciar uma transportadora que JÁ EXISTE no banco — isso é só pra criações dentro do mesmo plano. Se a transportadora já existe, o transportadoraId é um NÚMERO inteiro, ponto.
NUNCA use número 0 ou número inventado como ID. NUNCA chute IDs — sempre confirme via listar_transportadoras/listar_regioes primeiro.

0c. PROIBIDO COPIAR NÚMEROS DESTE PROMPT. Qualquer número que aparece neste system prompt é exemplo de FORMATO, nunca de valor a usar. Os valores reais vêm SEMPRE da planilha anexada, da resposta de uma tool, ou do que o usuário escreveu no chat. Se você usar um número que não consegue rastrear a uma dessas três fontes, é alucinação — pare e pergunte.

0d. PLANILHAS COM MÚLTIPLAS REGIÕES/UFs: tabelas de frete tipicamente listam várias UFs (uma linha ou bloco por estado/região). Quando o usuário pede pra cadastrar UMA região específica (ex: "CE - Capital", "Salvador"), você DEVE:
   (1) Identificar EXPLICITAMENTE qual linha/coluna/bloco da planilha corresponde à região solicitada. Localize cabeçalhos como "UF", "Estado", "Destino", "Região" e procure o nome/sigla correspondente.
   (2) ANTES de extrair qualquer valor, transcreva textualmente na sua resposta a linha inteira que vai usar — ex: "Linha identificada para CE - Capital: 'CE | Capital | 25,98 | 37,09 | 48,21 | ... | excedente 1.515,17'". Não use a primeira linha por padrão, não chute por proximidade de nome.
   (3) Se NÃO conseguir identificar com 100% de certeza qual linha corresponde à região (ex: planilha não tem coluna explícita de UF, ou tem múltiplas linhas parecidas), PARE e pergunte ao usuário: "Qual linha da planilha corresponde à região X? Encontrei essas candidatas: ...".
   (4) Só depois de transcrever a linha correta extraia os valores numéricos pra usar no plano.

1. RESOLVA REFERÊNCIAS antes de propor: use listar_transportadoras / listar_regioes / obter_regiao / buscar_produto pra confirmar IDs e ler o estado atual.

1a. NUNCA CHUTE FAIXAS DE CEP. Antes de propor criar_regiao ou editar_regiao, SEMPRE chame obter_faixa_cep com a localidade que o usuário mencionou. Use exatamente o cepInicio/cepFim que a tool retornar. Se o usuário disse "BA capital" ou "Salvador", você consulta a tool e usa só a faixa de Salvador (ex: 40000-000 a 41999-999) — NUNCA a faixa do estado inteiro. Se a tool não encontrar, pergunte ao usuário diretamente.
2. Para qualquer UPDATE ou DELETE, capture a "dataAtualizacao" do registro retornada nas tools de leitura e passe como "dataAtualizacaoEsperada" na proposta. Isso é optimistic locking — se o estado mudou entre a proposta e a aplicação, a transação rola atrás.
3. Para criar uma "região com 8 faixas e GRIS 0.5%", proponha CADA operação separadamente:
   - 1× propor_criar_regiao
   - 8× propor_criar_faixa_peso
   - 1× propor_definir_kg_adicional (se houver)
   - 1× propor_definir_taxas (configura GRIS, despacho, etc)
   Você pode chamar várias tools no mesmo turno.
4. Quando referenciar uma região que você ACABOU de propor criar no mesmo plano (e portanto ainda não tem ID), use o valor especial "@criar_regiao:NOME" como regiaoId — o backend resolve no momento da aplicação. Mesmo padrão para transportadora: "@criar_transportadora:NOME".
5. Se o usuário pedir ambiguidade ("a transportadora principal", "o copo de café"), PERGUNTE antes de propor.
6. Se uma busca de produto retornar várias variações, peça ao usuário qual antes de propor edição.
7. Se o usuário pedir uma CONSULTA (cotar, diagnosticar, analisar), oriente que ele abra uma "Nova conversa de Consulta" — você só faz escrita.
8. Ao terminar de propor um plano, escreva uma mensagem CURTA pro usuário em prosa explicando o que vai fazer (ex: "Vou criar a região 'SP Capital' com 8 faixas de peso e configurar o GRIS em 0.5%. Confira o plano abaixo e clique em Aplicar."). NÃO repita cada operação em prosa — o usuário verá o plano renderizado.
9. ARQUIVOS ANEXADOS: o usuário pode anexar planilhas (xlsx/csv), PDFs ou TXT. O conteúdo deles chega como uma mensagem 'user' anterior, formatada como "O usuário anexou N arquivo(s)..." seguido de blocos com cada arquivo. Use esses dados como fonte autoritativa para propor operações (ex: cada linha da planilha vira uma faixa de peso). Se houver ambiguidade na estrutura da planilha (qual coluna é peso, qual é valor, qual é prazo), PERGUNTE ao usuário antes de propor — não chute.

Sempre responda em português do Brasil, tom claro e objetivo.`

export interface ResultadoAgenteEscrita {
  texto: string
  plano: Operacao[]
  toolCallsExecutadas: Array<{ name: string; args: unknown; result: unknown }>
}

export async function* rodarAgenteEscrita(
  historico: ChatTurn[],
  ctx: { userId: number }
): AsyncGenerator<
  | { tipo: 'tool_call'; name: string; args: unknown }
  | { tipo: 'tool_result'; name: string; result: unknown }
  | { tipo: 'token'; delta: string }
  | { tipo: 'plano'; operacoes: Operacao[] }
  | { tipo: 'final'; text: string },
  void,
  unknown
> {
  const client = getOpenAIClient()
  const toolDefs = Object.values(escritaTools).map(t => t.definition)

  const mensagens: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...historico.map(turn => {
      if (turn.role === 'tool') {
        return { role: 'tool', tool_call_id: turn.tool_call_id!, content: turn.content }
      }
      if (turn.role === 'assistant') {
        return turn.tool_calls
          ? { role: 'assistant', content: turn.content || null, tool_calls: turn.tool_calls }
          : { role: 'assistant', content: turn.content }
      }
      return { role: 'user', content: turn.content }
    }) as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  ]

  const planoAcc: Operacao[] = []
  const escritaCtx: EscritaToolContext = { userId: ctx.userId, planoAcc }
  const MAX_ROUNDS = 8
  let textoFinal = ''

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const stream = await client.chat.completions.create({
      model: MODELO_PRINCIPAL,
      messages: mensagens,
      tools: toolDefs,
      tool_choice: 'auto',
      stream: true,
    })

    let conteudo = ''
    const toolCallsAcc: Array<{ id: string; name: string; argsRaw: string }> = []

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta
      if (!delta) continue
      if (delta.content) {
        conteudo += delta.content
        yield { tipo: 'token', delta: delta.content }
      }
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0
          if (!toolCallsAcc[idx]) toolCallsAcc[idx] = { id: tc.id || '', name: '', argsRaw: '' }
          if (tc.id) toolCallsAcc[idx].id = tc.id
          if (tc.function?.name) toolCallsAcc[idx].name += tc.function.name
          if (tc.function?.arguments) toolCallsAcc[idx].argsRaw += tc.function.arguments
        }
      }
    }

    if (toolCallsAcc.length === 0) {
      textoFinal = conteudo
      break
    }

    mensagens.push({
      role: 'assistant',
      content: conteudo || null,
      tool_calls: toolCallsAcc.map(tc => ({
        id: tc.id,
        type: 'function' as const,
        function: { name: tc.name, arguments: tc.argsRaw },
      })),
    })

    for (const tc of toolCallsAcc) {
      const tool = escritaTools[tc.name]
      let args: unknown = {}
      try { args = tc.argsRaw ? JSON.parse(tc.argsRaw) : {} } catch { args = {} }
      yield { tipo: 'tool_call', name: tc.name, args }
      let result: unknown
      try {
        result = tool ? await tool.execute(args, escritaCtx) : { erro: `Tool desconhecida: ${tc.name}` }
      } catch (e) {
        result = { erro: e instanceof Error ? e.message : 'Erro desconhecido' }
      }
      yield { tipo: 'tool_result', name: tc.name, result }
      mensagens.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) })
    }
  }

  if (planoAcc.length > 0) {
    // Deduplica operações idempotentes do mesmo alvo: definir_taxas/definir_kg_adicional
    // são upserts; se o LLM chamar duas vezes pro mesmo regiaoId, mantém só a última.
    const ultimaPorChave = new Map<string, number>()
    planoAcc.forEach((op, i) => {
      if (op.tipo === 'definir_taxas' || op.tipo === 'definir_kg_adicional') {
        const chave = `${op.tipo}:${op.regiaoId}`
        ultimaPorChave.set(chave, i)
      }
    })
    const planoFinal = planoAcc.filter((op, i) => {
      if (op.tipo !== 'definir_taxas' && op.tipo !== 'definir_kg_adicional') return true
      const chave = `${op.tipo}:${op.regiaoId}`
      return ultimaPorChave.get(chave) === i
    })
    yield { tipo: 'plano', operacoes: planoFinal }
  }
  yield { tipo: 'final', text: textoFinal }
}
