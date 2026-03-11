import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { withAuth } from '@/lib/middleware/auth'

export const revalidate = 60

export const GET = withAuth(async (req, { userId }) => {
  try {
    const canais = await prisma.canalIntegracao.findMany({
      where: {
        ativo: true,
      },
      orderBy: [
        { tipo: 'asc' },
        { nome: 'asc' },
      ],
      select: {
        id: true,
        nome: true,
        slug: true,
        tipo: true,
        logoUrl: true,
        endpointPattern: true,
        metodosHttp: true,
        payloadExemplo: true,
        responseExemplo: true,
      },
    })

    return NextResponse.json(canais)
  } catch (error) {
    logger.error('Erro ao buscar canais:', error)
    return NextResponse.json(
      { erro: 'Erro ao buscar canais' },
      { status: 500 }
    )
  }
})
