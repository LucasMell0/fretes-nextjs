import { prisma } from '@/lib/prisma'
import type { Tool, ToolContext } from './types'
import type { Operacao } from '../operacoes/schemas'
import { buscarFaixasCep } from '../faixas-cep-brasil'

/**
 * Tools do Agente de Escrita.
 *
 * Tools de LEITURA (resolver referências) executam no banco e retornam dados pra o LLM.
 * Tools de ESCRITA (propor operações) NÃO executam — apenas acumulam a operação
 * no Plano de Mudanças. A aplicação acontece depois, no endpoint /aplicar-plano,
 * após aprovação humana.
 *
 * O acumulador de plano é passado via `ctx.planoAcc.push(op)` (extensão do ToolContext).
 */

export interface EscritaToolContext extends ToolContext {
  planoAcc: Operacao[]
}

// ── LEITURA ───────────────────────────────────────────────────────────────

const listarTransportadoras: Tool = {
  definition: {
    type: 'function',
    function: {
      name: 'listar_transportadoras',
      description: 'Lista TODAS as transportadoras do usuário (ativas e inativas) com id, nome, fatorCubagem, margemLucro, ativo e dataAtualizacao. Use a dataAtualizacao em operações de UPDATE/DELETE para optimistic locking.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  async execute(_args, { userId }: ToolContext) {
    const ts = await prisma.transportadora.findMany({
      where: { usuarioId: userId },
      select: { id: true, nome: true, fatorCubagem: true, margemLucro: true, ativo: true, dataAtualizacao: true },
      orderBy: { nome: 'asc' },
    })
    return ts.map(t => ({
      ...t,
      fatorCubagem: Number(t.fatorCubagem),
      margemLucro: Number(t.margemLucro),
      dataAtualizacao: t.dataAtualizacao.toISOString(),
    }))
  },
}

const listarRegioes: Tool<{ transportadoraId?: number }> = {
  definition: {
    type: 'function',
    function: {
      name: 'listar_regioes',
      description: 'Lista regiões do usuário. Se transportadoraId for fornecido, filtra por aquela transportadora. Retorna id, nome, cepInicio, cepFim, ativo, dataAtualizacao e contagens (faixas, taxas, kgAdicional).',
      parameters: {
        type: 'object',
        properties: {
          transportadoraId: { type: 'integer', description: 'ID da transportadora (opcional)' },
        },
        additionalProperties: false,
      },
    },
  },
  async execute({ transportadoraId }, { userId }: ToolContext) {
    const regioes = await prisma.transportadoraRegiao.findMany({
      where: { usuarioId: userId, ...(transportadoraId ? { transportadoraId } : {}) },
      select: {
        id: true, transportadoraId: true, nome: true, cepInicio: true, cepFim: true, ativo: true,
        dataAtualizacao: true,
        _count: { select: { precos: true } },
        kgAdicional: { select: { id: true } },
        taxas: { select: { id: true } },
      },
      orderBy: { nome: 'asc' },
    })
    return regioes.map(r => ({
      id: r.id,
      transportadoraId: r.transportadoraId,
      nome: r.nome,
      cepInicio: r.cepInicio,
      cepFim: r.cepFim,
      ativo: r.ativo,
      dataAtualizacao: r.dataAtualizacao.toISOString(),
      qtdFaixas: r._count.precos,
      temKgAdicional: !!r.kgAdicional,
      temTaxas: !!r.taxas,
    }))
  },
}

const obterRegiao: Tool<{ regiaoId: number }> = {
  definition: {
    type: 'function',
    function: {
      name: 'obter_regiao',
      description: 'Devolve uma região com TODAS as suas faixas de peso (preços), kg adicional e taxas completas. Use antes de propor edição/exclusão.',
      parameters: {
        type: 'object',
        properties: { regiaoId: { type: 'integer' } },
        required: ['regiaoId'],
        additionalProperties: false,
      },
    },
  },
  async execute({ regiaoId }, { userId }: ToolContext) {
    const r = await prisma.transportadoraRegiao.findFirst({
      where: { id: regiaoId, usuarioId: userId },
      include: {
        precos: { orderBy: { pesoInicial: 'asc' } },
        kgAdicional: true,
        taxas: true,
      },
    })
    if (!r) return { erro: 'Região não encontrada' }
    return {
      id: r.id,
      transportadoraId: r.transportadoraId,
      nome: r.nome,
      cepInicio: r.cepInicio,
      cepFim: r.cepFim,
      ativo: r.ativo,
      dataAtualizacao: r.dataAtualizacao.toISOString(),
      faixas: r.precos.map(p => ({
        id: p.id,
        pesoInicial: Number(p.pesoInicial),
        pesoFinal: Number(p.pesoFinal),
        valor: Number(p.valor),
        prazo: p.prazo,
        dataAtualizacao: p.dataAtualizacao.toISOString(),
      })),
      kgAdicional: r.kgAdicional ? { id: r.kgAdicional.id, valor: Number(r.kgAdicional.valorKgAdicional) } : null,
      taxas: r.taxas
        ? Object.fromEntries(
            Object.entries(r.taxas).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : (typeof v === 'object' && v !== null ? Number(v) : v)])
          )
        : null,
    }
  },
}

