import { NextResponse } from 'next/server'
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

  // Counts globais (ignoram filtro de status pra montar os cards)
  const baseWhere: Record<string, unknown> = { usuarioId: userId }
  if (tipo) baseWhere.tipo = tipo

  const [registros, total, totalPendentes, totalResolvidos] = await Promise.all([
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
    prisma.auditoriaCotacao.count({ where: { ...baseWhere, status: 'PENDENTE' } }),
    prisma.auditoriaCotacao.count({ where: { ...baseWhere, status: 'RESOLVIDO' } }),
  ])

  return NextResponse.json({
    registros,
    total,
    totalPendentes,
    totalResolvidos,
    pagina: page,
    totalPaginas: Math.ceil(total / limit),
  })
})

/**
 * PATCH /api/auditoria - Atualiza status (individual ou em lote)
 *
 * Body individual: { id: number, status: 'PENDENTE' | 'RESOLVIDO' }
 * Body lote:       { ids: number[], status: 'PENDENTE' | 'RESOLVIDO' }
 */
export const PATCH = withAuth(async (req, { userId }) => {
  const body = await req.json()
  const { id, ids, status } = body

  if (!status || !['PENDENTE', 'RESOLVIDO'].includes(status)) {
    return NextResponse.json(
      { erro: 'status (PENDENTE ou RESOLVIDO) é obrigatório' },
      { status: 400 }
    )
  }

  const idsAlvo: number[] = Array.isArray(ids) ? ids.filter(n => Number.isInteger(n)) : (id ? [id] : [])

  if (idsAlvo.length === 0) {
    return NextResponse.json({ erro: 'Informe id ou ids' }, { status: 400 })
  }

  // updateMany já filtra por usuarioId — IDs de outros tenants são ignorados silenciosamente
  const result = await prisma.auditoriaCotacao.updateMany({
    where: { id: { in: idsAlvo }, usuarioId: userId },
    data: {
      status,
      resolvidoEm: status === 'RESOLVIDO' ? new Date() : null,
    },
  })

  return NextResponse.json({ atualizados: result.count })
})
