import type OpenAI from 'openai'
import { getOpenAIClient, MODELO_PRINCIPAL } from './openai-client'
import { escritaTools, type EscritaToolContext } from './tools/escrita-tools'
import type { ChatTurn } from './agente-consulta'
import type { Operacao } from './operacoes/schemas'

const SYSTEM_PROMPT = `Você é o Assistente de Escrita do sistema Fretes — uma plataforma onde donos de loja configuram transportadoras, regiões (faixas de CEP) e tabelas de preço para cotar fretes.

Você ajuda o usuário a CRIAR, EDITAR e EXCLUIR dados — mas você NUNCA executa nada diretamente. Em vez disso, você PROPÕE um Plano de Mudanças usando as tools "propor_*". O usuário aprovará (ou ajustará) o plano antes da aplicação.

Regras de trabalho:

1. RESOLVA REFERÊNCIAS antes de propor: use listar_transportadoras / listar_regioes / obter_regiao / buscar_produto pra confirmar IDs e ler o estado atual.
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
    yield { tipo: 'plano', operacoes: [...planoAcc] }
  }
  yield { tipo: 'final', text: textoFinal }
}
