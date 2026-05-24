import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { withAuth } from '@/lib/middleware/auth'
import { invalidateProdutoCache } from '@/lib/cache'

const bulkPesoCubagemSchema = z.object({
  produtoIds: z.array(z.number().int().positive()).min(1),
  peso: z.number().min(0).nullable().optional(),
  cubagem: z.number().min(0).nullable().optional(),
})

/**
 * POST /api/produtos/bulk/peso-cubagem
 *
 * Atualiza o PESO PADRÃO e/ou CUBAGEM PADRÃO em N produtos do usuário.
 * (Diferente de /bulk/cubagens, que mexe nas configs por transportadora.)
 *
 * Body: { produtoIds, peso?, cubagem? }
 *   - Pelo menos um de peso/cubagem deve ser informado.
 *   - Valores são aplicados ao produto principal (campo Produto.peso / Produto.cubagem).
 */
export const POST = withAuth(async (req, { userId }) => {
  try {
    const body = await req.json()
    const validation = bulkPesoCubagemSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { erro: 'Dados inválidos', detalhes: validation.error.errors },
        { status: 400 }
      )
    }

    const { produtoIds, peso, cubagem } = validation.data

    if (peso == null && cubagem == null) {
      return NextResponse.json(
        { erro: 'Informe pelo menos peso ou cubagem' },
        { status: 400 }
      )
    }

    const dados: { peso?: number; cubagem?: number } = {}
    if (peso != null) dados.peso = peso
    if (cubagem != null) dados.cubagem = cubagem

    // updateMany com filtro de usuarioId garante ownership na mesma query
    const result = await prisma.produto.updateMany({
      where: { id: { in: produtoIds }, usuarioId: userId },
      data: dados,
    })

    if (result.count === 0) {
      return NextResponse.json(
        { erro: 'Nenhum dos produtos selecionados pertence ao usuário' },
        { status: 404 }
      )
    }

    invalidateProdutoCache(userId).catch(() => {})

    return NextResponse.json({
      success: true,
      aplicados: result.count,
      ignorados: produtoIds.length - result.count,
    })
  } catch (error) {
    logger.error('Erro ao aplicar peso/cubagem em lote:', error)
    return NextResponse.json(
      { erro: 'Erro ao aplicar peso/cubagem em lote' },
      { status: 500 }
    )
  }
})
