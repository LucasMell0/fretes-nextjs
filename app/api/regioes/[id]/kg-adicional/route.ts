import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const kgAdicionalSchema = z.object({
  valorKgAdicional: z.number().min(0),
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const regiaoId = parseInt(params.id)
    const body = await request.json()

    const validation = kgAdicionalSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { erro: 'Dados inválidos', detalhes: validation.error.errors },
        { status: 400 }
      )
    }

    // Verificar se região existe
    const regiao = await prisma.transportadoraRegiao.findUnique({
      where: { id: regiaoId },
      include: { kgAdicional: true },
    })

    if (!regiao) {
      return NextResponse.json(
        { erro: 'Região não encontrada' },
        { status: 404 }
      )
    }

    let kgAdicional

    if (regiao.kgAdicional) {
      // Atualizar existente
      kgAdicional = await prisma.transportadoraRegiaoKgAdicional.update({
        where: { id: regiao.kgAdicional.id },
        data: validation.data,
      })
    } else {
      // Criar novo
      kgAdicional = await prisma.transportadoraRegiaoKgAdicional.create({
        data: {
          transportadoraRegiaoId: regiaoId,
          ...validation.data,
        },
      })
    }

    return NextResponse.json(kgAdicional)
  } catch (error) {
    console.error('Erro ao salvar KG adicional:', error)
    return NextResponse.json(
      { erro: 'Erro ao salvar KG adicional' },
      { status: 500 }
    )
  }
}
