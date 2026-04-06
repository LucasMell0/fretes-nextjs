import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/middleware/auth'

/**
 * GET /api/auditoria - Lista registros de auditoria do usuário
 */
export const GET = withAuth(async (req, { userId }) => {
  const { searchParams } = new URL(req.url)
  const tipo = searchParams.get('tipo')
  const status = searchParams.get('status')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = { usuarioId: userId }

  if (tipo) {
    where.tipo = tipo
  }

  if (status) {
    where.status = status
  }

  const [registros, total] = await Promise.all([
    prisma.auditoriaCotacao.findMany({
      where,
      include: {
        integracao: {
          select: {
            id: true,
            canal: {
              select: { nome: true, slug: true },
            },
          },
        },
      },
      orderBy: { criadoEm: 'desc' },
      skip,
      take: limit,
    }),
    prisma.auditoriaCotacao.count({ where }),
  ])

  return NextResponse.json({
    registros,
    total,
    pagina: page,
    totalPaginas: Math.ceil(total / limit),
  })
})

/**
 * PATCH /api/auditoria - Atualiza status de um registro
 */
export const PATCH = withAuth(async (req, { userId }) => {
  const body = await req.json()
  const { id, status } = body

  if (!id || !status || !['PENDENTE', 'RESOLVIDO'].includes(status)) {
    return NextResponse.json(
      { erro: 'ID e status (PENDENTE ou RESOLVIDO) são obrigatórios' },
      { status: 400 }
    )
  }

  const registro = await prisma.auditoriaCotacao.findFirst({
    where: { id, usuarioId: userId },
  })

  if (!registro) {
    return NextResponse.json(
      { erro: 'Registro não encontrado' },
      { status: 404 }
    )
  }

  const atualizado = await prisma.auditoriaCotacao.update({
    where: { id },
    data: {
      status,
      resolvidoEm: status === 'RESOLVIDO' ? new Date() : null,
    },
  })

  return NextResponse.json(atualizado)
})
