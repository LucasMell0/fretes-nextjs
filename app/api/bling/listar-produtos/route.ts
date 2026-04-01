import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { withAuth } from '@/lib/middleware/auth'
import { BlingService } from '@/lib/services/bling.service'

/**
 * API para listar produtos do Bling (sem importar)
 * Busca TODOS os produtos com paginação automática
 * Filtros fixos: Ativos + Somente produtos PAI (sem variações individuais)
 * 
 * GET /api/bling/listar-produtos?integracaoId=1
 */
export const GET = withAuth(async (req, { userId }) => {
  try {
    // 2. Parse query params
    const searchParams = req.nextUrl.searchParams
    const integracaoId = searchParams.get('integracaoId')

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

    // 5. Listar TODOS os produtos com paginação automática
    logger.info(`Listando TODOS os produtos do Bling para usuário ${userId}`)
    
    const todosProdutos = []
    let pagina = 1
    let temMaisProdutos = true

    while (temMaisProdutos) {
      try {
        const response = await blingService.buscarProdutos({
          pagina,
          limite: 100,
          criterio: 2, // Fixo: Somente Ativos
          tipo: 'T' // Todos os tipos para depois filtrar
        })

        if (!response.data || response.data.length === 0) {
          temMaisProdutos = false
          break
        }

        // Filtrar APENAS produtos PAI e SIMPLES
        // Excluir variações individuais (que possuem idProdutoPai)
        const produtosPai = response.data.filter((p: { idProdutoPai?: number }) => {
          // Se tem idProdutoPai, é uma variação (filho) - EXCLUIR
          // Se NÃO tem idProdutoPai, é produto pai ou simples - INCLUIR
          return !p.idProdutoPai
        })

        todosProdutos.push(...produtosPai)

        logger.debug(`Página ${pagina}: ${response.data.length} produtos (${produtosPai.length} pais)`)

        // Se retornou menos que 100, não tem mais produtos
        if (response.data.length < 100) {
          temMaisProdutos = false
        } else {
          pagina++
        }
      } catch (error) {
        logger.error(`Erro ao buscar página ${pagina}:`, error)
        temMaisProdutos = false
      }
    }

    logger.info(`Total: ${todosProdutos.length} produtos PAI encontrados`)

    return NextResponse.json({
      success: true,
      produtos: todosProdutos,
      total: todosProdutos.length
    })

  } catch (error) {
    logger.error('Erro ao listar produtos do Bling:', error)
    
    return NextResponse.json(
      { error: 'Erro ao listar produtos' },
      { status: 500 }
    )
  }
})
