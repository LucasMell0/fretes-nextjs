/**
 * Tabela de faixas de CEP do Brasil organizada por estado/região.
 * Usada pela tool obter_faixa_cep do Agente de Escrita pra evitar que o LLM
 * chute faixas de CEP — agora ele consulta antes de propor.
 */

export interface FaixaCEP {
  estado: string
  sigla: string
  regiao: string
  /** Apelido(s) alternativo(s) pra match — ex: "salvador" pra "BA - Capital" */
  apelidos: string[]
  cepInicio: string
  cepFim: string
}

export const FAIXAS_CEP_BRASIL: FaixaCEP[] = [
  // SP
  { estado: 'São Paulo', sigla: 'SP', regiao: 'SP Capital', apelidos: ['são paulo', 'sao paulo', 'capital paulista'], cepInicio: '01000-000', cepFim: '05999-999' },
  { estado: 'São Paulo', sigla: 'SP', regiao: 'SP Capital (extensão)', apelidos: [], cepInicio: '08000-000', cepFim: '08499-999' },
  { estado: 'São Paulo', sigla: 'SP', regiao: 'SP Área Metropolitana', apelidos: ['grande são paulo', 'rmsp'], cepInicio: '06000-000', cepFim: '09999-999' },
  { estado: 'São Paulo', sigla: 'SP', regiao: 'SP Litoral', apelidos: ['santos', 'baixada santista'], cepInicio: '11000-000', cepFim: '11999-999' },
  { estado: 'São Paulo', sigla: 'SP', regiao: 'SP Interior', apelidos: [], cepInicio: '12000-000', cepFim: '19999-999' },

  // RJ
  { estado: 'Rio de Janeiro', sigla: 'RJ', regiao: 'RJ Capital', apelidos: ['rio de janeiro'], cepInicio: '20000-000', cepFim: '23799-999' },
  { estado: 'Rio de Janeiro', sigla: 'RJ', regiao: 'RJ Área Metropolitana', apelidos: ['grande rio'], cepInicio: '20000-000', cepFim: '26600-999' },
  { estado: 'Rio de Janeiro', sigla: 'RJ', regiao: 'RJ Interior', apelidos: [], cepInicio: '26601-000', cepFim: '28999-999' },

  // ES
  { estado: 'Espírito Santo', sigla: 'ES', regiao: 'Vitória', apelidos: ['vitoria', 'es capital'], cepInicio: '29000-000', cepFim: '29099-999' },
  { estado: 'Espírito Santo', sigla: 'ES', regiao: 'ES Interior', apelidos: [], cepInicio: '29100-000', cepFim: '29999-999' },

  // MG
  { estado: 'Minas Gerais', sigla: 'MG', regiao: 'Belo Horizonte', apelidos: ['bh', 'mg capital'], cepInicio: '30000-000', cepFim: '31999-999' },
  { estado: 'Minas Gerais', sigla: 'MG', regiao: 'MG Região Metropolitana', apelidos: ['grande bh'], cepInicio: '30000-000', cepFim: '34999-999' },
  { estado: 'Minas Gerais', sigla: 'MG', regiao: 'MG Interior', apelidos: [], cepInicio: '35000-000', cepFim: '39999-999' },

  // BA
  { estado: 'Bahia', sigla: 'BA', regiao: 'Salvador', apelidos: ['ba capital', 'salvador'], cepInicio: '40000-000', cepFim: '41999-999' },
  { estado: 'Bahia', sigla: 'BA', regiao: 'BA Região Metropolitana', apelidos: ['grande salvador'], cepInicio: '40000-000', cepFim: '44470-999' },
  { estado: 'Bahia', sigla: 'BA', regiao: 'BA Interior', apelidos: [], cepInicio: '44471-000', cepFim: '48999-999' },

  // SE
  { estado: 'Sergipe', sigla: 'SE', regiao: 'Aracaju', apelidos: ['se capital'], cepInicio: '49000-000', cepFim: '49099-999' },
  { estado: 'Sergipe', sigla: 'SE', regiao: 'SE Interior', apelidos: [], cepInicio: '49100-000', cepFim: '49999-999' },

  // PE
  { estado: 'Pernambuco', sigla: 'PE', regiao: 'Recife', apelidos: ['pe capital'], cepInicio: '50000-000', cepFim: '52999-999' },
  { estado: 'Pernambuco', sigla: 'PE', regiao: 'PE Região Metropolitana', apelidos: ['grande recife'], cepInicio: '50000-000', cepFim: '54999-999' },
  { estado: 'Pernambuco', sigla: 'PE', regiao: 'PE Interior', apelidos: [], cepInicio: '55000-000', cepFim: '56999-999' },

  // AL
  { estado: 'Alagoas', sigla: 'AL', regiao: 'Maceió', apelidos: ['maceio', 'al capital'], cepInicio: '57000-000', cepFim: '57099-999' },
  { estado: 'Alagoas', sigla: 'AL', regiao: 'AL Interior', apelidos: [], cepInicio: '57100-000', cepFim: '57999-999' },

  // PB
  { estado: 'Paraíba', sigla: 'PB', regiao: 'João Pessoa', apelidos: ['joao pessoa', 'pb capital'], cepInicio: '58000-000', cepFim: '58099-999' },
  { estado: 'Paraíba', sigla: 'PB', regiao: 'PB Interior', apelidos: [], cepInicio: '58100-000', cepFim: '58999-999' },

  // RN
  { estado: 'Rio Grande do Norte', sigla: 'RN', regiao: 'Natal', apelidos: ['rn capital'], cepInicio: '59000-000', cepFim: '59099-999' },
  { estado: 'Rio Grande do Norte', sigla: 'RN', regiao: 'RN Interior', apelidos: [], cepInicio: '59100-000', cepFim: '59999-999' },

  // CE
  { estado: 'Ceará', sigla: 'CE', regiao: 'Fortaleza', apelidos: ['ce capital'], cepInicio: '60000-000', cepFim: '60999-999' },
  { estado: 'Ceará', sigla: 'CE', regiao: 'CE Região Metropolitana', apelidos: ['grande fortaleza'], cepInicio: '60000-000', cepFim: '61900-999' },
  { estado: 'Ceará', sigla: 'CE', regiao: 'CE Interior', apelidos: [], cepInicio: '61901-000', cepFim: '63999-999' },

  // PI
  { estado: 'Piauí', sigla: 'PI', regiao: 'Teresina', apelidos: ['pi capital'], cepInicio: '64000-000', cepFim: '64099-999' },
  { estado: 'Piauí', sigla: 'PI', regiao: 'PI Interior', apelidos: [], cepInicio: '64100-000', cepFim: '64999-999' },

  // MA
  { estado: 'Maranhão', sigla: 'MA', regiao: 'São Luiz', apelidos: ['sao luis', 'são luís', 'ma capital'], cepInicio: '65000-000', cepFim: '65099-999' },
  { estado: 'Maranhão', sigla: 'MA', regiao: 'MA Interior', apelidos: [], cepInicio: '65100-000', cepFim: '65999-999' },

  // PA
  { estado: 'Pará', sigla: 'PA', regiao: 'Belém', apelidos: ['belem', 'pa capital'], cepInicio: '66000-000', cepFim: '66999-999' },
  { estado: 'Pará', sigla: 'PA', regiao: 'PA Região Metropolitana', apelidos: ['grande belem'], cepInicio: '66000-000', cepFim: '67999-999' },
  { estado: 'Pará', sigla: 'PA', regiao: 'PA Interior', apelidos: [], cepInicio: '68000-000', cepFim: '68899-999' },

  // AP
  { estado: 'Amapá', sigla: 'AP', regiao: 'Macapá', apelidos: ['macapa', 'ap capital'], cepInicio: '68900-000', cepFim: '68914-999' },
  { estado: 'Amapá', sigla: 'AP', regiao: 'AP Interior', apelidos: [], cepInicio: '68915-000', cepFim: '68999-999' },

  // AM
  { estado: 'Amazonas', sigla: 'AM', regiao: 'Manaus', apelidos: ['am capital'], cepInicio: '69000-000', cepFim: '69099-999' },
  { estado: 'Amazonas', sigla: 'AM', regiao: 'AM Interior', apelidos: [], cepInicio: '69100-000', cepFim: '69299-999' },

  // RR
  { estado: 'Roraima', sigla: 'RR', regiao: 'Boa Vista', apelidos: ['rr capital'], cepInicio: '69300-000', cepFim: '69339-999' },
  { estado: 'Roraima', sigla: 'RR', regiao: 'RR Interior', apelidos: [], cepInicio: '69340-000', cepFim: '69389-999' },

  // AC
  { estado: 'Acre', sigla: 'AC', regiao: 'Rio Branco', apelidos: ['ac capital'], cepInicio: '69900-000', cepFim: '69920-999' },
  { estado: 'Acre', sigla: 'AC', regiao: 'AC Interior', apelidos: [], cepInicio: '69921-000', cepFim: '69999-999' },

  // DF
  { estado: 'Distrito Federal', sigla: 'DF', regiao: 'Brasília', apelidos: ['brasilia', 'df capital'], cepInicio: '70000-000', cepFim: '70999-999' },
  { estado: 'Distrito Federal', sigla: 'DF', regiao: 'DF Cidades Satélite', apelidos: [], cepInicio: '71000-000', cepFim: '73699-999' },

  // GO
  { estado: 'Goiás', sigla: 'GO', regiao: 'Goiânia', apelidos: ['goiania', 'go capital'], cepInicio: '72800-000', cepFim: '73999-999' },
  { estado: 'Goiás', sigla: 'GO', regiao: 'Goiânia (extensão)', apelidos: [], cepInicio: '74000-000', cepFim: '74894-999' },
  { estado: 'Goiás', sigla: 'GO', regiao: 'GO Interior', apelidos: [], cepInicio: '74895-000', cepFim: '76799-999' },

  // TO
  { estado: 'Tocantins', sigla: 'TO', regiao: 'Palmas', apelidos: ['to capital'], cepInicio: '77000-000', cepFim: '77270-999' },
  { estado: 'Tocantins', sigla: 'TO', regiao: 'TO Interior', apelidos: [], cepInicio: '77300-000', cepFim: '77995-999' },

  // MT
  { estado: 'Mato Grosso', sigla: 'MT', regiao: 'Cuiabá', apelidos: ['cuiaba', 'mt capital'], cepInicio: '78000-000', cepFim: '78109-999' },
  { estado: 'Mato Grosso', sigla: 'MT', regiao: 'MT Interior', apelidos: [], cepInicio: '78110-000', cepFim: '78899-999' },

  // RO
  { estado: 'Rondônia', sigla: 'RO', regiao: 'Porto Velho', apelidos: ['ro capital'], cepInicio: '78900-000', cepFim: '78930-999' },
  { estado: 'Rondônia', sigla: 'RO', regiao: 'RO Interior', apelidos: [], cepInicio: '78931-000', cepFim: '78999-999' },

  // MS
  { estado: 'Mato Grosso do Sul', sigla: 'MS', regiao: 'Campo Grande', apelidos: ['ms capital'], cepInicio: '79000-000', cepFim: '79129-999' },
  { estado: 'Mato Grosso do Sul', sigla: 'MS', regiao: 'MS Interior', apelidos: [], cepInicio: '79130-000', cepFim: '79999-999' },

  // PR
  { estado: 'Paraná', sigla: 'PR', regiao: 'Curitiba', apelidos: ['pr capital'], cepInicio: '80000-000', cepFim: '82999-999' },
  { estado: 'Paraná', sigla: 'PR', regiao: 'PR Área Metropolitana', apelidos: ['grande curitiba'], cepInicio: '80000-000', cepFim: '83800-999' },
  { estado: 'Paraná', sigla: 'PR', regiao: 'PR Interior', apelidos: [], cepInicio: '83801-000', cepFim: '87999-999' },

  // SC
  { estado: 'Santa Catarina', sigla: 'SC', regiao: 'Florianópolis', apelidos: ['florianopolis', 'sc capital'], cepInicio: '88000-000', cepFim: '88099-999' },
  { estado: 'Santa Catarina', sigla: 'SC', regiao: 'SC Área Metropolitana', apelidos: ['grande florianopolis'], cepInicio: '88000-000', cepFim: '88469-999' },
  { estado: 'Santa Catarina', sigla: 'SC', regiao: 'SC Interior', apelidos: [], cepInicio: '88470-000', cepFim: '89999-999' },

  // RS
  { estado: 'Rio Grande do Sul', sigla: 'RS', regiao: 'Porto Alegre', apelidos: ['rs capital'], cepInicio: '90000-000', cepFim: '91999-999' },
  { estado: 'Rio Grande do Sul', sigla: 'RS', regiao: 'RS Área Metropolitana', apelidos: ['grande porto alegre'], cepInicio: '90000-000', cepFim: '94900-999' },
  { estado: 'Rio Grande do Sul', sigla: 'RS', regiao: 'RS Interior', apelidos: [], cepInicio: '94901-000', cepFim: '99999-999' },
]

const normalizar = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

/**
 * Busca faixas de CEP por consulta livre (estado, região, sigla, apelido).
 * Retorna até 8 matches ordenados por score.
 */
export function buscarFaixasCep(query: string, limite = 8): FaixaCEP[] {
  const q = normalizar(query)
  if (!q) return []
  const palavras = q.split(/\s+/).filter(Boolean)

  const scored = FAIXAS_CEP_BRASIL.map(f => {
    const haystack = normalizar(
      [f.estado, f.sigla, f.regiao, ...f.apelidos].join(' ')
    )
    const score = palavras.filter(p => haystack.includes(p)).length
    return { faixa: f, score }
  })
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)

  return scored.slice(0, limite).map(s => s.faixa)
}
