/**
 * Tipos helper para queries Prisma com includes
 * Evita uso de 'as any' e mantém type safety completo
 */

import { Prisma } from '@prisma/client'

/**
 * TransportadoraRegiao com relações completas
 */
export type TransportadoraRegiaoWithRelations = Prisma.TransportadoraRegiaoGetPayload<{
  include: {
    transportadora: true
    precos: {
      orderBy: {
        pesoInicial: 'asc'
      }
    }
    kgAdicional: true
  }
}>

/**
 * TransportadoraRegiao com taxas
 */
export type TransportadoraRegiaoWithTaxas = Prisma.TransportadoraRegiaoGetPayload<{
  include: {
    transportadora: true
    taxas: true
  }
}>

/**
 * TransportadoraRegiao com kg adicional
 */
export type TransportadoraRegiaoWithKgAdicional = Prisma.TransportadoraRegiaoGetPayload<{
  include: {
    kgAdicional: true
  }
}>

/**
 * Produto com produtoPaiId (para variações)
 */
export type ProdutoWithProdutoPaiId = Prisma.ProdutoGetPayload<{
  select: {
    id: true
    nome: true
    sku: true
    peso: true
    cubagem: true
    produtoPaiId: true
    usarDadosPaiParaVariacoes: true
    crossDocking: true
    estoque: true
    ativo: true
    usuarioId: true
  }
}>

/**
 * UsuarioIntegracaoCanal com config
 */
export type IntegracaoWithConfig = Prisma.UsuarioIntegracaoCanalGetPayload<{
  include: {
    canal: true
  }
}>
