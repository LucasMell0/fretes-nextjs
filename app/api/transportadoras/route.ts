import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const transportadoraSchema = z.object({
  nome: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  fatorCubagem: z.number().min(0, 'Fator de cubagem deve ser maior ou igual a zero'),
  margemLucro: z.number().min(0).max(100).optional().default(0),
  ativo: z.boolean().optional().default(true),
})

export async function GET() {
  try {
    const transportadoras = await prisma.transportadora.findMany({
      orderBy: { nome: 'asc' },
      include: {
        _count: {
          select: { regioes: true },
        },
      },
    })

    return NextResponse.json(transportadoras)
  } catch (error) {
    return NextResponse.json(
      { erro: 'Erro ao buscar transportadoras' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = transportadoraSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { erro: 'Dados inválidos', detalhes: validation.error.errors },
        { status: 400 }
      )
    }

    const transportadora = await prisma.transportadora.create({
      data: validation.data,
    })

    return NextResponse.json(transportadora, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { erro: 'Erro ao criar transportadora' },
      { status: 500 }
    )
  }
}
