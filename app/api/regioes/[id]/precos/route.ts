import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { verificarSobreposicaoFaixa } from '@/lib/validators/faixa-peso.validator'

const precoSchema = z.object({
  pesoInicial: z.number().min(0),
  pesoFinal: z.number().min(0),
  valor: z.number().min(0),
  prazo: z.number().int().min(0),
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const regiaoId = parseInt(params.id)

    const regiao = await prisma.transportadoraRegiao.findUnique({
      where: { id: regiaoId },
      include: {
        transportadora: true,
        precos: {
          orderBy: { pesoInicial: 'asc' },
        },
        kgAdicional: true,
      },
    })

    if (!regiao) {
      return NextResponse.json(
        { erro: 'Região não encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      regiao,
      precos: regiao.precos,
      kgAdicional: regiao.kgAdicional,
    })
  } catch (error) {
    return NextResponse.json(
      { erro: 'Erro ao buscar preços' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const regiaoId = parseInt(params.id)
    const body = await request.json()

    const validation = precoSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { erro: 'Dados inválidos', detalhes: validation.error.errors },
        { status: 400 }
      )
    }

    // Verificar se região existe
    const regiao = await prisma.transportadoraRegiao.findUnique({
      where: { id: regiaoId },
    })

    if (!regiao) {
      return NextResponse.json(
        { erro: 'Região não encontrada' },
        { status: 404 }
      )
    }

    // Validar faixa de peso
    if (validation.data.pesoFinal <= validation.data.pesoInicial) {
      return NextResponse.json(
        { erro: 'Peso final deve ser maior que peso inicial' },
        { status: 400 }
      )
    }

    // Verificar sobreposição com faixas existentes
    const verificacao = await verificarSobreposicaoFaixa(
      regiaoId,
      validation.data.pesoInicial,
      validation.data.pesoFinal
    )

    if (verificacao.sobrepoe) {
      return NextResponse.json(
        { erro: verificacao.mensagem || 'Faixa de peso se sobrepõe com uma faixa existente' },
        { status: 400 }
      )
    }

    // Criar faixa de preço
    const preco = await prisma.transportadoraRegiaoPreco.create({
      data: {
        transportadoraRegiaoId: regiaoId,
        ...validation.data,
      },
    })

    return NextResponse.json(preco, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar preço:', error)
    return NextResponse.json(
      { erro: 'Erro ao criar preço' },
      { status: 500 }
    )
  }
}
