/**
 * Logger personalizado para o sistema
 * 
 * - Em desenvolvimento: logs aparecem no console
 * - Em produção: apenas erros são logados
 * 
 * Uso:
 * import { logger } from '@/lib/logger'
 * logger.info('Mensagem informativa')
 * logger.error('Erro crítico', error)
 */

type LogLevel = 'info' | 'warn' | 'error' | 'debug'

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development'

  /**
   * Log informativo - apenas em desenvolvimento
   */
  info(message: string, ...args: any[]): void {
    if (this.isDevelopment) {
      console.log(`ℹ️  ${message}`, ...args)
    }
  }

  /**
   * Log de debug - apenas em desenvolvimento
   */
  debug(message: string, ...args: any[]): void {
    if (this.isDevelopment) {
      console.debug(`🐛 ${message}`, ...args)
    }
  }

  /**
   * Log de warning - sempre exibido
   */
  warn(message: string, ...args: any[]): void {
    console.warn(`⚠️  ${message}`, ...args)
  }

  /**
   * Log de erro - sempre exibido
   */
  error(message: string, ...args: any[]): void {
    console.error(`❌ ${message}`, ...args)
  }

  /**
   * Log estruturado para APIs - apenas em desenvolvimento
   */
  api(method: string, path: string, status: number, duration?: number): void {
    if (this.isDevelopment) {
      const emoji = status >= 200 && status < 300 ? '✅' : '❌'
      const msg = duration 
        ? `${emoji} ${method} ${path} - ${status} (${duration}ms)`
        : `${emoji} ${method} ${path} - ${status}`
      console.log(msg)
    }
  }
}

export const logger = new Logger()
