import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { ImportacaoService } from '@/lib/services/importacao.service'
import { withAuthTyped } from '@/lib/middleware/auth'
import { parseRouteId } from '@/lib/utils/parse'
import { verifyOwnership } from '@/lib/utils/ownership'

interface RouteParams {
  id: string
}
import { importacaoRequestSchema } from '@/lib/validators/importacao.validator'
import { invalidateRegiaoCache } from '@/lib/cache'

export const POST = withAuthTyped<RouteParams>(async (req, { userId }, params) => {
  try {
    const transportadoraId = parseRouteId(params!.id)

    const transportadora = await verifyOwnership(
      prisma.transportadora,
      transportadoraId,
      userId
    )

    if (!transportadora) {
      return NextResponse.json(
        { erro: 'Transportadora não encontrada ou sem permissão' },
        { status: 404 }
      )
    }

    const body = await req.json()
    
    const validacao = importacaoRequestSchema.safeParse({
      transportadoraId,
      regioes: body.regioes
    })

    if (!validacao.success) {
      return NextResponse.json(
        { 
          erro: 'Dados inválidos',
          detalhes: validacao.error.errors 
        },
        { status: 400 }
      )
    }

    const service = new ImportacaoService()
    const resultado = await service.importarRegioes(
      transportadoraId,
      userId,
      validacao.data.regioes
    )

    if (!resultado.sucesso) {
      return NextResponse.json(
        { 
          erro: 'Erro ao importar regiões',
          detalhes: resultado.erros 
        },
        { status: 400 }
      )
    }

    invalidateRegiaoCache(userId).catch(() => {})
    return NextResponse.json({
      sucesso: true,
      regioesImportadas: resultado.regioesImportadas,
      faixasImportadas: resultado.faixasImportadas,
      mensagem: `Importação concluída! ${resultado.regioesImportadas} regiões e ${resultado.faixasImportadas} faixas de peso importadas.`
    })
  } catch (error) {
    logger.error('Erro na importação:', error)
    return NextResponse.json(
      { erro: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
})
