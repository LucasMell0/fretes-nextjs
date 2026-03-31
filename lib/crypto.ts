import crypto from 'crypto'
import { logger } from '@/lib/logger'

/**
 * Utilitário de criptografia para tokens OAuth e dados sensíveis
 * 
 * Requisitos:
 * - ENCRYPTION_KEY: Variável de ambiente com 32 bytes em hex (64 caracteres)
 * - Gerar com: openssl rand -hex 32
 */

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  
  if (!key) {
    throw new Error('ENCRYPTION_KEY não está definida nas variáveis de ambiente')
  }
  
  if (key.length !== 64) {
    throw new Error('ENCRYPTION_KEY deve ter 64 caracteres (32 bytes em hex)')
  }
  
  return Buffer.from(key, 'hex')
}

/**
 * Criptografa uma string usando AES-256-GCM
 * @param text Texto a ser criptografado
 * @returns String no formato: iv:authTag:encrypted (todos em hex)
 */
export function encrypt(text: string): string {
  if (!text) return ''
  
  try {
    const key = getEncryptionKey()
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
    
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    const authTag = cipher.getAuthTag()
    
    // Formato: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
  } catch (error) {
    logger.error('Erro ao criptografar:', error)
    throw new Error('Falha na criptografia')
  }
}

/**
 * Descriptografa uma string criptografada por encrypt()
 * @param encryptedData String no formato: iv:authTag:encrypted
 * @returns Texto descriptografado
 */
export function decrypt(encryptedData: string): string {
  if (!encryptedData) return ''
  
  try {
    const key = getEncryptionKey()
    const parts = encryptedData.split(':')
    
    if (parts.length !== 3) {
      throw new Error('Formato de dados criptografados inválido')
    }
    
    const iv = Buffer.from(parts[0], 'hex')
    const authTag = Buffer.from(parts[1], 'hex')
    const encrypted = parts[2]
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  } catch (error) {
    logger.error('Erro ao descriptografar:', error)
    throw new Error('Falha na descriptografia')
  }
}

/**
 * Verifica se o texto está criptografado (formato correto)
 */
export function isEncrypted(text: string): boolean {
  if (!text) return false
  const parts = text.split(':')
  return parts.length === 3 && parts[0].length === 32 && parts[1].length === 32
}

/**
 * Gera uma chave de criptografia aleatória (para uso em desenvolvimento)
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex')
}
