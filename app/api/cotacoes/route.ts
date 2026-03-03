import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// OTIMIZADO: Cache de 30 segundos
export const revalidate = 30

export async function GET() {
  try {
    const cotacoes = await prisma.cotacaoLog.findMany({
      orderBy: {
        dataCotacao: 'desc',
      },
      take: 100,
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
    return NextResponse.json(
      { erro: 'Erro ao buscar cotações' },
      { status: 500 }
    )
  }
}
