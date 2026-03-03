import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

// OTIMIZADO: Cache de 30 segundos
export const revalidate = 30

const regiaoSchema = z.object({
  nome: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  cepInicio: z.string().length(8, 'CEP deve ter 8 dígitos'),
  cepFim: z.string().length(8, 'CEP deve ter 8 dígitos'),
  transportadoraId: z.number().int().positive('Transportadora é obrigatória'),
  ativo: z.boolean().optional().default(true),
})

export async function GET() {
  try {
    const regioes = await prisma.transportadoraRegiao.findMany({
      orderBy: [
        { transportadora: { nome: 'asc' } },
        { nome: 'asc' },
      ],
      include: {
        transportadora: {
          select: {
            id: true,
            nome: true,
          },
        },
        _count: {
          select: {
            precos: true,
          },
        },
      },
    })

    return NextResponse.json(regioes)
  } catch (error) {
    return NextResponse.json(
      { erro: 'Erro ao buscar regiões' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = regiaoSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { erro: 'Dados inválidos', detalhes: validation.error.errors },
        { status: 400 }
      )
    }

    const regiao = await prisma.transportadoraRegiao.create({
      data: validation.data,
      include: {
        transportadora: true,
      },
    })

    return NextResponse.json(regiao, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { erro: 'Erro ao criar região' },
      { status: 500 }
    )
  }
}
