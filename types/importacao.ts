export interface ImportacaoCSVRow {
  // Região
  REGIAO: string
  CEP_INICIAL: string
  CEP_FINAL: string
  ICMS: string
  
  // Faixa de peso
  PESO_INICIAL: string
  PESO_FINAL: string
  VALOR: string
  PRAZO: string
  KG_ADICIONAL: string
  
  // Taxas fixas - Frete
  FRETE_VALOR_TIPO: string
  FRETE_VALOR: string
  FRETE_VALOR_MINIMO: string
  
  // GRIS
  GRIS_TIPO: string
  GRIS_VALOR: string
  GRIS_MINIMO: string
  
  // Despacho
  DESPACHO_TIPO: string
  DESPACHO_VALOR: string
  DESPACHO_MINIMO: string
  
  // Pedágio
  PEDAGIO_VALOR: string
  
  // TAS
  TAS_TIPO: string
  TAS_VALOR: string
  TAS_MINIMO: string
  
  // Taxas opcionais - TDA
  TDA_ATIVO?: string
  TDA_TIPO?: string
  TDA_VALOR?: string
  TDA_MINIMO?: string
  
  // TDE
  TDE_ATIVO?: string
  TDE_TIPO?: string
  TDE_VALOR?: string
  TDE_MINIMO?: string
  
  // TRF
  TRF_ATIVO?: string
  TRF_TIPO?: string
  TRF_VALOR?: string
  TRF_MINIMO?: string
  
  // Seguro Fluvial
  SEGURO_FLUVIAL_ATIVO?: string
  SEGURO_FLUVIAL_TIPO?: string
  SEGURO_FLUVIAL_VALOR?: string
  SEGURO_FLUVIAL_MINIMO?: string
  
  // TRT
  TRT_ATIVO?: string
  TRT_TIPO?: string
  TRT_VALOR?: string
  TRT_MINIMO?: string
  
  // SUFRAMA
  SUFRAMA_ATIVO?: string
  SUFRAMA_TIPO?: string
  SUFRAMA_VALOR?: string
  SUFRAMA_MINIMO?: string
}

export interface FaixaPeso {
  pesoInicial: number
  pesoFinal: number
  valor: number
  prazo: number
}

export interface TaxasRegiao {
  freteTipo: 'PERCENTUAL' | 'VALOR'
  freteValor: number
  freteMinimo: number
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

export interface RegiaoParaImportar {
  nome: string
  cepInicio: string
  cepFim: string
  icms: number
  kgAdicional: number
  taxas: TaxasRegiao
  faixas: FaixaPeso[]
}

export interface ResultadoImportacao {
  sucesso: boolean
  regioesImportadas: number
  faixasImportadas: number
  erros: ErroImportacao[]
}

export interface ErroImportacao {
  linha: number
  campo?: string
  mensagem: string
}

export interface PreviewImportacao {
  totalLinhas: number
  totalRegioes: number
  regioes: {
    nome: string
    cepInicio: string
    cepFim: string
    quantidadeFaixas: number
  }[]
  erros: ErroImportacao[]
}
