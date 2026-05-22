/**
 * Mapeia um CEP brasileiro (8 dígitos) para a sigla do estado (UF).
 * Baseado nas faixas oficiais dos Correios.
 *
 * Retorna null se o CEP não corresponde a nenhum estado conhecido.
 */
export function cepToEstado(cep: string): string | null {
  const cepNum = parseInt(cep.replace(/\D/g, ''), 10)
  if (isNaN(cepNum) || cepNum < 1000000) return null

  // Faixas oficiais dos Correios (CEP em número inteiro de 8 dígitos)
  if (cepNum <= 19999999) return 'SP'
  if (cepNum <= 28999999) return 'RJ'
  if (cepNum <= 29999999) return 'ES'
  if (cepNum <= 39999999) return 'MG'
  if (cepNum <= 48999999) return 'BA'
  if (cepNum <= 49999999) return 'SE'
  if (cepNum <= 56999999) return 'PE'
  if (cepNum <= 57999999) return 'AL'
  if (cepNum <= 58999999) return 'PB'
  if (cepNum <= 59999999) return 'RN'
  if (cepNum <= 63999999) return 'CE'
  if (cepNum <= 64999999) return 'PI'
  if (cepNum <= 65999999) return 'MA'
  if (cepNum <= 68899999) return 'PA'
  if (cepNum <= 68999999) return 'AP'
  if (cepNum <= 69299999) return 'AM'
  if (cepNum <= 69399999) return 'RR'
  if (cepNum <= 69899999) return 'AM'
  if (cepNum <= 69999999) return 'AC'
  if (cepNum <= 72799999) return 'DF'
  if (cepNum <= 72999999) return 'GO'
  if (cepNum <= 73699999) return 'DF'
  if (cepNum <= 76799999) return 'GO'
  if (cepNum <= 76999999) return 'RO'
  if (cepNum <= 77999999) return 'TO'
  if (cepNum <= 78899999) return 'MT'
  if (cepNum <= 78999999) return 'RO'
  if (cepNum <= 79999999) return 'MS'
  if (cepNum <= 87999999) return 'PR'
  if (cepNum <= 89999999) return 'SC'
  if (cepNum <= 99999999) return 'RS'

  return null
}

export const NOMES_ESTADOS: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia',
  CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás',
  MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais',
  PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí',
  RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul',
  RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina', SP: 'São Paulo',
  SE: 'Sergipe', TO: 'Tocantins',
}
