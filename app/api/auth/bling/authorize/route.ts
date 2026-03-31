import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'
import { logger } from '@/lib/logger'
import { withAuth } from '@/lib/middleware/auth'

/**
 * API para iniciar fluxo OAuth2 do Bling
 * 
 * Endpoint: GET /api/auth/bling/authorize?integracaoId={id}
 * 
 * Redireciona o usuário para página de autorização do Bling
 */

export const GET = withAuth(async (req, { userId }) => {
  try {

    // 2. Obter ou criar integração do usuário
    const integracaoIdParam = req.nextUrl.searchParams.get('integracaoId')
    let integracao
    
    if (integracaoIdParam) {
      // Usar integração existente
      integracao = await prisma.usuarioIntegracaoCanal.findUnique({
        where: { id: parseInt(integracaoIdParam) },
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

      if (integracao.canal.slug !== 'erp-bling') {
        return NextResponse.json(
          { error: 'Esta integração não é do tipo Bling' },
          { status: 400 }
        )
      }
    } else {
      // Buscar ou criar integração
      const canalBling = await prisma.canalIntegracao.findUnique({
        where: { slug: 'erp-bling' }
      })

      if (!canalBling) {
        return NextResponse.json(
          { error: 'Canal Bling não encontrado. Execute o seed do banco de dados.' },
          { status: 500 }
        )
      }

      // Sempre criar nova integração (múltiplas contas permitidas)
      const token = randomBytes(32).toString('hex')

      integracao = await prisma.usuarioIntegracaoCanal.create({
        data: {
          usuarioId: userId,
          canalId: canalBling.id,
          token: token,
          config: {},
          ativo: true,
          status: 'ativo',
        },
        include: {
          canal: true
        }
      })
    }

    // 3. Verificar credenciais do Bling
    const clientId = process.env.BLING_CLIENT_ID
    const redirectUri = process.env.BLING_REDIRECT_URI
    
    if (!clientId || !redirectUri) {
      return NextResponse.json(
        { error: 'Bling OAuth não configurado. Configure BLING_CLIENT_ID e BLING_REDIRECT_URI no .env' },
        { status: 500 }
      )
    }

    // 4. Gerar state aleatório para segurança (previne CSRF)
    const state = randomBytes(32).toString('hex')

    // 5. Salvar state temporariamente no config
    await prisma.usuarioIntegracaoCanal.update({
      where: { id: integracao.id },
      data: {
        config: {
          ...((integracao.config as Record<string, unknown>) || {}),
          oauthState: state,
          oauthTimestamp: Date.now()
        }
      }
    })

    // 6. Montar URL de autorização do Bling
    const authUrl = new URL('https://www.bling.com.br/Api/v3/oauth/authorize')
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('state', `${state}:${integracao.id}`) // state:integracaoId para recuperar depois

    // 7. Redirecionar usuário para Bling
    return NextResponse.redirect(authUrl.toString())

  } catch (error) {
    logger.error('Erro ao iniciar OAuth Bling:', error)
    
    return NextResponse.json(
      { 
        error: 'Erro ao iniciar autorização',
        message: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    )
  }
})