const obterFaixaCep: Tool<{ query: string }> = {
  definition: {
    type: 'function',
    function: {
      name: 'obter_faixa_cep',
      description: 'OBRIGATÓRIO antes de propor criar/editar uma região: consulta a tabela oficial de faixas de CEP do Brasil pela localidade que o usuário mencionou (ex: "Salvador", "BA capital", "Grande SP", "interior do RS"). Retorna até 8 candidatos com cepInicio/cepFim. NUNCA invente ou chute faixas de CEP.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Cidade, estado, sigla ou apelido. Ex: "Salvador", "BA capital", "Recife", "RS interior".' },
        },
        required: ['query'],
        additionalProperties: false,
      },
    },
  },
  async execute({ query }) {
    const resultados = buscarFaixasCep(query)
    if (resultados.length === 0) {
      return {
        encontrados: 0,
        aviso: `Nenhuma faixa de CEP corresponde a "${query}". Peça ao usuário pra informar diretamente o cepInicio e cepFim.`,
      }
    }
    return {
      encontrados: resultados.length,
      faixas: resultados.map(f => ({
        estado: f.estado,
        sigla: f.sigla,
        regiao: f.regiao,
        cepInicio: f.cepInicio,
        cepFim: f.cepFim,
      })),
    }
  },
}

// ── ESCRITA (acumuladoras) ────────────────────────────────────────────────

function makeAcumuladora<T extends Operacao>(
  name: string,
  description: string,
  parameters: object
): Tool<T> {
  return {
    definition: {
      type: 'function',
      function: { name, description, parameters: parameters as Record<string, unknown> },
    },
    async execute(args: T, ctx) {
      const escritaCtx = ctx as EscritaToolContext
      escritaCtx.planoAcc.push(args as unknown as Operacao)
      return { ok: true, registrado: args }
    },
  }
}

// JSON Schemas das operações (espelham o Zod, em formato OpenAI)
const proporCriarTransportadora = makeAcumuladora(
  'propor_criar_transportadora',
  'Adiciona ao Plano de Mudanças uma operação de criar Transportadora.',
  {
    type: 'object',
    properties: {
      tipo: { type: 'string', enum: ['criar_transportadora'] },
      nome: { type: 'string' },
      fatorCubagem: { type: 'number', description: 'Padrão 300' },
      margemLucro: { type: 'number', description: 'Em %, padrão 0' },
    },
    required: ['tipo', 'nome'],
    additionalProperties: false,
  }
)

const proporEditarTransportadora = makeAcumuladora(
  'propor_editar_transportadora',
  'Adiciona ao Plano uma operação de editar Transportadora. Use dataAtualizacaoEsperada obtida em listar_transportadoras.',
  {
    type: 'object',
    properties: {
      tipo: { type: 'string', enum: ['editar_transportadora'] },
      id: { type: 'integer' },
      dataAtualizacaoEsperada: { type: 'string' },
      nome: { type: 'string' },
      fatorCubagem: { type: 'number' },
      margemLucro: { type: 'number' },
      ativo: { type: 'boolean' },
    },
    required: ['tipo', 'id', 'dataAtualizacaoEsperada'],
    additionalProperties: false,
  }
)

const proporExcluirTransportadora = makeAcumuladora(
  'propor_excluir_transportadora',
  'Adiciona ao Plano uma exclusão de Transportadora (e suas regiões em cascata). Atenção: pode falhar por FK se houver cotações históricas — nesse caso, sugira ao usuário desativar (ativo=false) em vez de excluir.',
  {
    type: 'object',
    properties: {
      tipo: { type: 'string', enum: ['excluir_transportadora'] },
      id: { type: 'integer' },
      dataAtualizacaoEsperada: { type: 'string' },
    },
    required: ['tipo', 'id', 'dataAtualizacaoEsperada'],
    additionalProperties: false,
  }
)

