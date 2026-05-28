import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { withAuthTyped } from '@/lib/middleware/auth'
import { parseRouteId } from '@/lib/utils/parse'
import { sanitizeTransform } from '@/lib/utils/sanitize'

interface RouteParams {
  id: string
}

const renomearSchema = z.object({
  titulo: z.string().min(1).max(200).transform(sanitizeTransform),
})

export const GET = withAuthTyped<RouteParams>(async (_req, { userId }, params) => {
  try {
    const conversaId = parseRouteId(params!.id)
    const conversa = await prisma.assistenteConversa.findFirst({
      where: { id: conversaId, usuarioId: userId },
      include: {
        mensagens: { orderBy: { dataCriacao: 'asc' } },
      },
    })
    if (!conversa) {
      return NextResponse.json({ erro: 'Conversa não encontrada' }, { status: 404 })
    }
    return NextResponse.json(conversa)
  } catch (error) {
    logger.error('Erro ao buscar conversa:', error)
    return NextResponse.json({ erro: 'Erro ao buscar conversa' }, { status: 500 })
  }
})

export const PATCH = withAuthTyped<RouteParams>(async (req, { userId }, params) => {
  try {
    const conversaId = parseRouteId(params!.id)
    const body = await req.json()
    const validation = renomearSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { erro: 'Dados inválidos', detalhes: validation.error.errors },
        { status: 400 }
      )
    }

    const existente = await prisma.assistenteConversa.findFirst({
      where: { id: conversaId, usuarioId: userId },
      select: { id: true },
    })
    if (!existente) {
      return NextResponse.json({ erro: 'Conversa não encontrada' }, { status: 404 })
    }

    const conversa = await prisma.assistenteConversa.update({
      where: { id: conversaId },
      data: { titulo: validation.data.titulo },
    })
    return NextResponse.json(conversa)
  } catch (error) {
    logger.error('Erro ao renomear conversa:', error)
    return NextResponse.json({ erro: 'Erro ao renomear conversa' }, { status: 500 })
  }
})

export const DELETE = withAuthTyped<RouteParams>(async (_req, { userId }, params) => {
  try {
    const conversaId = parseRouteId(params!.id)
    const existente = await prisma.assistenteConversa.findFirst({
      where: { id: conversaId, usuarioId: userId },
      select: { id: true },
    })
    if (!existente) {
      return NextResponse.json({ erro: 'Conversa não encontrada' }, { status: 404 })
    }
    await prisma.assistenteConversa.delete({ where: { id: conversaId } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    logger.error('Erro ao excluir conversa:', error)
    return NextResponse.json({ erro: 'Erro ao excluir conversa' }, { status: 500 })
  }
})
