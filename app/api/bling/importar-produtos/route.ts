import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { withAuth } from '@/lib/middleware/auth'
import { BlingService } from '@/lib/services/bling.service'
import { invalidateProdutoCache } from '@/lib/cache'

/**
 * API para importar produtos do Bling ERP
 * 
 * Endpoint: POST /api/bling/importar-produtos
 * 
 * Body:
 * {
 *   "apiKey": "sua-api-key-do-bling",
 *   "criterio": 2,  // 1: Últimos incluídos, 2: Ativos, 3: Inativos, 4: Excluídos, 5: Todos
 *   "tipo": "P",    // T: Todos, P: Produtos, S: Serviços, E: Composições, PS: Produtos simples, C: Com variações, V: Variações
 *   "limite": 100   // Produtos por página
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "importados": 45,
 *   "atualizados": 23,
 *   "erros": 2,
 *   "detalhes": [...]
 * }
 */

export const POST = withAuth(async (req, { userId }) => {
  try {
    // 2. Parse body
    const body = await req.json()
    
    const { integracaoId, produtoIds } = body

    if (!integracaoId) {
      return NextResponse.json(
        { error: 'ID da integração do Bling é obrigatório' },
        { status: 400 }
      )
    }

    // 3. Buscar integração e validar OAuth
    const integracao = await prisma.usuarioIntegracaoCanal.findFirst({
      where: {
        usuarioId: userId,
        id: parseInt(integracaoId)
      },
      include: { canal: true }
    })

    if (!integracao) {
      return NextResponse.json(
        { error: 'Integração não encontrada' },
        { status: 404 }
      )
    }

    if (!integracao.accessToken || !integracao.refreshToken) {
      return NextResponse.json(
        { error: 'Integração Bling não possui OAuth configurado. Reconecte a conta.' },
        { status: 400 }
      )
    }

    // 4. Criar serviço Bling com OAuth
    const blingService = new BlingService({ integracaoId: parseInt(integracaoId), apiKey: '' })
    blingService.setTokens(
      integracao.accessToken,
      integracao.refreshToken,
      integracao.tokenExpiresAt || new Date(),
      integracao.id
    )

    // 5. Iniciar importação
    logger.info(`Iniciando importação de produtos do Bling para usuário ${userId}`)
    
    let resultado
    
    if (produtoIds && Array.isArray(produtoIds) && produtoIds.length > 0) {
      // Importação seletiva
      logger.info(`Importando ${produtoIds.length} produtos selecionados`)
      resultado = await blingService.importarProdutosSelecionados(
        userId,
        produtoIds
      )
    } else {
      // Importação completa (com paginação automática)
      // Filtros fixos: Ativos + Produtos
      resultado = await blingService.importarProdutos(
        userId,
        {
          criterio: 2, // Fixo: Somente Ativos
          tipo: 'P' // Fixo: Somente Produtos
        }
      )
    }

    logger.info(`Importação concluída:`, resultado)

    invalidateProdutoCache(userId).catch(() => {})
    return NextResponse.json({
      success: true,
      ...resultado
    })

  } catch (error) {
    logger.error('Erro ao importar produtos do Bling:', error)
    
    return NextResponse.json(
      { error: 'Erro ao importar produtos' },
      { status: 500 }
    )
  }
})

/**
 * GET /api/bling/importar-produtos
 * 
 * Retorna o status da última importação (se implementarmos job assíncrono)
 */
export const GET = withAuth(async (_req, { userId: _userId }) => {
  try {
    // TODO: Implementar consulta de status se necessário
    // Por enquanto, apenas retorna informações básicas

    return NextResponse.json({
      message: 'Use POST para iniciar importação de produtos do Bling'
    })

  } catch (error) {
    logger.error('Erro ao verificar status de importação:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})
