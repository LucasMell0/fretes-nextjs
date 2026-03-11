/**
 * Validators para verificar ownership de relacionamentos
 * Previne vazamento cross-tenant ao criar recursos
 */

import { prisma } from '@/lib/prisma'

/**
 * Verifica se transportadora pertence ao usuário
 * @param transportadoraId - ID da transportadora
 * @param userId - ID do usuário
 * @returns true se pertence, false caso contrário
 */
export async function verifyTransportadoraOwnership(
  transportadoraId: number,
  userId: number
): Promise<boolean> {
  const count = await prisma.transportadora.count({
    where: {
      id: transportadoraId,
      usuarioId: userId,
      ativo: true,
    },
  })
  return count > 0
}

/**
 * Verifica se produto pertence ao usuário
 * @param produtoId - ID do produto
 * @param userId - ID do usuário
 * @returns true se pertence, false caso contrário
 */
export async function verifyProdutoOwnership(
  produtoId: number,
  userId: number
): Promise<boolean> {
  const count = await prisma.produto.count({
    where: {
      id: produtoId,
      usuarioId: userId,
      ativo: true,
    },
  })
  return count > 0
}

/**
 * Verifica se região pertence ao usuário
 * @param regiaoId - ID da região
 * @param userId - ID do usuário
 * @returns true se pertence, false caso contrário
 */
export async function verifyRegiaoOwnership(
  regiaoId: number,
  userId: number
): Promise<boolean> {
  const count = await prisma.transportadoraRegiao.count({
    where: {
      id: regiaoId,
      usuarioId: userId,
      ativo: true,
    },
  })
  return count > 0
}

/**
 * Verifica se múltiplos produtos pertencem ao usuário
 * @param produtoIds - Array de IDs de produtos
 * @param userId - ID do usuário
 * @returns true se TODOS pertencem, false se algum não pertence
 */
export async function verifyMultipleProdutosOwnership(
  produtoIds: number[],
  userId: number
): Promise<boolean> {
  const count = await prisma.produto.count({
    where: {
      id: { in: produtoIds },
      usuarioId: userId,
      ativo: true,
    },
  })
  return count === produtoIds.length
}

/**
 * Verifica se canal de integração pertence ao usuário
 * @param integracaoId - ID da integração
 * @param userId - ID do usuário
 * @returns true se pertence, false caso contrário
 */
export async function verifyIntegracaoOwnership(
  integracaoId: number,
  userId: number
): Promise<boolean> {
  const count = await prisma.usuarioIntegracaoCanal.count({
    where: {
      id: integracaoId,
      usuarioId: userId,
      ativo: true,
    },
  })
  return count > 0
}
