import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { withAuthTyped } from '@/lib/middleware/auth'
import { parseRouteId } from '@/lib/utils/parse'
import { verifyOwnership } from '@/lib/utils/ownership'

export const revalidate = 0

// Atualizar integração (toggle ativo, config, etc)
interface RouteParams {
  id: string
}

export const PATCH = withAuthTyped<RouteParams>(async (req, { userId }, params) => {
  try {
    const integracaoId = parseRouteId(params!.id)
    const body = await req.json()
    const { ativo, config, status } = body

    // Verificar se integração pertence ao usuário
    const integracaoExistente = await verifyOwnership(
      prisma.usuarioIntegracaoCanal,
      integracaoId,
      userId
    )

    if (!integracaoExistente) {
      return NextResponse.json(
        { erro: 'Integração não encontrada' },
        { status: 404 }
      )
    }

    // Atualizar integração
    const integracao = await prisma.usuarioIntegracaoCanal.update({
      where: {
        id: integracaoId,
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
    logger.error('Erro ao atualizar integração:', error)
    return NextResponse.json(
      { erro: 'Erro ao atualizar integração' },
      { status: 500 }
    )
  }
})

// Deletar integração
export const DELETE = withAuthTyped<RouteParams>(async (req, { userId }, params) => {
  try {
    const integracaoId = parseRouteId(params!.id)

    // Verificar se integração pertence ao usuário
    const integracaoExistente = await verifyOwnership(
      prisma.usuarioIntegracaoCanal,
      integracaoId,
      userId
    )

    if (!integracaoExistente) {
      return NextResponse.json(
        { erro: 'Integração não encontrada' },
        { status: 404 }
      )
    }

    // Deletar integração
    await prisma.usuarioIntegracaoCanal.delete({
      where: {
        id: integracaoId,
      },
    })

    return NextResponse.json({ sucesso: true })
  } catch (error) {
    logger.error('Erro ao deletar integração:', error)
    return NextResponse.json(
      { erro: 'Erro ao deletar integração' },
      { status: 500 }
    )
  }
})