const proporCriarRegiao = makeAcumuladora(
  'propor_criar_regiao',
  'Adiciona ao Plano uma operação de criar Região (faixa de CEP) para uma transportadora.',
  {
    type: 'object',
    properties: {
      tipo: { type: 'string', enum: ['criar_regiao'] },
      transportadoraId: {
        description: 'ID numérico de uma transportadora EXISTENTE, ou placeholder "@op:N" onde N é o índice (0-based) da operação propor_criar_transportadora no MESMO plano. PREFIRA @op:N — o nome pode ser editado pelo usuário e quebrar referências por nome.',
        oneOf: [
          { type: 'integer' },
          { type: 'string', pattern: '^@op:\\d+$' },
        ],
      },
      nome: { type: 'string' },
      cepInicio: { type: 'string', description: 'CEP no formato 00000-000 ou 00000000' },
      cepFim: { type: 'string' },
    },
    required: ['tipo', 'transportadoraId', 'nome', 'cepInicio', 'cepFim'],
    additionalProperties: false,
  }
)

const proporEditarRegiao = makeAcumuladora(
  'propor_editar_regiao',
  'Adiciona ao Plano uma operação de editar Região.',
  {
    type: 'object',
    properties: {
      tipo: { type: 'string', enum: ['editar_regiao'] },
      id: { type: 'integer' },
      dataAtualizacaoEsperada: { type: 'string' },
      nome: { type: 'string' },
      cepInicio: { type: 'string' },
      cepFim: { type: 'string' },
      ativo: { type: 'boolean' },
    },
    required: ['tipo', 'id', 'dataAtualizacaoEsperada'],
    additionalProperties: false,
  }
)

const proporExcluirRegiao = makeAcumuladora(
  'propor_excluir_regiao',
  'Adiciona ao Plano uma exclusão de Região (e suas faixas, kg adicional e taxas em cascata).',
  {
    type: 'object',
    properties: {
      tipo: { type: 'string', enum: ['excluir_regiao'] },
      id: { type: 'integer' },
      dataAtualizacaoEsperada: { type: 'string' },
    },
    required: ['tipo', 'id', 'dataAtualizacaoEsperada'],
    additionalProperties: false,
  }
)

const proporCriarFaixaPeso = makeAcumuladora(
  'propor_criar_faixa_peso',
  'Adiciona ao Plano uma faixa de preço por peso (pesoInicial-pesoFinal, valor R$, prazo em dias) para uma região.',
  {
    type: 'object',
    properties: {
      tipo: { type: 'string', enum: ['criar_faixa_peso'] },
      regiaoId: {
        description: 'ID numérico de uma região EXISTENTE, ou placeholder "@op:N" onde N é o índice (0-based) da operação propor_criar_regiao no MESMO plano. PREFIRA @op:N — o nome da região pode ser editado pelo usuário e quebrar referências por nome.',
        oneOf: [
          { type: 'integer' },
          { type: 'string', pattern: '^@op:\\d+$' },
        ],
      },
      pesoInicial: { type: 'number' },
      pesoFinal: { type: 'number' },
      valor: { type: 'number' },
      prazo: { type: 'integer' },
    },
    required: ['tipo', 'regiaoId', 'pesoInicial', 'pesoFinal', 'valor', 'prazo'],
    additionalProperties: false,
  }
)

const proporEditarFaixaPeso = makeAcumuladora(
  'propor_editar_faixa_peso',
  'Adiciona ao Plano uma edição de faixa de peso existente.',
  {
    type: 'object',
    properties: {
      tipo: { type: 'string', enum: ['editar_faixa_peso'] },
      id: { type: 'integer' },
      dataAtualizacaoEsperada: { type: 'string' },
      pesoInicial: { type: 'number' },
      pesoFinal: { type: 'number' },
      valor: { type: 'number' },
      prazo: { type: 'integer' },
    },
    required: ['tipo', 'id', 'dataAtualizacaoEsperada'],
    additionalProperties: false,
  }
)

