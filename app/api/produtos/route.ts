import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { sanitizeTransform, sanitizeSKUTransform } from '@/lib/utils/sanitize'
import { withAuth } from '@/lib/middleware/auth'

const produtoSchema = z.object({
  nome: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres').transform(sanitizeTransform),
  sku: z.string().min(1, 'SKU é obrigatório').transform(sanitizeSKUTransform),
  peso: z.number().positive('Peso deve ser positivo'),
  cubagem: z.number().positive('Cubagem deve ser positiva'),
  crossDocking: z.number().int().min(0, 'Cross-docking não pode ser negativo').optional().default(0),
  estoque: z.number().int().min(0, 'Estoque não pode ser negativo').optional().default(0),
  ativo: z.boolean().optional().default(true),
  usarDadosPaiParaVariacoes: z.boolean().optional().default(false),
})

export const GET = withAuth(async (req, { userId }) => {
  try {
    const produtos = await prisma.produto.findMany({
      where: {
        usuarioId: userId
      },
      orderBy: { nome: 'asc' },
      include: {
        atributos: true,
        produtoPai: {
          select: {
            id: true,
            nome: true,
            peso: true,
            cubagem: true,
            usarDadosPaiParaVariacoes: true,
          },
        },
        variacoes: {
          include: {
            atributos: true,
          },
        },
        _count: {
          select: { 
            cubagens: true,
            variacoes: true,
          },
        },
      },
    })

    return NextResponse.json(produtos)
  } catch (error) {
    logger.error('Erro ao buscar produtos:', error)
    return NextResponse.json(
      { erro: 'Erro ao buscar produtos' },
      { status: 500 }
    )
  }
})

export const POST = withAuth(async (req, { userId }) => {
  try {
    const body = await req.json()
    const validation = produtoSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { erro: 'Dados inválidos', detalhes: validation.error.errors },
        { status: 400 }
      )
    }

    const produto = await prisma.produto.create({
      data: {
        ...validation.data,
        usuarioId: userId
      }
    })

    return NextResponse.json(produto, { status: 201 })
  } catch (error: unknown) {
    if (error instanceof Error && (error as Error & { code?: string }).code === 'P2002') {
      return NextResponse.json(
        { erro: 'SKU já existe' },
        { status: 409 }
      )
    }
    
    logger.error('Erro ao criar produto:', error)
    return NextResponse.json(
      { erro: 'Erro ao criar produto' },
      { status: 500 }
    )
  }
})
