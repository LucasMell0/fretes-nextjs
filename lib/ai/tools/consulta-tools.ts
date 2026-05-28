import { prisma } from '@/lib/prisma'
import { cotacaoService } from '@/lib/services/cotacao.service'
import type { Tool, ToolContext } from './types'

interface BuscarProdutoArgs { query: string; limite?: number }

const buscarProduto: Tool<BuscarProdutoArgs> = {
  definition: {
    type: 'function',
    function: {
      name: 'buscar_produto',
      description: 'Busca produtos do usuário por nome ou SKU. Retorna os produtos mais relevantes onde PELO MENOS UMA das palavras da query aparece no nome ou SKU, ordenados por quantas palavras casaram (campo "palavrasCasadas") — quanto maior, mais relevante. Tolerante a palavras extras que o usuário coloque mesmo sem estarem no nome. Use os resultados pra confirmar com o usuário qual produto ele quer antes de cotar.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Texto de busca: parte do nome ou do SKU. Cada palavra é exigida separadamente.' },
          limite: { type: 'integer', description: 'Máximo de resultados (padrão 25, máximo 50).' },
        },
        required: ['query'],
        additionalProperties: false,
      },
    },
  },
  async execute({ query, limite }, { userId }: ToolContext) {
    const max = Math.min(limite ?? 25, 50)
    const palavras = query.trim().split(/\s+/).filter(Boolean)
    if (palavras.length === 0) {
      return { total: 0, produtos: [], aviso: 'Query vazia' }
    }

    // Busca: pelo menos UMA palavra casa em nome OU sku (busca abrangente)
    const where = {
      usuarioId: userId,
      ativo: true,
      OR: palavras.flatMap(p => [
        { nome: { contains: p, mode: 'insensitive' as const } },
        { sku: { contains: p, mode: 'insensitive' as const } },
      ]),
    }

    // Pega um pool maior pra rankear (até 5x o limite final), aí ordena por relevância
    const pool = await prisma.produto.findMany({
      where,
      select: { id: true, nome: true, sku: true, peso: true, cubagem: true, estoque: true, ativo: true },
      take: Math.max(max * 5, 100),
    })

    // Ranking: score = nº de palavras (case-insensitive) que aparecem no nome+sku.
    // Empate desempata por menor nome (mais "específico").
    const palavrasLower = palavras.map(p => p.toLowerCase())
    const scored = pool.map(p => {
      const haystack = `${p.nome} ${p.sku}`.toLowerCase()
      const score = palavrasLower.filter(pal => haystack.includes(pal)).length
      return { p, score }
    })
    scored.sort((a, b) =>
      b.score - a.score
      || a.p.nome.length - b.p.nome.length
      || a.p.nome.localeCompare(b.p.nome)
    )

    // Conta total no banco pra informar truncamento
    const totalMatch = await prisma.produto.count({ where })

    const top = scored.slice(0, max)
    return {
      total: top.length,
      totalMatch,
      truncado: totalMatch > top.length,
      palavrasBuscadas: palavras,
      produtos: top.map(({ p, score }) => ({
        id: p.id,
        sku: p.sku,
        nome: p.nome,
        peso: Number(p.peso),
        cubagem: Number(p.cubagem),
        estoque: p.estoque,
        ativo: p.ativo,
        palavrasCasadas: score,
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
