import { NextResponse } from 'next/server'

const CABECALHO = [
  'REGIAO',
  'CEP_INICIAL',
  'CEP_FINAL',
  'ICMS',
  'PESO_INICIAL',
  'PESO_FINAL',
  'VALOR',
  'PRAZO',
  'KG_ADICIONAL',
  'FRETE_VALOR_TIPO',
  'FRETE_VALOR',
  'FRETE_VALOR_MINIMO',
  'GRIS_TIPO',
  'GRIS_VALOR',
  'GRIS_MINIMO',
  'DESPACHO_TIPO',
  'DESPACHO_VALOR',
  'DESPACHO_MINIMO',
  'PEDAGIO_VALOR',
  'TAS_TIPO',
  'TAS_VALOR',
  'TAS_MINIMO',
  'TDA_ATIVO',
  'TDA_TIPO',
  'TDA_VALOR',
  'TDA_MINIMO',
  'TDE_ATIVO',
  'TDE_TIPO',
  'TDE_VALOR',
  'TDE_MINIMO',
  'TRF_ATIVO',
  'TRF_TIPO',
  'TRF_VALOR',
  'TRF_MINIMO',
  'SEGURO_FLUVIAL_ATIVO',
  'SEGURO_FLUVIAL_TIPO',
  'SEGURO_FLUVIAL_VALOR',
  'SEGURO_FLUVIAL_MINIMO',
  'TRT_ATIVO',
  'TRT_TIPO',
  'TRT_VALOR',
  'TRT_MINIMO',
  'SUFRAMA_ATIVO',
  'SUFRAMA_TIPO',
  'SUFRAMA_VALOR',
  'SUFRAMA_MINIMO'
]

const EXEMPLO1 = [
  'SP Capital', '01000-000', '05999-999', '12', '0', '50', '45.90', '3', '0.85',
  'percentual', '0', '7.97', 'percentual', '0.3', '8.97', 'valor', '18.72', '0',
  '7.47', 'valor', '5.50', '0', '0', 'valor', '0', '0', '0', 'valor', '0', '0',
  '0', 'valor', '0', '0', '0', 'percentual', '0', '0', '0', 'valor', '0', '0',
  '0', 'percentual', '0', '0'
]

const EXEMPLO2 = [
  'SP Capital', '01000-000', '05999-999', '12', '50', '100', '75.50', '3', '0.85',
  'percentual', '0', '7.97', 'percentual', '0.3', '8.97', 'valor', '18.72', '0',
  '7.47', 'valor', '5.50', '0', '0', 'valor', '0', '0', '0', 'valor', '0', '0',
  '0', 'valor', '0', '0', '0', 'percentual', '0', '0', '0', 'valor', '0', '0',
  '0', 'percentual', '0', '0'
]

const EXEMPLO3 = [
  'Interior SP', '06000-000', '19999-999', '12', '0', '50', '55.00', '5', '1.00',
  'percentual', '0', '7.97', 'percentual', '0.3', '8.97', 'valor', '22.50', '0',
  '9.50', 'valor', '5.50', '0', '1', 'valor', '15.00', '0', '0', 'valor', '0', '0',
  '0', 'valor', '0', '0', '0', 'percentual', '0', '0', '0', 'valor', '0', '0',
  '0', 'percentual', '0', '0'
]

function gerarCSV(): string {
  const linhas = [
    CABECALHO.join(';'),
    EXEMPLO1.join(';'),
    EXEMPLO2.join(';'),
    EXEMPLO3.join(';')
  ]
  
  return '\uFEFF' + linhas.join('\n')
}

export async function GET() {
  const csv = gerarCSV()
  
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="modelo_importacao_regioes.csv"'
    }
  })
}
