import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const transportadoraSchema = z.object({
  nome: z.string().min(3).optional(),
  fatorCubagem: z.number().min(0).optional(),
  margemLucro: z.number().min(0).max(100).optional(),
  ativo: z.boolean().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const transportadora = await prisma.transportadora.findUnique({
      where: { id: parseInt(params.id) },
      include: {
        regioes: true,
        _count: { select: { regioes: true } },
      },
    })

    if (!transportadora) {
      return NextResponse.json(
        { erro: 'Transportadora não encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json(transportadora)
  } catch (error) {
    return NextResponse.json(
      { erro: 'Erro ao buscar transportadora' },
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
    const validation = transportadoraSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { erro: 'Dados inválidos', detalhes: validation.error.errors },
        { status: 400 }
      )
    }

    const transportadora = await prisma.transportadora.update({
      where: { id: parseInt(params.id) },
      data: validation.data,
    })

    return NextResponse.json(transportadora)
  } catch (error) {
    return NextResponse.json(
      { erro: 'Erro ao atualizar transportadora' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.transportadora.delete({
      where: { id: parseInt(params.id) },
    })

    return NextResponse.json({ sucesso: true })
  } catch (error) {
    return NextResponse.json(
      { erro: 'Erro ao deletar transportadora' },
      { status: 500 }
    )
  }
}
