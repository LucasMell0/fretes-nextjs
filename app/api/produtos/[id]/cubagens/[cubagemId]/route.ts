import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; cubagemId: string } }
) {
  try {
    const produtoId = parseInt(params.id)
    const cubagemId = parseInt(params.cubagemId)

    // Verificar se a cubagem pertence ao produto
    const cubagem = await prisma.produtoTransportadoraCubagem.findFirst({
      where: {
        id: cubagemId,
        produtoId,
      },
    })

    if (!cubagem) {
      return NextResponse.json(
        { erro: 'Cubagem não encontrada' },
        { status: 404 }
      )
    }

    await prisma.produtoTransportadoraCubagem.delete({
      where: { id: cubagemId },
    })

    return NextResponse.json({ sucesso: true })
  } catch (error) {
    return NextResponse.json(
      { erro: 'Erro ao excluir cubagem' },
      { status: 500 }
    )
  }
}
