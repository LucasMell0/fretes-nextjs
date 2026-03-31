export interface ProdutoCotacao {
  sku: string
  quantidade: number
  valor?: number
  altura?: number
  largura?: number
  comprimento?: number
  peso?: number
}

export interface ResultadoCotacao {
  transportadora_id: number
  transportadora_nome: string
  valor_frete: number
  prazo_entrega: number
  peso_real: number
  peso_cubado: number
  peso_taxado: number
  peso_final: number
  detalhes: {
    valor_base: number
    valor_kg_adicional: number
    valor_taxas: number
    valor_icms: number
    taxas_aplicadas: TaxaAplicada[]
    faixa_utilizada: string
  }
}

export interface TaxaAplicada {
  nome: string
  tipo: 'FIXO' | 'PERCENTUAL'
  valor: number
  valor_calculado: number
}

export interface CotacaoRequest {
  cep: string
  produtos: ProdutoCotacao[]
  origem?: string
  marketplace?: string
}

export interface CotacaoResponse {
  sucesso: boolean
  cotacoes: ResultadoCotacao[]
  melhor_cotacao?: ResultadoCotacao
  total_transportadoras: number
  mensagem?: string
}

export interface TransportadoraRegiao {
  id: number
  transportadoraId: number
  transportadora: {
    id: number
    nome: string
    prazoBase: number
    ativo: boolean
  }
  cepInicio: string
  cepFim: string
  icms: number
  precos: FaixaPreco[]
  kgAdicional: KgAdicional | null
  taxas: TaxasRegiao | null
}

export interface FaixaPreco {
  id: number
  pesoInicial: number
  pesoFinal: number
  valor: number
  prazo: number
}

export interface KgAdicional {
  id: number
  valorKgAdicional: number
}

export interface TaxasRegiao {
  id: number
  freteValorTipo: 'PERCENTUAL' | 'VALOR'
  freteValor: number
  freteValorMinimo: number
  grisTipo: 'PERCENTUAL' | 'VALOR'
  grisValor: number
  grisMinimo: number
  despachoTipo: 'PERCENTUAL' | 'VALOR'
  despachoValor: number
  despachoMinimo: number
  pedagioValor: number
  tasTipo: 'PERCENTUAL' | 'VALOR'
  tasValor: number
  tasMinimo: number
  tdaAtivo: boolean
  tdaTipo: 'PERCENTUAL' | 'VALOR'
  tdaValor: number
  tdaMinimo: number
  tdeAtivo: boolean
  tdeTipo: 'PERCENTUAL' | 'VALOR'
  tdeValor: number
  tdeMinimo: number
  trfAtivo: boolean
  trfTipo: 'PERCENTUAL' | 'VALOR'
  trfValor: number
  trfMinimo: number
  seguroFluvialAtivo: boolean
  seguroFluvialTipo: 'PERCENTUAL' | 'VALOR'
  seguroFluvialValor: number
  seguroFluvialMinimo: number
  trtAtivo: boolean
  trtTipo: 'PERCENTUAL' | 'VALOR'
  trtValor: number
  trtMinimo: number
  suframaAtivo: boolean
  suframaTipo: 'PERCENTUAL' | 'VALOR'
  suframaValor: number
  suframaMinimo: number
}

export interface ProdutoDB {
  id: number
  sku: string
  nome: string
  peso: number
  cubagem: number
  crossDocking: number
  ativo: boolean
  cubagens: CubagemProduto[]
}

export interface CubagemProduto {
  id: number
  transportadoraId: number
  cubagem: number
}
