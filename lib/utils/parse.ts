import { Session } from 'next-auth'

/**
 * Extrai e converte o ID do usuário da sessão para número
 * @param session - Sessão do NextAuth
 * @returns ID do usuário como número
 */
export function getSessionUserId(session: Session): number {
  return parseInt(session.user.id)
}

/**
 * Converte um parâmetro de rota para número com validação
 * @param paramId - ID vindo dos params da rota
 * @returns ID como número
 * @throws Error se o ID for inválido
 */
export function parseRouteId(paramId: string): number {
  const id = parseInt(paramId)
  
  if (isNaN(id) || id <= 0) {
    throw new Error('ID inválido')
  }
  
  return id
}

/**
 * Converte um parâmetro de rota para número de forma segura
 * Retorna null se inválido ao invés de lançar erro
 * @param paramId - ID vindo dos params da rota
 * @returns ID como número ou null se inválido
 */
export function safeParseRouteId(paramId: string): number | null {
  const id = parseInt(paramId)
  
  if (isNaN(id) || id <= 0) {
    return null
  }
  
  return id
}

/**
 * Converte string para número inteiro com valor padrão
 * @param value - Valor a ser convertido
 * @param defaultValue - Valor padrão se conversão falhar
 * @returns Número convertido ou valor padrão
 */
export function parseIntWithDefault(value: string | null | undefined, defaultValue: number): number {
  if (!value) return defaultValue
  
  const parsed = parseInt(value)
  return isNaN(parsed) ? defaultValue : parsed
}
