import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

// Rotas de API que são intencionalmente públicas (webhooks, OAuth callbacks, etc)
const PUBLIC_API_ROUTES = [
  "/api/auth",           // NextAuth routes
  "/api/v1/cotacao",     // API pública (autenticada via token no body)
  "/api/v1/anymarket",   // Webhook autenticado via token na URL
  "/api/v1/erp-bling",   // Webhook autenticado via token na URL
  "/api/canais",         // Lista de canais disponíveis (público)
  "/api/transportadoras/modelo-csv", // Template CSV estático
]

export default withAuth(
  function middleware(req) {
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ req, token }) => {
        const path = req.nextUrl.pathname

        // Permitir rotas de API públicas sem autenticação
        if (PUBLIC_API_ROUTES.some(route => path.startsWith(route))) {
          return true
        }

        // Todas as outras rotas (dashboard + APIs internas) exigem sessão
        return !!token
      },
    },
  }
)

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/produtos/:path*",
    "/transportadoras/:path*",
    "/cotacoes/:path*",
    "/regioes/:path*",
    "/api/:path*",
  ],
}
