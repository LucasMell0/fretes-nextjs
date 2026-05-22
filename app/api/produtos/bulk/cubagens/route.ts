import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { withAuth } from '@/lib/middleware/auth'
import { invalidateProdutoCache } from '@/lib/cache'
import { verifyTransportadoraOwnership } from '@/lib/validators/relationship.validator'

const bulkCubagemSchema = z.object({
  produtoIds: z.array(z.number().int().positive()).min(1),
  transportadoraId: z.number().int().positive(),
  cubagem: z.number().min(0).nullable().optional(),
  peso: z.number().min(0).nullable().optional(),
})

/**
 * POST /api/produtos/bulk/cubagens
 *
 * Aplica peso/cubagem para uma transportadora em N produtos de uma vez.
 * Faz upsert: se o produto já tem config pra essa transportadora, atualiza;
 * senão, cria.
 *
 * Body: { produtoIds, transportadoraId, peso?, cubagem? }
 */
export const POST = withAuth(async (req, { userId }) => {
  try {
    const body = await req.json()
    const validation = bulkCubagemSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { erro: 'Dados inválidos', detalhes: validation.error.errors },
        { status: 400 }
      )
    }

    const { produtoIds, transportadoraId, cubagem, peso } = validation.data

    if (cubagem == null && peso == null) {
      return NextResponse.json(
        { erro: 'Informe pelo menos cubagem ou peso' },
        { status: 400 }
      )
    }

    // Valida ownership da transportadora
    const transportadoraValida = await verifyTransportadoraOwnership(transportadoraId, userId)
    if (!transportadoraValida) {
      return NextResponse.json(
        { erro: 'Transportadora não encontrada ou sem permissão' },
        { status: 404 }
      )
    }

    // Filtra apenas produtos do usuário (ignora IDs que não pertencem ao tenant)
    const produtosValidos = await prisma.produto.findMany({
      where: { id: { in: produtoIds }, usuarioId: userId },
      select: { id: true },
    })
    const idsValidos = produtosValidos.map(p => p.id)

    if (idsValidos.length === 0) {
      return NextResponse.json(
        { erro: 'Nenhum dos produtos selecionados pertence ao usuário' },
        { status: 404 }
      )
    }

    const dados: Record<string, unknown> = {}
    if (cubagem != null) dados.cubagem = cubagem
    if (peso != null) dados.peso = peso

    // Upsert em transação
    const result = await prisma.$transaction(
      idsValidos.map(produtoId =>
        prisma.produtoTransportadoraCubagem.upsert({
          where: { produtoId_transportadoraId: { produtoId, transportadoraId } },
          create: { produtoId, transportadoraId, ...dados },
          update: dados,
        })
      )
    )

    invalidateProdutoCache(userId)
    return NextResponse.json({
      success: true,
      aplicados: result.length,
      ignorados: produtoIds.length - idsValidos.length,
    })
  } catch (error) {
    logger.error('Erro ao aplicar cubagens em lote:', error)
    return NextResponse.json(
      { erro: 'Erro ao aplicar cubagens em lote' },
      { status: 500 }
    )
  }
})
