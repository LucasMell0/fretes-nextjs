import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const atualizarVariacaoSchema = z.object({
  peso: z.number().min(0).optional(),
  cubagem: z.number().min(0).optional(),
  crossDocking: z.number().int().min(0).optional(),
  estoque: z.number().int().min(0).optional(),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; variacaoId: string } }
) {
  try {
    const produtoPaiId = parseInt(params.id)
    const variacaoId = parseInt(params.variacaoId)
    const body = await request.json()

    const validation = atualizarVariacaoSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { erro: 'Dados inválidos', detalhes: validation.error.errors },
        { status: 400 }
      )
    }

    // Verificar se a variação pertence ao produto pai
    const variacao = await prisma.produto.findFirst({
      where: {
        id: variacaoId,
        produtoPaiId: produtoPaiId,
      },
    })

    if (!variacao) {
      return NextResponse.json(
        { erro: 'Variação não encontrada' },
        { status: 404 }
      )
    }

    // Atualizar variação
    const variacaoAtualizada = await prisma.produto.update({
      where: { id: variacaoId },
      data: validation.data,
      include: {
        atributos: true,
      },
    })

    return NextResponse.json(variacaoAtualizada)
  } catch (error) {
    return NextResponse.json(
      { erro: 'Erro ao atualizar variação' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; variacaoId: string } }
) {
  try {
    const produtoPaiId = parseInt(params.id)
    const variacaoId = parseInt(params.variacaoId)

    // Verificar se a variação pertence ao produto pai
    const variacao = await prisma.produto.findFirst({
      where: {
        id: variacaoId,
        produtoPaiId: produtoPaiId,
      },
    })

    if (!variacao) {
      return NextResponse.json(
        { erro: 'Variação não encontrada' },
        { status: 404 }
      )
    }

    // Excluir variação (cascade vai deletar os atributos)
    await prisma.produto.delete({
      where: { id: variacaoId },
    })

    return NextResponse.json({ sucesso: true })
  } catch (error) {
    return NextResponse.json(
      { erro: 'Erro ao excluir variação' },
      { status: 500 }
    )
  }
}