const proporExcluirFaixaPeso = makeAcumuladora(
  'propor_excluir_faixa_peso',
  'Adiciona ao Plano uma exclusão de faixa de peso.',
  {
    type: 'object',
    properties: {
      tipo: { type: 'string', enum: ['excluir_faixa_peso'] },
      id: { type: 'integer' },
      dataAtualizacaoEsperada: { type: 'string' },
    },
    required: ['tipo', 'id', 'dataAtualizacaoEsperada'],
    additionalProperties: false,
  }
)

const proporDefinirKgAdicional = makeAcumuladora(
  'propor_definir_kg_adicional',
  'Define (upsert) o valor por kg adicional de uma região.',
  {
    type: 'object',
    properties: {
      tipo: { type: 'string', enum: ['definir_kg_adicional'] },
      regiaoId: {
        description: 'ID numérico de uma região EXISTENTE, ou placeholder "@op:N" onde N é o índice (0-based) da operação propor_criar_regiao no MESMO plano. PREFIRA @op:N — o nome da região pode ser editado pelo usuário e quebrar referências por nome.',
        oneOf: [
          { type: 'integer' },
          { type: 'string', pattern: '^@op:\\d+$' },
        ],
      },
      valorKgAdicional: { type: 'number' },
    },
    required: ['tipo', 'regiaoId', 'valorKgAdicional'],
    additionalProperties: false,
  }
)

const proporDefinirTaxas = makeAcumuladora(
  'propor_definir_taxas',
  'Define (upsert) as taxas de uma região. Cada sub-objeto (frete, gris, despacho, etc) é opcional; só atualiza os fornecidos. Tipos válidos: "PERCENTUAL" ou "VALOR".',
  {
    type: 'object',
    properties: {
      tipo: { type: 'string', enum: ['definir_taxas'] },
      regiaoId: {
        description: 'ID numérico de uma região EXISTENTE, ou placeholder "@op:N" onde N é o índice (0-based) da operação propor_criar_regiao no MESMO plano. PREFIRA @op:N — o nome da região pode ser editado pelo usuário e quebrar referências por nome.',
        oneOf: [
          { type: 'integer' },
          { type: 'string', pattern: '^@op:\\d+$' },
        ],
      },
      frete: { type: 'object', properties: { tipo: { type: 'string', enum: ['PERCENTUAL', 'VALOR'] }, valor: { type: 'number' }, minimo: { type: 'number' } } },
      gris: { type: 'object', properties: { tipo: { type: 'string', enum: ['PERCENTUAL', 'VALOR'] }, valor: { type: 'number' }, minimo: { type: 'number' } } },
      despacho: { type: 'object', properties: { tipo: { type: 'string', enum: ['PERCENTUAL', 'VALOR'] }, valor: { type: 'number' }, minimo: { type: 'number' } } },
      pedagioValor: { type: 'number' },
      tas: { type: 'object', properties: { tipo: { type: 'string', enum: ['PERCENTUAL', 'VALOR'] }, valor: { type: 'number' }, minimo: { type: 'number' } } },
      tda: { type: 'object', properties: { ativo: { type: 'boolean' }, tipo: { type: 'string', enum: ['PERCENTUAL', 'VALOR'] }, valor: { type: 'number' }, minimo: { type: 'number' } } },
      tde: { type: 'object', properties: { ativo: { type: 'boolean' }, tipo: { type: 'string', enum: ['PERCENTUAL', 'VALOR'] }, valor: { type: 'number' }, minimo: { type: 'number' } } },
      trf: { type: 'object', properties: { ativo: { type: 'boolean' }, tipo: { type: 'string', enum: ['PERCENTUAL', 'VALOR'] }, valor: { type: 'number' }, minimo: { type: 'number' } } },
      seguroFluvial: { type: 'object', properties: { ativo: { type: 'boolean' }, tipo: { type: 'string', enum: ['PERCENTUAL', 'VALOR'] }, valor: { type: 'number' }, minimo: { type: 'number' } } },
      trt: { type: 'object', properties: { ativo: { type: 'boolean' }, tipo: { type: 'string', enum: ['PERCENTUAL', 'VALOR'] }, valor: { type: 'number' }, minimo: { type: 'number' } } },
      suframa: { type: 'object', properties: { ativo: { type: 'boolean' }, tipo: { type: 'string', enum: ['PERCENTUAL', 'VALOR'] }, valor: { type: 'number' }, minimo: { type: 'number' } } },
      icms: { type: 'number' },
    },
    required: ['tipo', 'regiaoId'],
    additionalProperties: false,
  }
)

