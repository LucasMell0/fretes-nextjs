import { prisma } from '@/lib/prisma'
import { cotacaoService } from '@/lib/services/cotacao.service'
import type { Tool, ToolContext } from './types'

// Remove acentos e normaliza para busca (espelha a normalização da UI de produtos)
const normalizar = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

const matchPorPalavra = (texto: string, query: string): boolean => {
  const q = normalizar(query).trim()
  if (!q) return true
  const palavrasTexto = normalizar(texto).split(/[\s\-_.,;:/\\()|]+/).filter(Boolean)
  const termos = q.split(/\s+/)
  return termos.every(t => palavrasTexto.some(p => p.startsWith(t)))
}

interface BuscarProdutoArgs { query: string; limite?: number }

const buscarProduto: Tool<BuscarProdutoArgs> = {
  definition: {
    type: 'function',
    function: {
      name: 'buscar_produto',
      description: 'Busca produtos do usuário por nome ou SKU. Retorna ao menos id, nome, sku, peso, cubagem, estoque, ativo. Use para resolver referências em linguagem natural antes de cotar.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Texto de busca: parte do nome ou do SKU' },
          limite: { type: 'integer', description: 'Máximo de resultados (padrão 10, máximo 20)' },
        },
        required: ['query'],
        additionalProperties: false,
      },
    },
  },
  async execute({ query, limite }, { userId }: ToolContext) {
    const max = Math.min(limite ?? 10, 20)
    const produtos = await prisma.produto.findMany({
      where: { usuarioId: userId, ativo: true },
      select: { id: true, nome: true, sku: true, peso: true, cubagem: true, estoque: true, ativo: true },
      take: 200,
    })
    const filtrados = produtos
      .filter(p => matchPorPalavra(p.nome, query) || matchPorPalavra(p.sku, query))
      .slice(0, max)
    return {
      total: filtrados.length,
      produtos: filtrados.map(p => ({
        ...p,
        peso: Number(p.peso),
        cubagem: Number(p.cubagem),
      })),
    }
  },
}

const listarTransportadoras: Tool<Record<string, never>> = {
  definition: {
    type: 'function',
    function: {
      name: 'listar_transportadoras',
      description: 'Lista todas as transportadoras ativas do usuário com seus IDs e nomes.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  async execute(_args, { userId }: ToolContext) {
    const transportadoras = await prisma.transportadora.findMany({
      where: { usuarioId: userId, ativo: true },
      select: { id: true, nome: true, fatorCubagem: true, margemLucro: true },
      orderBy: { nome: 'asc' },
    })
    return {
      total: transportadoras.length,
      transportadoras: transportadoras.map(t => ({
        ...t,
        fatorCubagem: Number(t.fatorCubagem),
        margemLucro: Number(t.margemLucro),
      })),
    }
  },
}

interface CotarFreteArgs {
  cep: string
  produtos: Array<{ sku: string; quantidade: number }>
}

const cotarFrete: Tool<CotarFreteArgs> = {
  definition: {
    type: 'function',
    function: {
      name: 'cotar_frete',
      description: 'Executa uma cotação de frete para um CEP de destino e uma lista de produtos (SKU + quantidade). Retorna os preços e prazos de todas as transportadoras que atendem aquele CEP.',
      parameters: {
        type: 'object',
        properties: {
          cep: { type: 'string', description: 'CEP de destino, com 8 dígitos (com ou sem traço).' },
          produtos: {
            type: 'array',
            description: 'Itens da cotação. Cada item tem o SKU do produto e a quantidade.',
            items: {
              type: 'object',
              properties: {
                sku: { type: 'string' },
                quantidade: { type: 'integer', minimum: 1 },
              },
              required: ['sku', 'quantidade'],
              additionalProperties: false,
            },
            minItems: 1,
          },
        },
        required: ['cep', 'produtos'],
        additionalProperties: false,
      },
    },
  },
  async execute({ cep, produtos }, { userId }: ToolContext) {
    const cepLimpo = cep.replace(/\D/g, '')
    const resultado = await cotacaoService.cotar(
      cepLimpo,
      produtos.map(p => ({ sku: p.sku, quantidade: p.quantidade })),
      userId
    )
    return {
      cotacoes: resultado.cotacoes,
      erros: resultado.erros,
    }
  },
}

export const consultaTools: Record<string, Tool> = {
  buscar_produto: buscarProduto as unknown as Tool,
  listar_transportadoras: listarTransportadoras as unknown as Tool,
  cotar_frete: cotarFrete as unknown as Tool,
}
