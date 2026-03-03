import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export const revalidate = 0

// Atualizar integração (toggle ativo, config, etc)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { erro: 'Não autenticado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { ativo, config, status } = body

    // Verificar se integração pertence ao usuário
    const integracaoExistente = await prisma.usuarioIntegracaoCanal.findFirst({
      where: {
        id: parseInt(params.id),
        usuarioId: parseInt(session.user.id),
      },
    })

    if (!integracaoExistente) {
      return NextResponse.json(
        { erro: 'Integração não encontrada' },
        { status: 404 }
      )
    }

    // Atualizar integração
    const integracao = await prisma.usuarioIntegracaoCanal.update({
      where: {
        id: parseInt(params.id),
      },
      data: {
        ...(typeof ativo === 'boolean' && { ativo }),
        ...(config && { config }),
        ...(status && { status }),
      },
      include: {
        canal: {
          select: {
            id: true,
            nome: true,
            slug: true,
            tipo: true,
            logoUrl: true,
            endpointPattern: true,
            metodosHttp: true,
          },
        },
      },
    })

    return NextResponse.json(integracao)
  } catch (error) {
    console.error('Erro ao atualizar integração:', error)
    return NextResponse.json(
      { erro: 'Erro ao atualizar integração' },
      { status: 500 }
    )
  }
}

// Deletar integração
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { erro: 'Não autenticado' },
        { status: 401 }
      )
    }

    // Verificar se integração pertence ao usuário
    const integracaoExistente = await prisma.usuarioIntegracaoCanal.findFirst({
      where: {
        id: parseInt(params.id),
        usuarioId: parseInt(session.user.id),
      },
    })

    if (!integracaoExistente) {
      return NextResponse.json(
        { erro: 'Integração não encontrada' },
        { status: 404 }
      )
    }

    // Deletar integração
    await prisma.usuarioIntegracaoCanal.delete({
      where: {
        id: parseInt(params.id),
      },
    })

    return NextResponse.json({ sucesso: true })
  } catch (error) {
    console.error('Erro ao deletar integração:', error)
    return NextResponse.json(
      { erro: 'Erro ao deletar integração' },
      { status: 500 }
    )
  }
}
