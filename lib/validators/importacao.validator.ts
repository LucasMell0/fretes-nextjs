import { z } from 'zod'

const tipoTaxaEnum = z.enum(['PERCENTUAL', 'VALOR', 'percentual', 'valor'])

export const faixaPesoSchema = z.object({
  pesoInicial: z.number().min(0),
  pesoFinal: z.number().min(0),
  valor: z.number().min(0),
  prazo: z.number().int().min(0),
})

export const taxasRegiaoSchema = z.object({
  freteTipo: tipoTaxaEnum.transform(v => v.toUpperCase() as 'PERCENTUAL' | 'VALOR'),
  freteValor: z.number().min(0),
  freteMinimo: z.number().min(0),
  grisTipo: tipoTaxaEnum.transform(v => v.toUpperCase() as 'PERCENTUAL' | 'VALOR'),
  grisValor: z.number().min(0),
  grisMinimo: z.number().min(0),
  despachoTipo: tipoTaxaEnum.transform(v => v.toUpperCase() as 'PERCENTUAL' | 'VALOR'),
  despachoValor: z.number().min(0),
  despachoMinimo: z.number().min(0),
  pedagioValor: z.number().min(0),
  tasTipo: tipoTaxaEnum.transform(v => v.toUpperCase() as 'PERCENTUAL' | 'VALOR'),
  tasValor: z.number().min(0),
  tasMinimo: z.number().min(0),
  tdaAtivo: z.boolean(),
  tdaTipo: tipoTaxaEnum.transform(v => v.toUpperCase() as 'PERCENTUAL' | 'VALOR'),
  tdaValor: z.number().min(0),
  tdaMinimo: z.number().min(0),
  tdeAtivo: z.boolean(),
  tdeTipo: tipoTaxaEnum.transform(v => v.toUpperCase() as 'PERCENTUAL' | 'VALOR'),
  tdeValor: z.number().min(0),
  tdeMinimo: z.number().min(0),
  trfAtivo: z.boolean(),
  trfTipo: tipoTaxaEnum.transform(v => v.toUpperCase() as 'PERCENTUAL' | 'VALOR'),
  trfValor: z.number().min(0),
  trfMinimo: z.number().min(0),
  seguroFluvialAtivo: z.boolean(),
  seguroFluvialTipo: tipoTaxaEnum.transform(v => v.toUpperCase() as 'PERCENTUAL' | 'VALOR'),
  seguroFluvialValor: z.number().min(0),
  seguroFluvialMinimo: z.number().min(0),
  trtAtivo: z.boolean(),
  trtTipo: tipoTaxaEnum.transform(v => v.toUpperCase() as 'PERCENTUAL' | 'VALOR'),
  trtValor: z.number().min(0),
  trtMinimo: z.number().min(0),
  suframaAtivo: z.boolean(),
  suframaTipo: tipoTaxaEnum.transform(v => v.toUpperCase() as 'PERCENTUAL' | 'VALOR'),
  suframaValor: z.number().min(0),
  suframaMinimo: z.number().min(0),
})

export const regiaoParaImportarSchema = z.object({
  nome: z.string().min(1, 'Nome da região é obrigatório'),
  cepInicio: z.string().regex(/^\d{5}-?\d{3}$/, 'CEP inicial inválido'),
  cepFim: z.string().regex(/^\d{5}-?\d{3}$/, 'CEP final inválido'),
  icms: z.number().min(0).max(100),
  kgAdicional: z.number().min(0),
  taxas: taxasRegiaoSchema,
  faixas: z.array(faixaPesoSchema).min(1, 'Pelo menos uma faixa de peso é obrigatória'),
})

export const importacaoRequestSchema = z.object({
  transportadoraId: z.number().int().positive(),
  regioes: z.array(regiaoParaImportarSchema).min(1, 'Pelo menos uma região é obrigatória'),
})

export type ImportacaoRequest = z.infer<typeof importacaoRequestSchema>
