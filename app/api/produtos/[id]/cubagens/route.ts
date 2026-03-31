import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { withAuthTyped } from '@/lib/middleware/auth'
import { parseRouteId } from '@/lib/utils/parse'
import { verifyOwnership } from '@/lib/utils/ownership'
import { verifyTransportadoraOwnership } from '@/lib/validators/relationship.validator'

interface RouteParams {
  id: string
}

const cubagemSchema = z.object({
  transportadoraId: z.number().int().positive(),
  cubagem: z.number().min(0),
})

export const GET = withAuthTyped<RouteParams>(async (req, { userId }, params) => {
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

    const cubagens = await prisma.produtoTransportadoraCubagem.findMany({
      where: { produtoId },
      include: {
        transportadora: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
      orderBy: {
        transportadora: {
          nome: 'asc',
        },
      },
    })

    const transportadoras = await prisma.transportadora.findMany({
      where: {
        ativo: true,
        usuarioId: userId,
      },
      select: {
        id: true,
        nome: true,
      },
      orderBy: { nome: 'asc' },
    })

    return NextResponse.json({
      produto,
      transportadoras,
      cubagens,
    })
  } catch (error) {
    logger.error('Erro ao buscar cubagens:', error)
    return NextResponse.json(
      { erro: 'Erro ao buscar cubagens' },
      { status: 500 }
    )
  }
})

export const POST = withAuthTyped<RouteParams>(async (req, { userId }, params) => {
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

    const validation = cubagemSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { erro: 'Dados inválidos', detalhes: validation.error.errors },
        { status: 400 }
      )
    }

    const { transportadoraId, cubagem } = validation.data

    // Verificar se transportadora pertence ao usuário
    const transportadoraValida = await verifyTransportadoraOwnership(
      transportadoraId,
      userId
    )

    if (!transportadoraValida) {
      return NextResponse.json(
        { erro: 'Transportadora não encontrada ou sem permissão' },
        { status: 404 }
      )
    }

    // Verificar se já existe
    const existente = await prisma.produtoTransportadoraCubagem.findFirst({
      where: {
        produtoId,
        transportadoraId,
      },
    })

    if (existente) {
      // Atualizar
      const cubagemAtualizada = await prisma.produtoTransportadoraCubagem.update({
        where: { id: existente.id },
        data: { cubagem },
        include: {
          transportadora: true,
        },
      })
      return NextResponse.json(cubagemAtualizada)
    } else {
      // Criar
      const novaCubagem = await prisma.produtoTransportadoraCubagem.create({
        data: {
          produtoId,
          transportadoraId,
          cubagem,
        },
        include: {
          transportadora: true,
        },
      })
      return NextResponse.json(novaCubagem, { status: 201 })
    }
  } catch (error) {
    logger.error('Erro ao salvar cubagem:', error)
    return NextResponse.json(
      { erro: 'Erro ao salvar cubagem' },
      { status: 500 }
    )
  }
})
