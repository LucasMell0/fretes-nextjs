import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { withAuth } from '@/lib/middleware/auth'
import crypto from 'crypto'

export const revalidate = 0

// Listar integrações do usuário
export const GET = withAuth(async (req, { userId }) => {
  try {
    const integracoes = await prisma.usuarioIntegracaoCanal.findMany({
      where: { usuarioId: userId },
      select: {
        id: true,
        canalId: true,
        ativo: true,
        status: true,
        token: true,
        accessToken: true,
        tokenExpiresAt: true,
        ultimaRequisicao: true,
        totalRequisicoes: true,
        criadoEm: true,
        atualizadoEm: true,
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

    // Não expor o token criptografado ao frontend — só sinalizar presença
    const sanitized = integracoes.map(i => ({
      ...i,
      accessToken: i.accessToken ? true : null,
    }))

    return NextResponse.json(sanitized)
  } catch (error) {
    logger.error('Erro ao buscar integrações:', error)
    return NextResponse.json(
      { erro: 'Erro ao buscar integrações' },
      { status: 500 }
    )
  }
})

// Criar nova integração (ativar canal)
export const POST = withAuth(async (req, { userId }) => {
  try {
    const body = await req.json()
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

    // Gerar token único
    const token = crypto.randomBytes(32).toString('hex')

    // Criar integração
    const integracao = await prisma.usuarioIntegracaoCanal.create({
      data: {
        usuarioId: userId,
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

    return NextResponse.json({ integracao }, { status: 201 })
  } catch (error) {
    logger.error('Erro ao criar integração:', error)
    return NextResponse.json(
      { erro: 'Erro ao criar integração' },
      { status: 500 }
    )
  }
})
