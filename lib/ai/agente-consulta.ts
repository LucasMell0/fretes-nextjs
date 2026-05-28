import type OpenAI from 'openai'
import { getOpenAIClient, MODELO_PRINCIPAL } from './openai-client'
import { consultaTools } from './tools/consulta-tools'
import type { Tool, ToolContext } from './tools/types'

const SYSTEM_PROMPT = `Você é o Assistente de Consulta do sistema Fretes — uma plataforma onde donos de loja cadastram transportadoras, regiões (faixas de CEP) e tabelas de preço para cotar fretes.

Você só faz LEITURA: cotação ativa, diagnóstico de cotações que não atendem, analytics de cotações passadas e audit de configuração. Você NUNCA cria, edita ou exclui dados. Se o usuário pedir uma operação de escrita ("cria", "ajusta", "remove"), oriente educadamente que ele precisa abrir uma "Nova conversa de Escrita" na sidebar.

Regras de trabalho:
- Sempre que precisar resolver uma referência por nome (produto, transportadora), use as tools de busca. Não invente IDs nem confie em palpites — verifique.
- Antes de cotar, confirme o CEP de destino (8 dígitos) e a lista de SKUs+quantidades.
- Se a busca de produto retornar múltiplos matches, pergunte ao usuário qual antes de prosseguir.
- Apresente resultados de cotação como uma tabela ou lista clara: transportadora, valor, prazo, e se houver erros, explique por quê (CEP fora de cobertura, SKU sem cadastro, etc).
- Sempre responda em português do Brasil, tom claro e objetivo.`

export const consultaToolsRegistry: Record<string, Tool> = consultaTools

export interface ChatTurn {
  role: 'user' | 'assistant' | 'tool'
  content: string
  tool_calls?: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[]
  tool_call_id?: string
}

/**
 * Roda um turno completo do Agente de Consulta: mensagens prévias + nova mensagem do usuário.
 * Executa tools até o modelo parar e devolve a resposta final em prosa + lista de eventos.
 *
 * Eventos retornados (em ordem):
 *   { tipo: 'tool_call', name, args }
 *   { tipo: 'tool_result', name, result }
 *   { tipo: 'final', text }
 */
export async function* rodarAgenteConsulta(
  historico: ChatTurn[],
  ctx: ToolContext
): AsyncGenerator<
  | { tipo: 'tool_call'; name: string; args: unknown }
  | { tipo: 'tool_result'; name: string; result: unknown }
  | { tipo: 'token'; delta: string }
  | { tipo: 'final'; text: string },
  void,
  unknown
> {
  const client = getOpenAIClient()
  const toolDefs = Object.values(consultaTools).map(t => t.definition)

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

  const MAX_ROUNDS = 6
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
          if (!toolCallsAcc[idx]) {
            toolCallsAcc[idx] = { id: tc.id || '', name: '', argsRaw: '' }
          }
          if (tc.id) toolCallsAcc[idx].id = tc.id
          if (tc.function?.name) toolCallsAcc[idx].name += tc.function.name
          if (tc.function?.arguments) toolCallsAcc[idx].argsRaw += tc.function.arguments
        }
      }
    }

    // Se não houve tool calls, é a resposta final
    if (toolCallsAcc.length === 0) {
      textoFinal = conteudo
      break
    }

    // Adiciona a mensagem do assistant com as tool calls
    mensagens.push({
      role: 'assistant',
      content: conteudo || null,
      tool_calls: toolCallsAcc.map(tc => ({
        id: tc.id,
        type: 'function' as const,
        function: { name: tc.name, arguments: tc.argsRaw },
      })),
    })

    // Executa cada tool call e adiciona resultado
    for (const tc of toolCallsAcc) {
      const tool = consultaTools[tc.name]
      let args: unknown = {}
      try {
        args = tc.argsRaw ? JSON.parse(tc.argsRaw) : {}
      } catch {
        args = {}
      }
      yield { tipo: 'tool_call', name: tc.name, args }

      let result: unknown
      try {
        if (!tool) {
          result = { erro: `Tool desconhecida: ${tc.name}` }
        } else {
          result = await tool.execute(args, ctx)
        }
      } catch (e) {
        result = { erro: e instanceof Error ? e.message : 'Erro desconhecido' }
      }
      yield { tipo: 'tool_result', name: tc.name, result }

      mensagens.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(result),
      })
    }
  }

  yield { tipo: 'final', text: textoFinal }
}
