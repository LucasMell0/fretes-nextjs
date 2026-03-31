import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { encrypt } from '@/lib/crypto'
import { logger } from '@/lib/logger'

/**
 * API para receber callback OAuth2 do Bling
 * 
 * Endpoint: GET /api/auth/bling/callback?code={authorization_code}&state={state}
 * 
 * Recebe authorization_code do Bling e troca por access_token
 */

export async function GET(request: NextRequest) {
  try {
    // 1. Obter parâmetros do callback
    const code = request.nextUrl.searchParams.get('code')
    const stateParam = request.nextUrl.searchParams.get('state')
    
    if (!code || !stateParam) {
      return NextResponse.redirect(
        `${request.nextUrl.origin}/dashboard/integracoes?error=missing_params`
      )
    }

    // 2. Extrair state e integracaoId
    const [state, integracaoIdStr] = stateParam.split(':')
    const integracaoId = parseInt(integracaoIdStr)

    if (!integracaoId) {
      return NextResponse.redirect(
        `${request.nextUrl.origin}/dashboard/integracoes?error=invalid_state`
      )
    }

    // 3. Buscar integração e validar state
    const integracao = await prisma.usuarioIntegracaoCanal.findUnique({
      where: { id: integracaoId },
      include: {
        canal: true
      }
    })

    if (!integracao) {
      return NextResponse.redirect(
        `${request.nextUrl.origin}/dashboard/integracoes?error=integration_not_found`
      )
    }

    const config = integracao.config as Record<string, unknown>
    
    if (!config?.oauthState || config.oauthState !== state) {
      return NextResponse.redirect(
        `${request.nextUrl.origin}/dashboard/integracoes?error=invalid_state`
      )
    }

    // Verificar se state não expirou (5 minutos)
    const stateAge = Date.now() - (Number(config.oauthTimestamp) || 0)
    if (stateAge > 5 * 60 * 1000) {
      return NextResponse.redirect(
        `${request.nextUrl.origin}/dashboard/integracoes?error=state_expired`
      )
    }

    // 4. Trocar authorization_code por access_token
    const clientId = process.env.BLING_CLIENT_ID
    const clientSecret = process.env.BLING_CLIENT_SECRET
    
    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        `${request.nextUrl.origin}/dashboard/integracoes?error=oauth_not_configured`
      )
    }

    // Criar credenciais Base64 para Basic Auth
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

    const tokenResponse = await fetch('https://api.bling.com.br/Api/v3/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': '1.0',
        'Authorization': `Basic ${credentials}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code
      })
    })

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text()
      logger.error('Erro ao trocar code por token:', error)
      return NextResponse.redirect(
        `${request.nextUrl.origin}/dashboard/integracoes?error=token_exchange_failed`
      )
    }

    const tokenData = await tokenResponse.json()

    /**
     * Resposta esperada:
     * {
     *   "access_token": "...",
     *   "expires_in": 21600,      // 6 horas em segundos
     *   "token_type": "Bearer",
     *   "scope": "98309 318257570 5862218180",
     *   "refresh_token": "..."
     * }
     */

    // 5. Salvar tokens no banco (CRIPTOGRAFADOS)
    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000))

    await prisma.usuarioIntegracaoCanal.update({
      where: { id: integracaoId },
      data: {
        accessToken: encrypt(tokenData.access_token),
        refreshToken: encrypt(tokenData.refresh_token),
        tokenExpiresAt: expiresAt,
        scopes: tokenData.scope,
        status: 'configurado',
        ativo: true,
        config: {
          // Remover state temporário
          oauthState: undefined,
          oauthTimestamp: undefined
        }
      }
    })

    // 6. Redirecionar usuário de volta para página de integrações
    return NextResponse.redirect(
      `${request.nextUrl.origin}/dashboard/integracoes?success=bling_connected`
    )

  } catch (error) {
    logger.error('Erro no callback OAuth Bling:', error)
    
    return NextResponse.redirect(
      `${request.nextUrl.origin}/dashboard/integracoes?error=callback_failed`
    )
  }
}
