import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import crypto from 'crypto'

export const revalidate = 0

// Listar integrações do usuário
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { erro: 'Não autenticado' },
        { status: 401 }
      )
    }

    const integracoes = await prisma.usuarioIntegracaoCanal.findMany({
      where: {
        usuarioId: parseInt(session.user.id),
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
        _count: {
          select: {
            logs: true,
          },
        },
      },
      orderBy: {
        criadoEm: 'desc',
      },
    })

    return NextResponse.json(integracoes)
  } catch (error) {
    console.error('Erro ao buscar integrações:', error)
    return NextResponse.json(
      { erro: 'Erro ao buscar integrações' },
      { status: 500 }
    )
  }
}

// Criar nova integração (ativar canal)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { erro: 'Não autenticado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { canalId, config } = body

    if (!canalId) {
      return NextResponse.json(
        { erro: 'Canal ID é obrigatório' },
        { status: 400 }
      )
    }

    // Verificar se canal existe
    const canal = await prisma.canalIntegracao.findUnique({
      where: { id: canalId },
    })

    if (!canal) {
      return NextResponse.json(
        { erro: 'Canal não encontrado' },
        { status: 404 }
      )
    }

    // Verificar se já existe integração
    const integracaoExistente = await prisma.usuarioIntegracaoCanal.findUnique({
      where: {
        usuarioId_canalId: {
          usuarioId: parseInt(session.user.id),
          canalId: canalId,
        },
      },
    })

    if (integracaoExistente) {
      return NextResponse.json(
        { erro: 'Integração já existe para este canal' },
        { status: 409 }
      )
    }

    // Gerar token único
    const token = crypto.randomBytes(32).toString('hex')

    // Criar integração
    const integracao = await prisma.usuarioIntegracaoCanal.create({
      data: {
        usuarioId: parseInt(session.user.id),
        canalId: canalId,
        token: token,
        config: config || {},
        ativo: true,
        status: 'ativo',
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

    return NextResponse.json(integracao, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar integração:', error)
    return NextResponse.json(
      { erro: 'Erro ao criar integração' },
      { status: 500 }
    )
  }
}
