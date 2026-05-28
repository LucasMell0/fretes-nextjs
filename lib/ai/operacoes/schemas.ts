import { z } from 'zod'

/**
 * Schemas Zod de todas as operações que o Agente de Escrita pode propor.
 * Usados tanto na validação das tool calls quanto no endpoint de aplicar-plano.
 *
 * Convenção de optimistic locking:
 * - Operações de UPDATE/DELETE em entidades versionadas carregam `dataAtualizacaoEsperada`
 *   (ISO string da `dataAtualizacao` que o LLM observou ao gerar o plano).
 * - O endpoint /aplicar-plano valida que esse carimbo ainda bate; se mudou, rola a transação atrás.
 */

const cep = z.string().regex(/^\d{5}-?\d{3}$/, 'CEP inválido')

// ── Transportadora ─────────────────────────────────────────────────────────
export const opCriarTransportadora = z.object({
  tipo: z.literal('criar_transportadora'),
  nome: z.string().min(1).max(200),
  fatorCubagem: z.number().min(0).optional().default(300),
  margemLucro: z.number().min(0).max(100).optional().default(0),
})
export const opEditarTransportadora = z.object({
  tipo: z.literal('editar_transportadora'),
  id: z.number().int().positive(),
  dataAtualizacaoEsperada: z.string().datetime(),
  nome: z.string().min(1).max(200).optional(),
  fatorCubagem: z.number().min(0).optional(),
  margemLucro: z.number().min(0).max(100).optional(),
  ativo: z.boolean().optional(),
})
export const opExcluirTransportadora = z.object({
  tipo: z.literal('excluir_transportadora'),
  id: z.number().int().positive(),
  dataAtualizacaoEsperada: z.string().datetime(),
})

// ── Região ─────────────────────────────────────────────────────────────────
export const opCriarRegiao = z.object({
  tipo: z.literal('criar_regiao'),
  transportadoraId: z.union([z.number().int().positive(), z.string()]),
  nome: z.string().min(1).max(100),
  cepInicio: cep,
  cepFim: cep,
})
export const opEditarRegiao = z.object({
  tipo: z.literal('editar_regiao'),
  id: z.number().int().positive(),
  dataAtualizacaoEsperada: z.string().datetime(),
  nome: z.string().min(1).max(100).optional(),
  cepInicio: cep.optional(),
  cepFim: cep.optional(),
  ativo: z.boolean().optional(),
})
export const opExcluirRegiao = z.object({
  tipo: z.literal('excluir_regiao'),
  id: z.number().int().positive(),
  dataAtualizacaoEsperada: z.string().datetime(),
})

// ── Faixa de Peso ──────────────────────────────────────────────────────────
export const opCriarFaixaPeso = z.object({
  tipo: z.literal('criar_faixa_peso'),
  regiaoId: z.union([z.number().int().positive(), z.string()]),
  pesoInicial: z.number().min(0),
  pesoFinal: z.number().min(0),
  valor: z.number().min(0),
  prazo: z.number().int().min(0),
})

export const opEditarFaixaPeso = z.object({
  tipo: z.literal('editar_faixa_peso'),
  id: z.number().int().positive(),
  dataAtualizacaoEsperada: z.string().datetime(),
  pesoInicial: z.number().min(0).optional(),
  pesoFinal: z.number().min(0).optional(),
  valor: z.number().min(0).optional(),
  prazo: z.number().int().min(0).optional(),
})
export const opExcluirFaixaPeso = z.object({
  tipo: z.literal('excluir_faixa_peso'),
  id: z.number().int().positive(),
  dataAtualizacaoEsperada: z.string().datetime(),
})

// ── Kg Adicional ───────────────────────────────────────────────────────────
export const opDefinirKgAdicional = z.object({
  tipo: z.literal('definir_kg_adicional'),
  regiaoId: z.union([z.number().int().positive(), z.string()]),
  valorKgAdicional: z.number().min(0),
})

// ── Taxas da Região ────────────────────────────────────────────────────────
const tipoTaxa = z.enum(['PERCENTUAL', 'VALOR'])
export const opDefinirTaxas = z.object({
  tipo: z.literal('definir_taxas'),
  regiaoId: z.union([z.number().int().positive(), z.string()]),
  // Cada uma das 12 taxas é opcional; só atualiza as fornecidas
  frete: z.object({ tipo: tipoTaxa.optional(), valor: z.number().optional(), minimo: z.number().optional() }).optional(),
  gris: z.object({ tipo: tipoTaxa.optional(), valor: z.number().optional(), minimo: z.number().optional() }).optional(),
  despacho: z.object({ tipo: tipoTaxa.optional(), valor: z.number().optional(), minimo: z.number().optional() }).optional(),
  pedagioValor: z.number().optional(),
  tas: z.object({ tipo: tipoTaxa.optional(), valor: z.number().optional(), minimo: z.number().optional() }).optional(),
  tda: z.object({ ativo: z.boolean().optional(), tipo: tipoTaxa.optional(), valor: z.number().optional(), minimo: z.number().optional() }).optional(),
  tde: z.object({ ativo: z.boolean().optional(), tipo: tipoTaxa.optional(), valor: z.number().optional(), minimo: z.number().optional() }).optional(),
  trf: z.object({ ativo: z.boolean().optional(), tipo: tipoTaxa.optional(), valor: z.number().optional(), minimo: z.number().optional() }).optional(),
  seguroFluvial: z.object({ ativo: z.boolean().optional(), tipo: tipoTaxa.optional(), valor: z.number().optional(), minimo: z.number().optional() }).optional(),
  trt: z.object({ ativo: z.boolean().optional(), tipo: tipoTaxa.optional(), valor: z.number().optional(), minimo: z.number().optional() }).optional(),
  suframa: z.object({ ativo: z.boolean().optional(), tipo: tipoTaxa.optional(), valor: z.number().optional(), minimo: z.number().optional() }).optional(),
  icms: z.number().min(0).max(100).optional(),
})

// ── Produto (peso/cubagem padrão) ──────────────────────────────────────────
export const opEditarProduto = z.object({
  tipo: z.literal('editar_produto'),
  id: z.number().int().positive(),
  dataAtualizacaoEsperada: z.string().datetime(),
  nome: z.string().min(3).max(200).optional(),
  peso: z.number().positive().optional(),
  cubagem: z.number().positive().optional(),
  ativo: z.boolean().optional(),
})

// ── Union ──────────────────────────────────────────────────────────────────
export const operacaoSchema = z.discriminatedUnion('tipo', [
  opCriarTransportadora,
  opEditarTransportadora,
  opExcluirTransportadora,
  opCriarRegiao,
  opEditarRegiao,
  opExcluirRegiao,
  opCriarFaixaPeso,
  opEditarFaixaPeso,
  opExcluirFaixaPeso,
  opDefinirKgAdicional,
  opDefinirTaxas,
  opEditarProduto,
])

export type Operacao = z.infer<typeof operacaoSchema>
export type TipoOperacao = Operacao['tipo']
