import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { parseRouteId, getSessionUserId } from '@/lib/utils/parse'
import { rodarAgenteConsulta, type ChatTurn } from '@/lib/ai/agente-consulta'
import type { Prisma } from '@prisma/client'

interface RouteParams { id: string }

const enviarMensagemSchema = z.object({
  conteudo: z.string().min(1).max(8000),
})

const COTA_MENSAL_PADRAO = 200
const HARD_LIMIT_MENSAGENS = 100
const JANELA_HISTORICO = 30

/**
 * Verifica e incrementa a cota mensal de mensagens do usuário.
 * Lança Error com status 429 se a cota foi atingida.
 */
async function consumirCota(userId: number) {
  const agora = new Date()
  const ano = agora.getUTCFullYear()
  const mes = agora.getUTCMonth() + 1

  const uso = await prisma.assistenteUsoMensal.upsert({
    where: { usuarioId_ano_mes: { usuarioId: userId, ano, mes } },
    create: { usuarioId: userId, ano, mes, mensagens: 0, cotaMensal: COTA_MENSAL_PADRAO },
    update: {},
  })

  if (uso.mensagens >= uso.cotaMensal) {
    const err = new Error(`Cota mensal de ${uso.cotaMensal} mensagens atingida. Reinicia no início do próximo mês.`) as Error & { status?: number }
    err.status = 429
    throw err
  }

  await prisma.assistenteUsoMensal.update({
    where: { id: uso.id },
    data: { mensagens: { increment: 1 } },
  })
}

export async function POST(
  req: NextRequest,
  context: { params: RouteParams }
): Promise<Response> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }
  const userId = getSessionUserId(session)
  const conversaId = parseRouteId(context.params.id)

  const conversa = await prisma.assistenteConversa.findFirst({
    where: { id: conversaId, usuarioId: userId },
    include: {
      mensagens: { orderBy: { dataCriacao: 'asc' } },
    },
  })
  if (!conversa) {
    return NextResponse.json({ erro: 'Conversa não encontrada' }, { status: 404 })
  }

  if (conversa.mensagens.length >= HARD_LIMIT_MENSAGENS * 2) {
    return NextResponse.json(
      { erro: `Esta conversa atingiu o limite de ${HARD_LIMIT_MENSAGENS} turnos. Crie uma nova conversa.` },
      { status: 400 }
    )
  }

  const body = await req.json()
  const validation = enviarMensagemSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json(
      { erro: 'Dados inválidos', detalhes: validation.error.errors },
      { status: 400 }
    )
  }

  try {
    await consumirCota(userId)
  } catch (e) {
    const err = e as Error & { status?: number }
    return NextResponse.json({ erro: err.message }, { status: err.status ?? 500 })
  }

  // Persiste a mensagem do usuário
  const mensagemUsuario = await prisma.assistenteMensagem.create({
    data: {
      conversaId,
      role: 'USER',
      conteudo: validation.data.conteudo,
    },
  })

  // Toca dataAtualizacao da conversa pra subir no topo da lista
  await prisma.assistenteConversa.update({
    where: { id: conversaId },
    data: { dataAtualizacao: new Date() },
  })

  // Constrói histórico (janela deslizante: últimas N mensagens) — só pra Consulta neste momento
  const historicoRaw = [...conversa.mensagens, mensagemUsuario]
  const historicoJanela = historicoRaw.slice(-JANELA_HISTORICO)
  const historico: ChatTurn[] = historicoJanela.map(m => {
    if (m.role === 'TOOL') {
      const toolPayload = m.toolCalls as { tool_call_id?: string } | null
      return {
        role: 'tool',
        content: m.conteudo,
        tool_call_id: toolPayload?.tool_call_id,
      }
    }
    if (m.role === 'ASSISTANT') {
      const toolPayload = m.toolCalls as { tool_calls?: unknown } | null
      return {
        role: 'assistant',
        content: m.conteudo,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tool_calls: toolPayload?.tool_calls as any,
      }
    }
    return { role: 'user', content: m.conteudo }
  })

  if (conversa.agente !== 'CONSULTA') {
    return NextResponse.json(
      { erro: 'Apenas conversas de Consulta estão habilitadas no momento. Agente de Escrita virá na próxima fase.' },
      { status: 400 }
    )
  }

  // SSE streaming
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      // Identificadores das tool calls do round atual, pra persistir junto com o assistant
      let textoAcumulado = ''
      const toolCallsExec: Array<{ id: string; name: string; args: unknown; result: unknown }> = []

      try {
        send('user_message', { id: mensagemUsuario.id, conteudo: mensagemUsuario.conteudo })

        for await (const evt of rodarAgenteConsulta(historico, { userId })) {
          if (evt.tipo === 'token') {
            textoAcumulado += evt.delta
            send('token', { delta: evt.delta })
          } else if (evt.tipo === 'tool_call') {
            send('tool_call', { name: evt.name, args: evt.args })
            toolCallsExec.push({ id: '', name: evt.name, args: evt.args, result: null })
          } else if (evt.tipo === 'tool_result') {
            send('tool_result', { name: evt.name, result: evt.result })
            const pendente = [...toolCallsExec].reverse().find(t => t.name === evt.name && t.result === null)
            if (pendente) pendente.result = evt.result
          } else if (evt.tipo === 'final') {
            textoAcumulado = evt.text || textoAcumulado
            send('final', { text: textoAcumulado })
          }
        }

        // Persiste o turno do assistant (texto final + tool calls em JSON acessório)
        const assistantMsg = await prisma.assistenteMensagem.create({
          data: {
            conversaId,
            role: 'ASSISTANT',
            conteudo: textoAcumulado,
            toolCalls: toolCallsExec.length > 0
              ? ({ executadas: toolCallsExec } as Prisma.InputJsonValue)
              : undefined,
          },
        })

        send('done', { id: assistantMsg.id })
      } catch (e) {
        logger.error('Erro no streaming do Agente de Consulta:', e)
        send('error', { mensagem: e instanceof Error ? e.message : 'Erro desconhecido' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
