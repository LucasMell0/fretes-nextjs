import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/middleware/auth'

const COTA_PADRAO = 200

export const GET = withAuth(async (_req, { userId }) => {
  const agora = new Date()
  const ano = agora.getUTCFullYear()
  const mes = agora.getUTCMonth() + 1

  const uso = await prisma.assistenteUsoMensal.findUnique({
    where: { usuarioId_ano_mes: { usuarioId: userId, ano, mes } },
    select: { mensagens: true, cotaMensal: true },
  })

  return NextResponse.json({
    ano,
    mes,
    mensagens: uso?.mensagens ?? 0,
    cotaMensal: uso?.cotaMensal ?? COTA_PADRAO,
    restantes: Math.max(0, (uso?.cotaMensal ?? COTA_PADRAO) - (uso?.mensagens ?? 0)),
  })
})
