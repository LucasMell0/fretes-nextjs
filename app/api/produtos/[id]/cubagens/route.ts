import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const cubagemSchema = z.object({
  transportadoraId: z.number().int().positive(),
  cubagem: z.number().min(0),
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const produtoId = parseInt(params.id)

    const produto = await prisma.produto.findUnique({
      where: { id: produtoId },
    })

    if (!produto) {
      return NextResponse.json(
        { erro: 'Produto não encontrado' },
        { status: 404 }
      )
    }

    const cubagens = await prisma.produtoTransportadoraCubagem.findMany({
      where: { produtoId },
      include: {
        transportadora: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
      orderBy: {
        transportadora: {
          nome: 'asc',
        },
      },
    })

    const transportadoras = await prisma.transportadora.findMany({
      where: { ativo: true },
      select: {
        id: true,
        nome: true,
      },
      orderBy: { nome: 'asc' },
    })

    return NextResponse.json({
      produto,
      cubagens,
      transportadoras,
    })
  } catch (error) {
    return NextResponse.json(
      { erro: 'Erro ao buscar cubagens' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const produtoId = parseInt(params.id)
    const body = await request.json()

    const validation = cubagemSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { erro: 'Dados inválidos', detalhes: validation.error.errors },
        { status: 400 }
      )
    }

    const { transportadoraId, cubagem } = validation.data

    // Verificar se já existe
    const existente = await prisma.produtoTransportadoraCubagem.findFirst({
      where: {
        produtoId,
        transportadoraId,
      },
    })

    if (existente) {
      // Atualizar
      const cubagemAtualizada = await prisma.produtoTransportadoraCubagem.update({
        where: { id: existente.id },
        data: { cubagem },
        include: {
          transportadora: true,
        },
      })
      return NextResponse.json(cubagemAtualizada)
    } else {
      // Criar
      const novaCubagem = await prisma.produtoTransportadoraCubagem.create({
        data: {
          produtoId,
          transportadoraId,
          cubagem,
        },
        include: {
          transportadora: true,
        },
      })
      return NextResponse.json(novaCubagem, { status: 201 })
    }
  } catch (error) {
    console.error('Erro ao salvar cubagem:', error)
    return NextResponse.json(
      { erro: 'Erro ao salvar cubagem' },
      { status: 500 }
    )
  }
}
