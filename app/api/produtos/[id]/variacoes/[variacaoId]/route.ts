import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { withAuthTyped } from '@/lib/middleware/auth'
import { parseRouteId } from '@/lib/utils/parse'
import { verifyOwnership } from '@/lib/utils/ownership'

interface RouteParams {
  id: string
  variacaoId: string
}

const atualizarVariacaoSchema = z.object({
  peso: z.number().min(0).optional(),
  cubagem: z.number().min(0).optional(),
  crossDocking: z.number().int().min(0).optional(),
  estoque: z.number().int().min(0).optional(),
})

export const PUT = withAuthTyped<RouteParams>(async (req, { userId }, params) => {
  try {
    const produtoPaiId = parseRouteId(params!.id)
    const variacaoId = parseRouteId(params!.variacaoId)
    const body = await req.json()

    const produtoPai = await verifyOwnership(
      prisma.produto,
      produtoPaiId,
      userId
    )

    if (!produtoPai) {
      return NextResponse.json(
        { erro: 'Produto pai não encontrado ou sem permissão' },
        { status: 404 }
      )
    }

    const variacao = await prisma.produto.findFirst({
      where: {
        id: variacaoId,
        produtoPaiId: produtoPaiId,
      }
    })

    if (!variacao) {
      return NextResponse.json(
        { erro: 'Variação não encontrada ou sem permissão' },
        { status: 404 }
      )
    }

    const validation = atualizarVariacaoSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { erro: 'Dados inválidos', detalhes: validation.error.errors },
        { status: 400 }
      )
    }

    // Atualizar variação
    const variacaoAtualizada = await prisma.produto.update({
      where: { id: variacaoId },
      data: validation.data,
      include: {
        atributos: true,
      },
    })

    return NextResponse.json(variacaoAtualizada)
  } catch (error) {
    logger.error('Erro ao atualizar variação:', error)
    return NextResponse.json(
      { erro: 'Erro ao atualizar variação' },
      { status: 500 }
    )
  }
})

export const DELETE = withAuthTyped<RouteParams>(async (req, { userId }, params) => {
  try {
    const produtoPaiId = parseRouteId(params!.id)
    const variacaoId = parseRouteId(params!.variacaoId)

    const produtoPai = await verifyOwnership(
      prisma.produto,
      produtoPaiId,
      userId
    )

    // Verificar ownership da variação
    const variacao = await prisma.produto.findFirst({
      where: {
        id: variacaoId,
        produtoPaiId: produtoPaiId,
      }
    })

    if (!variacao) {
      return NextResponse.json(
        { erro: 'Variação não encontrada ou sem permissão' },
        { status: 404 }
      )
    }

    // Excluir variação (cascade vai deletar os atributos)
    await prisma.produto.delete({
      where: { id: variacao.id },
    })

    return NextResponse.json({ sucesso: true })
  } catch (error) {
    logger.error('Erro ao excluir variação:', error)
    return NextResponse.json(
      { erro: 'Erro ao excluir variação' },
      { status: 500 }
    )
  }
})
