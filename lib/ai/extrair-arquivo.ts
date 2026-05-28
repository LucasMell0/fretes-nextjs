import * as XLSX from 'xlsx'

export const TIPOS_PERMITIDOS: Record<string, string> = {
  'text/csv': 'csv',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
}

export const MAX_BYTES_POR_ARQUIVO = 5 * 1024 * 1024
export const MAX_CARACTERES_EXTRAIDOS = 40_000

export interface ExtracaoResultado {
  nome: string
  tipo: string
  tamanhoBytes: number
  conteudoExtraido: string
  truncado: boolean
}

function ehTipoSuportado(mime: string, filename: string): string | null {
  if (TIPOS_PERMITIDOS[mime]) return TIPOS_PERMITIDOS[mime]
  const ext = filename.toLowerCase().split('.').pop()
  if (!ext) return null
  if (['csv', 'xls', 'xlsx', 'pdf', 'txt'].includes(ext)) return ext
  return null
}

function truncar(s: string): { texto: string; truncado: boolean } {
  if (s.length <= MAX_CARACTERES_EXTRAIDOS) return { texto: s, truncado: false }
  return {
    texto: s.slice(0, MAX_CARACTERES_EXTRAIDOS) + `\n\n[... truncado em ${MAX_CARACTERES_EXTRAIDOS} caracteres ...]`,
    truncado: true,
  }
}

function planilhaParaTexto(buffer: Buffer): string {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const partes: string[] = []
  for (const nomeAba of wb.SheetNames) {
    const aba = wb.Sheets[nomeAba]
    const csv = XLSX.utils.sheet_to_csv(aba, { blankrows: false })
    if (!csv.trim()) continue
    partes.push(`# Aba: ${nomeAba}\n${csv}`)
  }
  return partes.join('\n\n')
}

async function pdfParaTexto(buffer: Buffer): Promise<string> {
  // Import dinâmico pra evitar problemas no build do Next.js
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfModule = await import('pdf-parse') as any
  const pdfParse = (pdfModule.default ?? pdfModule) as (b: Buffer) => Promise<{ text: string }>
  const result = await pdfParse(buffer)
  return result.text
}

/**
 * Extrai conteúdo textual de um arquivo (xlsx/xls/csv/pdf/txt).
 * Retorna um resumo formatado em texto pra injetar no contexto do LLM.
 */
export async function extrairArquivo(file: File): Promise<ExtracaoResultado> {
  if (file.size > MAX_BYTES_POR_ARQUIVO) {
    throw new Error(`Arquivo "${file.name}" excede ${MAX_BYTES_POR_ARQUIVO / 1024 / 1024}MB`)
  }
  const tipo = ehTipoSuportado(file.type, file.name)
  if (!tipo) {
    throw new Error(`Tipo de arquivo não suportado: "${file.name}". Aceitos: xlsx, xls, csv, pdf, txt`)
  }
  const buffer = Buffer.from(await file.arrayBuffer())

  let texto: string
  switch (tipo) {
    case 'csv':
    case 'txt':
      texto = buffer.toString('utf-8')
      break
    case 'xls':
    case 'xlsx':
      texto = planilhaParaTexto(buffer)
      break
    case 'pdf':
      texto = await pdfParaTexto(buffer)
      break
    default:
      throw new Error(`Tipo não tratado: ${tipo}`)
  }

  const { texto: textoTruncado, truncado } = truncar(texto.trim())

  return {
    nome: file.name,
    tipo,
    tamanhoBytes: file.size,
    conteudoExtraido: textoTruncado,
    truncado,
  }
}

/**
 * Formata múltiplos arquivos extraídos como uma "mensagem do sistema" de contexto.
 */
export function formatarArquivosParaPrompt(extracoes: ExtracaoResultado[]): string {
  if (extracoes.length === 0) return ''
  const blocos = extracoes.map((e, i) => {
    const cab = `### Arquivo ${i + 1}: ${e.nome} (${e.tipo}, ${Math.round(e.tamanhoBytes / 1024)}KB${e.truncado ? ', truncado' : ''})`
    return `${cab}\n\n\`\`\`\n${e.conteudoExtraido}\n\`\`\``
  })
  return `O usuário anexou ${extracoes.length} arquivo(s) com este conteúdo:\n\n${blocos.join('\n\n')}`
}
