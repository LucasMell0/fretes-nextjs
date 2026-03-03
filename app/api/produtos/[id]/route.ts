import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const produtoSchema = z.object({
  nome: z.string().min(3).optional(),
  sku: z.string().min(1).optional(),
  peso: z.number().positive().optional(),
  cubagem: z.number().positive().optional(),
  crossDocking: z.number().int().min(0).optional(),
  estoque: z.number().int().min(0).optional(),
  ativo: z.boolean().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const produto = await prisma.produto.findUnique({
      where: { id: parseInt(params.id) },
      include: {
        cubagens: {
          include: {
            transportadora: true,
          },
        },
      },
    })

    if (!produto) {
      return NextResponse.json(
        { erro: 'Produto não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json(produto)
  } catch (error) {
    return NextResponse.json(
      { erro: 'Erro ao buscar produto' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const validation = produtoSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { erro: 'Dados inválidos', detalhes: validation.error.errors },
        { status: 400 }
      )
    }

    const produto = await prisma.produto.update({
      where: { id: parseInt(params.id) },
      data: validation.data,
    })

    return NextResponse.json(produto)
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { erro: 'SKU já existe' },
        { status: 409 }
      )
    }
    
    return NextResponse.json(
      { erro: 'Erro ao atualizar produto' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.produto.delete({
      where: { id: parseInt(params.id) },
    })

    return NextResponse.json({ sucesso: true })
  } catch (error) {
    return NextResponse.json(
      { erro: 'Erro ao deletar produto' },
      { status: 500 }
    )
  }
}
