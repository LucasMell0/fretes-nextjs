import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { withAuth } from '@/lib/middleware/auth'

// OTIMIZADO: Cache de 30 segundos
export const revalidate = 30

export const GET = withAuth(async (req, { userId }) => {
  try {

    const cotacoes = await prisma.cotacaoLog.findMany({
      where: {
        usuarioId: userId,
      },
      orderBy: {
        dataCotacao: 'desc',
      },
      take: 500, // Aumentado de 100 para 500
      include: {
        transportadora: {
          select: {
            nome: true,
          },
        },
      },
    })

    return NextResponse.json(
      cotacoes.map(c => ({
        ...c,
        melhorTransportadora: c.transportadora,
      }))
    )
  } catch (error) {
    logger.error('Erro ao buscar cotações:', error)
    return NextResponse.json(
      { erro: 'Erro ao buscar cotações' },
      { status: 500 }
    )
  }
})
