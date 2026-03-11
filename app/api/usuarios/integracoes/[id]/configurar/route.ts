import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { withAuthTyped } from '@/lib/middleware/auth'
import { parseRouteId } from '@/lib/utils/parse'

/**
 * API para configurar integrações (salvar API Keys, credenciais OAuth, etc)
 * 
 * Endpoint: PATCH /api/usuarios/integracoes/{id}/configurar
 * 
 * Body (Bling):
 * {
 *   "apiKey": "sua-api-key-do-bling",
 *   "apiUrl": "https://www.bling.com.br/Api/v3" // opcional
 * }
 * 
 * Body (outros canais no futuro):
 * {
 *   "credentials": { ... }
 * }
 */

interface RouteParams {
  id: string
}

export const PATCH = withAuthTyped<RouteParams>(async (req, { userId }, params) => {
  try {
    const integracaoId = parseRouteId(params!.id)

    const integracao = await prisma.usuarioIntegracaoCanal.findUnique({
      where: { id: integracaoId },
      include: {
        canal: true
      }
    })

    if (!integracao) {
      return NextResponse.json(
        { error: 'Integração não encontrada' },
        { status: 404 }
      )
    }

    if (integracao.usuarioId !== userId) {
      return NextResponse.json(
        { error: 'Você não tem permissão para configurar esta integração' },
        { status: 403 }
      )
    }

    const body = await req.json()

    const config: any = {}

    if (integracao.canal.slug === 'erp-bling') {
      // Validar API Key do Bling
      if (!body.apiKey) {
        return NextResponse.json(
          { error: 'API Key do Bling é obrigatória' },
          { status: 400 }
        )
      }

      config.apiKey = body.apiKey
      config.apiUrl = body.apiUrl || 'https://www.bling.com.br/Api/v3'
      
      // TODO: Validar API Key fazendo uma chamada de teste ao Bling
      // Para garantir que a API Key é válida antes de salvar
    } else {
      // Para outros canais no futuro
      config.credentials = body.credentials || {}
    }

    // 5. Atualizar integração com as configurações
    const integracaoAtualizada = await prisma.usuarioIntegracaoCanal.update({
      where: { id: integracaoId },
      data: {
        config: config,
        status: 'configurado',
        atualizadoEm: new Date()
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
          }
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Integração configurada com sucesso',
      integracao: {
        id: integracaoAtualizada.id,
        canalId: integracaoAtualizada.canalId,
        canal: integracaoAtualizada.canal,
        token: integracaoAtualizada.token,
        ativo: integracaoAtualizada.ativo,
        status: integracaoAtualizada.status,
        configurado: !!integracaoAtualizada.config,
        ultimaRequisicao: integracaoAtualizada.ultimaRequisicao,
        totalRequisicoes: integracaoAtualizada.totalRequisicoes,
        criadoEm: integracaoAtualizada.criadoEm
      }
    })

  } catch (error) {
    logger.error('Erro ao configurar integração:', error)
    
    return NextResponse.json(
      { 
        error: 'Erro ao configurar integração',
        message: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    )
  }
})

/**
 * GET /api/usuarios/integracoes/{id}/configurar
 * 
 * Retorna o status da configuração (sem expor a API Key)
 */
export const GET = withAuthTyped<RouteParams>(async (req, { userId }, params) => {
  try {
    const integracaoId = parseRouteId(params!.id)

    const integracao = await prisma.usuarioIntegracaoCanal.findUnique({
      where: { id: integracaoId },
      include: {
        canal: true
      }
    })

    if (!integracao) {
      return NextResponse.json(
        { error: 'Integração não encontrada' },
        { status: 404 }
      )
    }

    if (integracao.usuarioId !== userId) {
      return NextResponse.json(
        { error: 'Você não tem permissão para acessar esta integração' },
        { status: 403 }
      )
    }

    // Retornar status sem expor credenciais
    return NextResponse.json({
      id: integracao.id,
      canal: integracao.canal.nome,
      configurado: !!integracao.config,
      status: integracao.status,
      ativo: integracao.ativo
    })

  } catch (error) {
    logger.error('Erro:', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})
