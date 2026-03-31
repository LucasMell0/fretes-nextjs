import { NextRequest, NextResponse } from 'next/server'
import { getServerSession, Session } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSessionUserId } from '@/lib/utils/parse'

/**
 * Context passado para handlers autenticados
 */
export interface AuthContext {
  session: Session
  userId: number
}

/**
 * Tipo do handler autenticado
 */
export type AuthenticatedHandler<T = unknown> = (
  req: NextRequest,
  context: AuthContext,
  params?: T
) => Promise<NextResponse> | NextResponse

/**
 * Middleware de autenticação
 * Verifica sessão e passa userId e session para o handler
 * 
 * @param handler - Handler que receberá o contexto autenticado
 * @returns Handler com autenticação aplicada
 * 
 * @example
 * // Sem params
 * export const GET = withAuth(async (req, { session, userId }) => {
 *   const produtos = await prisma.produto.findMany({
 *     where: { usuarioId: userId }
 *   })
 *   return NextResponse.json(produtos)
 * })
 * 
 * @example
 * // Com params
 * export const GET = withAuth(async (req, { session, userId }, params) => {
 *   const produtoId = parseRouteId(params.id)
 *   const produto = await verifyOwnership(prisma.produto, produtoId, userId)
 *   return NextResponse.json(produto)
 * })
 */
export function withAuth<T = unknown>(
  handler: AuthenticatedHandler<T>
) {
  return async (
    req: NextRequest,
    context?: { params?: T }
  ): Promise<NextResponse> => {
    try {
      // Verificar autenticação
      const session = await getServerSession(authOptions)
      
      if (!session?.user?.id) {
        return NextResponse.json(
          { erro: 'Não autorizado' },
          { status: 401 }
        )
      }

      // Extrair userId
      const userId = getSessionUserId(session)

      // Chamar handler com contexto autenticado
      return await handler(
        req,
        { session, userId },
        context?.params
      )
    } catch (error) {
      // Erros de validação (ex: parseRouteId)
      if (error instanceof Error && (error as Error & { status?: number }).status) {
        return NextResponse.json(
          { erro: error.message },
          { status: (error as Error & { status?: number }).status }
        )
      }

      // Re-lançar para catch do handler
      throw error
    }
  }
}

/**
 * Middleware de autenticação com tipagem de params
 * Versão type-safe quando você sabe o tipo dos params
 * 
 * @example
 * interface RouteParams {
 *   id: string
 * }
 * 
 * export const GET = withAuthTyped<RouteParams>(async (req, { userId }, params) => {
 *   const produtoId = parseRouteId(params.id)  // TypeScript sabe que params.id existe
 *   // ...
 * })
 */
export function withAuthTyped<TParams>(
  handler: (
    req: NextRequest,
    context: AuthContext,
    params?: TParams
  ) => Promise<NextResponse> | NextResponse
) {
  return withAuth<TParams>(handler as AuthenticatedHandler<TParams>)
}