const proporEditarProduto = makeAcumuladora(
  'propor_editar_produto',
  'Adiciona ao Plano uma edição de Produto (nome, peso ou cubagem padrão, status ativo).',
  {
    type: 'object',
    properties: {
      tipo: { type: 'string', enum: ['editar_produto'] },
      id: { type: 'integer' },
      dataAtualizacaoEsperada: { type: 'string' },
      nome: { type: 'string' },
      peso: { type: 'number' },
      cubagem: { type: 'number' },
      ativo: { type: 'boolean' },
    },
    required: ['tipo', 'id', 'dataAtualizacaoEsperada'],
    additionalProperties: false,
  }
)

// Tool de busca de produtos com dataAtualizacao incluída (pro Escrita)
const buscarProduto: Tool<{ query: string; limite?: number }> = {
  definition: {
    type: 'function',
    function: {
      name: 'buscar_produto',
      description: 'Busca produtos do usuário por nome ou SKU (OR de palavras, ranking por relevância). Retorna id, sku, nome, peso, cubagem, ativo, dataAtualizacao. Use a dataAtualizacao em propor_editar_produto.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          limite: { type: 'integer', description: 'Padrão 25, máximo 50' },
        },
        required: ['query'],
        additionalProperties: false,
      },
    },
  },
  async execute({ query, limite }, { userId }: ToolContext) {
    const max = Math.min(limite ?? 25, 50)
    const palavras = query.trim().split(/\s+/).filter(Boolean)
    if (palavras.length === 0) return { total: 0, produtos: [] }
    const where = {
      usuarioId: userId,
      ativo: true,
      OR: palavras.flatMap(p => [
        { nome: { contains: p, mode: 'insensitive' as const } },
        { sku: { contains: p, mode: 'insensitive' as const } },
      ]),
    }
    const pool = await prisma.produto.findMany({
      where,
      select: { id: true, nome: true, sku: true, peso: true, cubagem: true, ativo: true, dataAtualizacao: true },
      take: Math.max(max * 5, 100),
    })
    const palavrasLower = palavras.map(p => p.toLowerCase())
    const scored = pool.map(p => {
      const h = `${p.nome} ${p.sku}`.toLowerCase()
      return { p, score: palavrasLower.filter(pal => h.includes(pal)).length }
    })
    scored.sort((a, b) => b.score - a.score || a.p.nome.length - b.p.nome.length)
    return {
      total: scored.length,
      produtos: scored.slice(0, max).map(({ p }) => ({
        id: p.id,
        sku: p.sku,
        nome: p.nome,
        peso: Number(p.peso),
        cubagem: Number(p.cubagem),
        ativo: p.ativo,
        dataAtualizacao: p.dataAtualizacao.toISOString(),
      })),
    }
  },
}

export const escritaTools: Record<string, Tool> = {
  // Leitura
  listar_transportadoras: listarTransportadoras,
  listar_regioes: listarRegioes as unknown as Tool,
  obter_regiao: obterRegiao as unknown as Tool,
  buscar_produto: buscarProduto as unknown as Tool,
  obter_faixa_cep: obterFaixaCep as unknown as Tool,
  // Escrita (acumuladoras)
  propor_criar_transportadora: proporCriarTransportadora as unknown as Tool,
  propor_editar_transportadora: proporEditarTransportadora as unknown as Tool,
  propor_excluir_transportadora: proporExcluirTransportadora as unknown as Tool,
  propor_criar_regiao: proporCriarRegiao as unknown as Tool,
  propor_editar_regiao: proporEditarRegiao as unknown as Tool,
  propor_excluir_regiao: proporExcluirRegiao as unknown as Tool,
  propor_criar_faixa_peso: proporCriarFaixaPeso as unknown as Tool,
  propor_editar_faixa_peso: proporEditarFaixaPeso as unknown as Tool,
  propor_excluir_faixa_peso: proporExcluirFaixaPeso as unknown as Tool,
  propor_definir_kg_adicional: proporDefinirKgAdicional as unknown as Tool,
  propor_definir_taxas: proporDefinirTaxas as unknown as Tool,
  propor_editar_produto: proporEditarProduto as unknown as Tool,
}

export const TIPOS_PROPOSTA = new Set([
  'criar_transportadora', 'editar_transportadora', 'excluir_transportadora',
  'criar_regiao', 'editar_regiao', 'excluir_regiao',
  'criar_faixa_peso', 'editar_faixa_peso', 'excluir_faixa_peso',
  'definir_kg_adicional', 'definir_taxas',
  'editar_produto',
])
