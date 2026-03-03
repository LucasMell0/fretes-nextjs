import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { verificarSobreposicaoFaixa } from '@/lib/validators/faixa-peso.validator'

const precoSchema = z.object({
  pesoInicial: z.number().min(0).optional(),
  pesoFinal: z.number().min(0).optional(),
  valor: z.number().min(0).optional(),
  prazo: z.number().int().min(0).optional(),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; precoId: string } }
) {
  try {
    const regiaoId = parseInt(params.id)
    const precoId = parseInt(params.precoId)
    const body = await request.json()

    const validation = precoSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { erro: 'Dados inválidos', detalhes: validation.error.errors },
        { status: 400 }
      )
    }

    // Verificar se preço pertence à região
    const preco = await prisma.transportadoraRegiaoPreco.findFirst({
      where: {
        id: precoId,
        transportadoraRegiaoId: regiaoId,
      },
    })

    if (!preco) {
      return NextResponse.json(
        { erro: 'Preço não encontrado' },
        { status: 404 }
      )
    }

    // Validar faixa de peso se ambos foram informados
    const pesoInicial = validation.data.pesoInicial ?? Number(preco.pesoInicial)
    const pesoFinal = validation.data.pesoFinal ?? Number(preco.pesoFinal)
    
    if (pesoFinal <= pesoInicial) {
      return NextResponse.json(
        { erro: 'Peso final deve ser maior que peso inicial' },
        { status: 400 }
      )
    }

    // Verificar sobreposição com outras faixas (excluindo a atual)
    const verificacao = await verificarSobreposicaoFaixa(
      regiaoId,
      pesoInicial,
      pesoFinal,
      precoId
    )

    if (verificacao.sobrepoe) {
      return NextResponse.json(
        { erro: verificacao.mensagem || 'Faixa de peso se sobrepõe com uma faixa existente' },
        { status: 400 }
      )
    }

    const precoAtualizado = await prisma.transportadoraRegiaoPreco.update({
      where: { id: precoId },
      data: validation.data,
    })

    return NextResponse.json(precoAtualizado)
  } catch (error) {
    return NextResponse.json(
      { erro: 'Erro ao atualizar preço' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; precoId: string } }
) {
  try {
    const regiaoId = parseInt(params.id)
    const precoId = parseInt(params.precoId)

    // Verificar se preço pertence à região
    const preco = await prisma.transportadoraRegiaoPreco.findFirst({
      where: {
        id: precoId,
        transportadoraRegiaoId: regiaoId,
      },
    })

    if (!preco) {
      return NextResponse.json(
        { erro: 'Preço não encontrado' },
        { status: 404 }
      )
    }

    await prisma.transportadoraRegiaoPreco.delete({
      where: { id: precoId },
    })

    return NextResponse.json({ sucesso: true })
  } catch (error) {
    return NextResponse.json(
      { erro: 'Erro ao excluir preço' },
      { status: 500 }
    )
  }
}
