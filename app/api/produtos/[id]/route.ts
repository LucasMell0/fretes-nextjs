import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { parseRouteId } from '@/lib/utils/parse'
import { verifyOwnership } from '@/lib/utils/ownership'
import { withAuthTyped } from '@/lib/middleware/auth'

const produtoSchema = z.object({
  nome: z.string().min(3).optional(),
  sku: z.string().min(1).optional(),
  peso: z.number().positive().optional(),
  cubagem: z.number().positive().optional(),
  crossDocking: z.number().int().min(0).optional(),
  estoque: z.number().int().min(0).optional(),
  ativo: z.boolean().optional(),
  usarDadosPaiParaVariacoes: z.boolean().optional(),
})

interface RouteParams {
  id: string
}

export const GET = withAuthTyped<RouteParams>(async (req, { userId }, params) => {
  try {
    const produtoId = parseRouteId(params!.id)

    const produto = await verifyOwnership<any>(
      prisma.produto,
      produtoId,
      userId,
      {
        cubagens: {
          include: {
            transportadora: true,
          },
        },
      }
    )

    if (!produto) {
      return NextResponse.json(
        { erro: 'Produto não encontrado ou sem permissão' },
        { status: 404 }
      )
    }

    return NextResponse.json(produto)
  } catch (error) {
    logger.error('Erro ao buscar produto:', error)
    return NextResponse.json(
      { erro: 'Erro ao buscar produto' },
      { status: 500 }
    )
  }
})

export const PUT = withAuthTyped<RouteParams>(async (req, { userId }, params) => {
  try {
    const produtoId = parseRouteId(params!.id)
    
    const produto = await verifyOwnership(
      prisma.produto,
      produtoId,
      userId
    )

    if (!produto) {
      return NextResponse.json(
        { erro: 'Produto não encontrado ou sem permissão' },
        { status: 404 }
      )
    }

    const body = await req.json()
    const validation = produtoSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { erro: 'Dados inválidos', detalhes: validation.error.errors },
        { status: 400 }
      )
    }

    const updatedProduto = await prisma.produto.update({
      where: { id: produtoId },
      data: validation.data,
    })

    return NextResponse.json(updatedProduto)
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { erro: 'SKU já existe' },
        { status: 409 }
      )
    }
    
    logger.error('Erro ao atualizar produto:', error)
    return NextResponse.json(
      { erro: 'Erro ao atualizar produto' },
      { status: 500 }
    )
  }
})

export const DELETE = withAuthTyped<RouteParams>(async (req, { userId }, params) => {
  try {
    const produtoId = parseRouteId(params!.id)

    const produto = await verifyOwnership(
      prisma.produto,
      produtoId,
      userId
    )

    if (!produto) {
      return NextResponse.json(
        { erro: 'Produto não encontrado ou sem permissão' },
        { status: 404 }
      )
    }

    await prisma.produto.delete({
      where: { id: produtoId }
    })

    return NextResponse.json({ sucesso: true })
  } catch (error) {
    logger.error('Erro ao deletar produto:', error)
    return NextResponse.json(
      { erro: 'Erro ao deletar produto' },
      { status: 500 }
    )
  }
})
