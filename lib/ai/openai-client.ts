import OpenAI from 'openai'

let _client: OpenAI | null = null

export function getOpenAIClient(): OpenAI {
  if (_client) return _client
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY não configurada')
  _client = new OpenAI({ apiKey })
  return _client
}

export const MODELO_PRINCIPAL = 'gpt-4o-mini'
