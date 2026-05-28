import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { withAuth } from '@/lib/middleware/auth'
import { sanitizeTransform } from '@/lib/utils/sanitize'

const criarConversaSchema = z.object({
  agente: z.enum(['ESCRITA', 'CONSULTA']),
  titulo: z.string().min(1).max(200).transform(sanitizeTransform).optional(),
})

export const GET = withAuth(async (_req, { userId }) => {
  try {
    const conversas = await prisma.assistenteConversa.findMany({
      where: { usuarioId: userId },
      orderBy: { dataAtualizacao: 'desc' },
      select: {
        id: true,
        agente: true,
        titulo: true,
        dataCriacao: true,
        dataAtualizacao: true,
      },
    })
    return NextResponse.json(conversas)
  } catch (error) {
    logger.error('Erro ao listar conversas:', error)
    return NextResponse.json({ erro: 'Erro ao listar conversas' }, { status: 500 })
  }
})

export const POST = withAuth(async (req, { userId }) => {
  try {
    const body = await req.json()
    const validation = criarConversaSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { erro: 'Dados inválidos', detalhes: validation.error.errors },
        { status: 400 }
      )
    }

    const { agente, titulo } = validation.data
    const conversa = await prisma.assistenteConversa.create({
      data: {
        usuarioId: userId,
        agente,
        titulo: titulo || (agente === 'ESCRITA' ? 'Nova conversa de Escrita' : 'Nova conversa de Consulta'),
      },
    })
    return NextResponse.json(conversa, { status: 201 })
  } catch (error) {
    logger.error('Erro ao criar conversa:', error)
    return NextResponse.json({ erro: 'Erro ao criar conversa' }, { status: 500 })
  }
})
