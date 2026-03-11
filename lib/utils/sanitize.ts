/**
 * Utilitários de sanitização de inputs para prevenir XSS e injeção
 */

/**
 * Remove tags HTML e scripts de uma string
 * Previne XSS armazenado mantendo apenas texto puro
 * 
 * @param input - String a ser sanitizada
 * @returns String sem tags HTML
 */
export function sanitizeHTML(input: string): string {
  if (!input || typeof input !== 'string') return ''
  
  return input
    // Remove tags HTML
    .replace(/<[^>]*>/g, '')
    // Remove event handlers (onclick, onerror, etc)
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    // Remove javascript: protocol
    .replace(/javascript:/gi, '')
    // Remove data: protocol (pode conter base64 malicioso)
    .replace(/data:/gi, '')
    // Normaliza espaços em branco
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Sanitiza string mantendo apenas caracteres alfanuméricos, espaços e pontuação básica
 * Ideal para nomes, descrições, títulos
 * 
 * @param input - String a ser sanitizada
 * @param allowedChars - Regex de caracteres adicionais permitidos (padrão: pontuação básica)
 * @returns String sanitizada
 */
export function sanitizeText(
  input: string,
  allowedChars: string = 'a-zA-Z0-9\\s\\-_.,!?()áàâãéèêíïóôõöúçñÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ'
): string {
  if (!input || typeof input !== 'string') return ''
  
  // Remove HTML primeiro
  const withoutHTML = sanitizeHTML(input)
  
  // Mantém apenas caracteres permitidos
  const regex = new RegExp(`[^${allowedChars}]`, 'g')
  return withoutHTML.replace(regex, '').trim()
}

/**
 * Sanitiza SKU permitindo apenas alfanuméricos e separadores comuns
 * SKUs não devem conter caracteres especiais que possam causar problemas
 * 
 * @param sku - SKU a ser sanitizado
 * @returns SKU sanitizado
 */
export function sanitizeSKU(sku: string): string {
  if (!sku || typeof sku !== 'string') return ''
  
  return sku
    .toUpperCase()
    // Permite apenas: letras, números, hífen, underscore, ponto
    .replace(/[^A-Z0-9\-_.]/g, '')
    .trim()
}

/**
 * Sanitiza CEP mantendo apenas números
 * 
 * @param cep - CEP a ser sanitizado
 * @returns CEP sanitizado (apenas números)
 */
export function sanitizeCEP(cep: string): string {
  if (!cep || typeof cep !== 'string') return ''
  
  return cep.replace(/\D/g, '')
}

/**
 * Sanitiza email básico
 * Remove espaços e converte para minúsculas
 * 
 * @param email - Email a ser sanitizado
 * @returns Email sanitizado
 */
export function sanitizeEmail(email: string): string {
  if (!email || typeof email !== 'string') return ''
  
  return email
    .toLowerCase()
    .trim()
    .replace(/\s/g, '')
}

/**
 * Sanitiza URL removendo protocolos perigosos e scripts
 * 
 * @param url - URL a ser sanitizada
 * @returns URL sanitizada ou string vazia se inválida
 */
export function sanitizeURL(url: string): string {
  if (!url || typeof url !== 'string') return ''
  
  const cleaned = url.trim()
  
  // Bloquear protocolos perigosos
  if (
    cleaned.startsWith('javascript:') ||
    cleaned.startsWith('data:') ||
    cleaned.startsWith('vbscript:') ||
    cleaned.startsWith('file:')
  ) {
    return ''
  }
  
  return cleaned
}

/**
 * Sanitiza objeto recursivamente aplicando sanitização em strings
 * Útil para sanitizar payloads JSON completos
 * 
 * @param obj - Objeto a ser sanitizado
 * @param options - Opções de sanitização
 * @returns Objeto sanitizado
 */
export function sanitizeObject<T extends Record<string, any>>(
  obj: T,
  options: {
    skipFields?: string[]
    sanitizeFn?: (value: string) => string
  } = {}
): T {
  const { skipFields = [], sanitizeFn = sanitizeText } = options
  
  if (!obj || typeof obj !== 'object') return obj
  
  const sanitized = {} as T
  
  for (const [key, value] of Object.entries(obj)) {
    // Pular campos especificados
    if (skipFields.includes(key)) {
      sanitized[key as keyof T] = value
      continue
    }
    
    // Sanitizar strings
    if (typeof value === 'string') {
      sanitized[key as keyof T] = sanitizeFn(value) as any
    }
    // Recursão em objetos
    else if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key as keyof T] = sanitizeObject(value, options)
    }
    // Recursão em arrays
    else if (Array.isArray(value)) {
      sanitized[key as keyof T] = value.map(item =>
        typeof item === 'string'
          ? sanitizeFn(item)
          : typeof item === 'object'
          ? sanitizeObject(item, options)
          : item
      ) as any
    }
    // Outros tipos (números, booleanos, etc.)
    else {
      sanitized[key as keyof T] = value
    }
  }
  
  return sanitized
}

/**
 * Transform de Zod para sanitizar strings automaticamente
 * Uso: z.string().transform(sanitizeTransform)
 */
export const sanitizeTransform = (value: string) => sanitizeText(value)

/**
 * Transform de Zod para sanitizar SKUs
 * Uso: z.string().transform(sanitizeSKUTransform)
 */
export const sanitizeSKUTransform = (value: string) => sanitizeSKU(value)
