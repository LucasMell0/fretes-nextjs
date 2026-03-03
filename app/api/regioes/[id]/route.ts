import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const regiaoSchema = z.object({
  nome: z.string().min(3).optional(),
  cepInicio: z.string().length(8).optional(),
  cepFim: z.string().length(8).optional(),
  transportadoraId: z.number().int().positive().optional(),
  ativo: z.boolean().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const regiao = await prisma.transportadoraRegiao.findUnique({
      where: { id: parseInt(params.id) },
      include: {
        transportadora: true,
        precos: {
          orderBy: { pesoInicial: 'asc' },
        },
        _count: {
          select: {
            precos: true,
          },
        },
      },
    })

    if (!regiao) {
      return NextResponse.json(
        { erro: 'Região não encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json(regiao)
  } catch (error) {
    return NextResponse.json(
      { erro: 'Erro ao buscar região' },
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
    const validation = regiaoSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { erro: 'Dados inválidos', detalhes: validation.error.errors },
        { status: 400 }
      )
    }

    const regiao = await prisma.transportadoraRegiao.update({
      where: { id: parseInt(params.id) },
      data: validation.data,
      include: {
        transportadora: true,
      },
    })

    return NextResponse.json(regiao)
  } catch (error) {
    return NextResponse.json(
      { erro: 'Erro ao atualizar região' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.transportadoraRegiao.delete({
      where: { id: parseInt(params.id) },
    })

    return NextResponse.json({ sucesso: true })
  } catch (error) {
    return NextResponse.json(
      { erro: 'Erro ao deletar região' },
      { status: 500 }
    )
  }
}
