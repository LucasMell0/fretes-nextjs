import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const produtoSchema = z.object({
  nome: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  sku: z.string().min(1, 'SKU é obrigatório'),
  peso: z.number().positive('Peso deve ser positivo'),
  cubagem: z.number().positive('Cubagem deve ser positiva'),
  crossDocking: z.number().int().min(0, 'Cross-docking não pode ser negativo').optional().default(0),
  estoque: z.number().int().min(0, 'Estoque não pode ser negativo').optional().default(0),
  ativo: z.boolean().optional().default(true),
})

export async function GET() {
  try {
    const produtos = await prisma.produto.findMany({
      orderBy: { nome: 'asc' },
      include: {
        atributos: true,
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
    return NextResponse.json(
      { erro: 'Erro ao buscar produtos' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = produtoSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { erro: 'Dados inválidos', detalhes: validation.error.errors },
        { status: 400 }
      )
    }

    const produto = await prisma.produto.create({
      data: validation.data,
    })

    return NextResponse.json(produto, { status: 201 })
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { erro: 'SKU já existe' },
        { status: 409 }
      )
    }
    
    return NextResponse.json(
      { erro: 'Erro ao criar produto' },
      { status: 500 }
    )
  }
}
