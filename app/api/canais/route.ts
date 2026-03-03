import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const revalidate = 60

export async function GET() {
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
    console.error('Erro ao buscar canais:', error)
    return NextResponse.json(
      { erro: 'Erro ao buscar canais de integração' },
      { status: 500 }
    )
  }
}
