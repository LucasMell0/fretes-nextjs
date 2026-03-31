/**
 * Utilitários para verificação de ownership (propriedade) de recursos
 * Evita duplicação do padrão de verificação em todas as rotas
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PrismaModelDelegate = { findFirst: (...args: any[]) => Promise<any>; findMany?: (...args: any[]) => Promise<any[]>; count?: (...args: any[]) => Promise<number> }

/**
 * Verifica se um recurso pertence ao usuário
 * Retorna o recurso se pertencer, null caso contrário
 *
 * @param model - Model do Prisma (ex: prisma.produto)
 * @param id - ID do recurso
 * @param usuarioId - ID do usuário
 * @param include - Opções de include (opcional)
 * @returns Recurso encontrado ou null
 *
 * @example
 * const produto = await verifyOwnership(
 *   prisma.produto,
 *   produtoId,
 *   usuarioId
 * )
 * if (!produto) {
 *   return NextResponse.json({ erro: 'Não encontrado' }, { status: 404 })
 * }
 *
 * @example Com include tipado:
 * const regiao = await verifyOwnership<TransportadoraRegiaoWithRelations>(
 *   prisma.transportadoraRegiao,
 *   regiaoId,
 *   userId,
 *   { transportadora: true, precos: true }
 * )
 */
export async function verifyOwnership<T = unknown>(
  model: PrismaModelDelegate,
  id: number,
  usuarioId: number,
  include?: Record<string, unknown>
): Promise<T | null> {
  return await model.findFirst({
    where: { id, usuarioId },
    ...(include && { include }),
  }) as T | null
}

/**
 * Verifica ownership e lança erro 404 se não encontrado
 * Útil quando você quer simplificar ainda mais o código
 * 
 * @param model - Model do Prisma
 * @param id - ID do recurso
 * @param usuarioId - ID do usuário
 * @param errorMessage - Mensagem de erro customizada (opcional)
 * @returns Recurso encontrado (nunca null)
 * @throws Error com status 404 se não encontrado
 * 
 * @example
 * const produto = await verifyOwnershipOrThrow(
 *   prisma.produto,
 *   produtoId,
 *   usuarioId,
 *   'Produto não encontrado'
 * )
 * // Não precisa verificar if (!produto) - já lança erro
 */
export async function verifyOwnershipOrThrow<T>(
  model: PrismaModelDelegate,
  id: number,
  usuarioId: number,
  errorMessage: string = 'Recurso não encontrado ou sem permissão'
): Promise<T> {
  const resource = await model.findFirst({
    where: { id, usuarioId },
  })

  if (!resource) {
    const error = new Error(errorMessage) as Error & { status: number }
    error.status = 404
    throw error
  }

  return resource as T
}

/**
 * Verifica múltiplos recursos de uma vez
 * Útil quando precisa validar vários IDs
 * 
 * @param model - Model do Prisma
 * @param ids - Array de IDs
 * @param usuarioId - ID do usuário
 * @returns Array de recursos encontrados
 * 
 * @example
 * const produtos = await verifyMultipleOwnership(
 *   prisma.produto,
 *   [1, 2, 3],
 *   usuarioId
 * )
 * if (produtos.length !== 3) {
 *   return NextResponse.json({ erro: 'Alguns produtos não encontrados' })
 * }
 */
export async function verifyMultipleOwnership<T>(
  model: PrismaModelDelegate,
  ids: number[],
  usuarioId: number
): Promise<T[]> {
  return await model.findMany!({
    where: {
      id: { in: ids },
      usuarioId,
    },
  })
}

/**
 * Verifica se usuário tem permissão para acessar recurso
 * Retorna apenas boolean (não retorna o recurso)
 * Útil para checks rápidos
 * 
 * @param model - Model do Prisma
 * @param id - ID do recurso
 * @param usuarioId - ID do usuário
 * @returns true se tem permissão, false caso contrário
 * 
 * @example
 * const temPermissao = await hasOwnership(
 *   prisma.produto,
 *   produtoId,
 *   usuarioId
 * )
 * if (!temPermissao) {
 *   return NextResponse.json({ erro: 'Sem permissão' }, { status: 403 })
 * }
 */
export async function hasOwnership(
  model: PrismaModelDelegate,
  id: number,
  usuarioId: number
): Promise<boolean> {
  const count = await model.count!({
    where: { id, usuarioId },
  })
  
  return count > 0
}
