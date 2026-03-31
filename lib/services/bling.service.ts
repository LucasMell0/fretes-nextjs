import { prisma } from '@/lib/prisma'
import { decrypt, encrypt } from '@/lib/crypto'
import { logger } from '@/lib/logger'

/**
 * Serviço para integração com API do Bling
 * 
 * Funcionalidades:
 * - Buscar produtos paginados
 * - Buscar produto por ID
 * - Sincronizar estoque
 * - Importar produtos para o sistema
 */

export interface BlingCredentials {
  apiKey: string
  apiUrl?: string
  integracaoId?: number
}

export interface BlingProduto {
  id: number
  idProdutoPai?: number
  nome: string
  codigo: string // SKU
  preco: number
  precoCusto?: number
  estoque: {
    saldoVirtualTotal: number
  }
  tipo: 'P' | 'S' | 'E' | 'V' // Produto, Serviço, Composição, Variação
  situacao: 'A' | 'I' // Ativo, Inativo
  formato: 'S' | 'V' // Simples, Com variações
  descricaoCurta?: string
  imagemURL?: string
  unidade?: string
  pesoLiquido?: number
  pesoBruto?: number
  volumes?: number
  dimensoes?: {
    largura: number
    altura: number
    profundidade: number
    unidadeMedida: number
  }
  variacoes?: BlingProduto[]
}

export interface BlingProdutosResponse {
  data: BlingProduto[]
}

export interface BlingProdutoResponse {
  data: BlingProduto
}

export interface BlingWebhookEstoque {
  produto: {
    id: number
  }
  deposito?: {
    id: number
    saldoFisico: number
    saldoVirtual: number
  }
  operacao?: 'E' | 'S' // Entrada ou Saída
  quantidade?: number
  saldoFisicoTotal: number
  saldoVirtualTotal: number
}

export interface BlingWebhookEstoqueVirtual {
  produto: {
    id: number
  }
  saldoFisicoTotal: number
  saldoVirtualTotal: number
  vinculoComplexo: boolean
  depositos: Array<{
    id: number
    saldoFisico: number
    saldoVirtual: number
  }>
}

export class BlingService {
  private apiKey: string
  private apiUrl: string
  private accessToken?: string
  private refreshToken?: string
  private tokenExpiresAt?: Date
  private integracaoId?: number

  constructor(credentials: BlingCredentials) {
    this.apiKey = credentials.apiKey
    this.apiUrl = credentials.apiUrl || 'https://api.bling.com.br/Api/v3'
    this.integracaoId = credentials.integracaoId
  }

  /**
   * Configurar tokens OAuth2 (usado internamente)
   * ATENÇÃO: Tokens devem estar CRIPTOGRAFADOS ao vir do banco
   */
  setTokens(accessToken: string, refreshToken: string, expiresAt: Date, integracaoId: number) {
    // Descriptografar tokens ao carregar
    this.accessToken = decrypt(accessToken)
    this.refreshToken = decrypt(refreshToken)
    this.tokenExpiresAt = expiresAt
    this.integracaoId = integracaoId
  }

  /**
   * Verificar se token está expirado e renovar se necessário
   */
  private async ensureValidToken(): Promise<string> {
    // Se não tem OAuth configurado, usa API Key antiga (compatibilidade)
    if (!this.accessToken || !this.refreshToken) {
      return this.apiKey
    }

    // Verificar se token ainda é válido (com margem de 5 minutos)
    const now = new Date()
    const expiresAt = this.tokenExpiresAt || now
    const marginMs = 5 * 60 * 1000 // 5 minutos

    if (now.getTime() < expiresAt.getTime() - marginMs) {
      // Token ainda válido
      return this.accessToken
    }

    // Token expirado, precisa renovar
    logger.info('🔄 Access token expirado, renovando...')
    
    const clientId = process.env.BLING_CLIENT_ID
    const clientSecret = process.env.BLING_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      throw new Error('BLING_CLIENT_ID e BLING_CLIENT_SECRET não configurados')
    }

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

    const response = await fetch('https://api.bling.com.br/Api/v3/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': '1.0',
        'Authorization': `Basic ${credentials}`
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken
      })
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Erro ao renovar token: ${error}`)
    }

    const tokenData = await response.json()

    // Atualizar tokens locais
    this.accessToken = tokenData.access_token
    this.refreshToken = tokenData.refresh_token
    this.tokenExpiresAt = new Date(Date.now() + (tokenData.expires_in * 1000))

    // Salvar tokens atualizados no banco (CRIPTOGRAFADOS)
    if (this.integracaoId && this.accessToken && this.refreshToken) {
      await prisma.usuarioIntegracaoCanal.update({
        where: { id: this.integracaoId },
        data: {
          accessToken: encrypt(this.accessToken),
          refreshToken: encrypt(this.refreshToken),
          tokenExpiresAt: this.tokenExpiresAt
        }
      })
    }

    logger.info('✅ Access token renovado com sucesso')
    return this.accessToken!
  }

  /**
   * Obter headers de autenticação (Bearer ou API Key legado)
   */
  private async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.ensureValidToken()
    
    return {
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  }

  /**
   * Buscar produtos do Bling paginados
   */
  async buscarProdutos(params: {
    pagina?: number
    limite?: number
    criterio?: 1 | 2 | 3 | 4 | 5 // 1: Últimos incluídos, 2: Ativos, 3: Inativos, 4: Excluídos, 5: Todos
    tipo?: 'T' | 'P' | 'S' | 'E' | 'PS' | 'C' | 'V'
    nome?: string
    codigos?: string[]
  } = {}): Promise<BlingProdutosResponse> {
    const searchParams = new URLSearchParams()
    
    searchParams.append('pagina', String(params.pagina || 1))
    searchParams.append('limite', String(params.limite || 100))
    searchParams.append('criterio', String(params.criterio || 2)) // Default: Ativos
    searchParams.append('tipo', params.tipo || 'T')
    
    if (params.nome) {
      searchParams.append('nome', params.nome)
    }
    
    if (params.codigos && params.codigos.length > 0) {
      params.codigos.forEach(codigo => {
        searchParams.append('codigos[]', codigo)
      })
    }

    const headers = await this.getAuthHeaders()
    
    const response = await fetch(
      `${this.apiUrl}/produtos?${searchParams.toString()}`,
      {
        method: 'GET',
        headers
      }
    )

    if (!response.ok) {
      throw new Error(`Erro ao buscar produtos do Bling: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  }

  /**
   * Buscar produto específico por ID
   */
  async buscarProdutoPorId(idProduto: number): Promise<BlingProdutoResponse> {
    const headers = await this.getAuthHeaders()
    
    const response = await fetch(
      `${this.apiUrl}/produtos/${idProduto}`,
      {
        method: 'GET',
        headers
      }
    )

    if (!response.ok) {
      throw new Error(`Erro ao buscar produto ${idProduto} do Bling: ${response.status} ${response.statusText}`)
    }

    return await response.json()
  }

  /**
   * Processar webhook de atualização de estoque
   */
  async processarWebhookEstoque(payload: BlingWebhookEstoque | BlingWebhookEstoqueVirtual, usuarioId: number) {
    const idProdutoBling = payload.produto.id
    const saldoVirtualTotal = payload.saldoVirtualTotal

    // Buscar produto no sistema pelo ID do Bling (armazenado em campo customizado ou tabela separada)
    // Por enquanto vamos buscar pelo SKU, mas idealmente deveria ter uma tabela de mapeamento
    const produtoBling = await this.buscarProdutoPorId(idProdutoBling)
    const sku = produtoBling.data.codigo

    // Atualizar estoque no banco
    const produto = await prisma.produto.findFirst({
      where: { 
        sku,
        usuarioId 
      }
    })

    if (produto) {
      await prisma.produto.update({
        where: { id: produto.id },
        data: {
          estoque: Math.floor(saldoVirtualTotal)
        }
      })

      logger.info(`✅ Estoque do produto ${sku} atualizado para ${saldoVirtualTotal}`)
    } else {
      logger.warn(`⚠️ Produto com SKU ${sku} não encontrado no sistema`)
    }

    return {
      success: true,
      sku,
      novoEstoque: saldoVirtualTotal
    }
  }

  /**
   * Listar produtos do Bling (sem importar)
   */
  async listarProdutos(filtros?: {
    criterio?: 1 | 2 | 3 | 4 | 5
    tipo?: 'T' | 'P' | 'S' | 'E' | 'PS' | 'C' | 'V'
    limite?: number
    pagina?: number
  }): Promise<BlingProduto[]> {
    try {
      const response = await this.buscarProdutos({
        pagina: filtros?.pagina || 1,
        limite: filtros?.limite || 100,
        criterio: filtros?.criterio || 2,
        tipo: filtros?.tipo || 'T'
      })

      return response.data || []
    } catch (error) {
      logger.error('Erro ao listar produtos do Bling:', error)
      throw error
    }
  }

  /**
   * Importar produtos específicos do Bling para o sistema
   */
  async importarProdutosSelecionados(usuarioId: number, produtoIds: number[]) {
    const resultados = {
      importados: 0,
      atualizados: 0,
      erros: 0,
      detalhes: [] as Array<{ sku: string, status: string, mensagem?: string }>
    }

    for (const produtoId of produtoIds) {
      try {
        // Buscar detalhes completos do produto
        const response = await this.buscarProdutoPorId(produtoId)
        const produtoBling = response.data

        await this.importarProduto(produtoBling, usuarioId)
        
        const produtoExiste = await prisma.produto.findFirst({
          where: { 
            sku: produtoBling.codigo,
            usuarioId 
          }
        })

        if (produtoExiste) {
          resultados.atualizados++
          resultados.detalhes.push({
            sku: produtoBling.codigo,
            status: 'atualizado',
            mensagem: `Produto ${produtoBling.nome} atualizado`
          })
        } else {
          resultados.importados++
          resultados.detalhes.push({
            sku: produtoBling.codigo,
            status: 'importado',
            mensagem: `Produto ${produtoBling.nome} importado`
          })
        }
      } catch (error) {
        resultados.erros++
        resultados.detalhes.push({
          sku: `ID ${produtoId}`,
          status: 'erro',
          mensagem: error instanceof Error ? error.message : 'Erro desconhecido'
        })
      }
    }

    return resultados
  }

  /**
   * Importar produtos do Bling para o sistema (TODOS de uma vez)
   * Usa paginação automática com limite de 100 (máximo do Bling) até buscar todos os produtos
   */
  async importarProdutos(usuarioId: number, filtros?: {
    criterio?: 1 | 2 | 3 | 4 | 5
    tipo?: 'T' | 'P' | 'S' | 'E' | 'PS' | 'C' | 'V'
  }) {
    const resultados = {
      importados: 0,
      atualizados: 0,
      erros: 0,
      detalhes: [] as Array<{ sku: string, status: string, mensagem?: string }>
    }

    let pagina = 1
    let temMaisProdutos = true

    while (temMaisProdutos) {
      try {
        const response = await this.buscarProdutos({
          pagina,
          limite: 100, // Máximo permitido pelo Bling - otimiza a paginação
          criterio: filtros?.criterio || 2, // Ativos
          tipo: filtros?.tipo || 'P' // Apenas produtos
        })

        if (!response.data || response.data.length === 0) {
          temMaisProdutos = false
          break
        }

        for (const produtoBling of response.data) {
          try {
            await this.importarProduto(produtoBling, usuarioId)
            
            const produtoExiste = await prisma.produto.findFirst({
              where: { 
                sku: produtoBling.codigo,
                usuarioId 
              }
            })

            if (produtoExiste) {
              resultados.atualizados++
              resultados.detalhes.push({
                sku: produtoBling.codigo,
                status: 'atualizado',
                mensagem: `Produto ${produtoBling.nome} atualizado`
              })
            } else {
              resultados.importados++
              resultados.detalhes.push({
                sku: produtoBling.codigo,
                status: 'importado',
                mensagem: `Produto ${produtoBling.nome} importado`
              })
            }
          } catch (error) {
            resultados.erros++
            resultados.detalhes.push({
              sku: produtoBling.codigo,
              status: 'erro',
              mensagem: error instanceof Error ? error.message : 'Erro desconhecido'
            })
          }
        }

        // Se retornou menos que 100, não tem mais produtos
        if (response.data.length < 100) {
          temMaisProdutos = false
        } else {
          pagina++
          logger.info(`📄 Buscando página ${pagina}...`)
        }
      } catch (error) {
        logger.error(`Erro ao buscar página ${pagina}:`, error)
        temMaisProdutos = false
      }
    }

    return resultados
  }

  /**
   * Importar um único produto do Bling (simples ou com variações)
   */
  private async importarProduto(produtoBling: BlingProduto, usuarioId: number) {
    // Se o produto tem variações (formato 'V'), buscar detalhes completos
    if (produtoBling.formato === 'V') {
      return await this.importarProdutoComVariacoes(produtoBling, usuarioId)
    }
    
    // Produto simples ou variação individual
    return await this.importarProdutoSimples(produtoBling, usuarioId)
  }

  /**
   * Importar produto usando transação do Prisma (para uso em importações em lote)
   */
  private async importarProdutoComTransacao(produtoBling: BlingProduto, usuarioId: number, tx: { produto: { upsert: (args: Record<string, unknown>) => Promise<unknown> } }) {
    // Se o produto tem variações (formato 'V'), buscar detalhes completos
    if (produtoBling.formato === 'V') {
      return await this.importarProdutoComVariacoesComTransacao(produtoBling, usuarioId, tx)
    }
    
    // Produto simples ou variação individual
    return await this.importarProdutoSimplesComTransacao(produtoBling, usuarioId, tx)
  }

  /**
   * Importar produto simples ou variação individual com transação
   */
  private async importarProdutoSimplesComTransacao(produtoBling: BlingProduto, usuarioId: number, tx: { produto: { upsert: (args: Record<string, unknown>) => Promise<unknown> } }, produtoPaiId?: number) {
    const cubagem = produtoBling.dimensoes
      ? (produtoBling.dimensoes.largura / 100) *
        (produtoBling.dimensoes.altura / 100) *
        (produtoBling.dimensoes.profundidade / 100)
      : 0

    const dadosProduto = {
      nome: produtoBling.nome,
      sku: produtoBling.codigo,
      peso: produtoBling.pesoLiquido || produtoBling.pesoBruto || 0,
      cubagem: cubagem || 0,
      estoque: Math.floor(produtoBling.estoque?.saldoVirtualTotal || 0),
      ativo: produtoBling.situacao === 'A',
      produtoPaiId: produtoPaiId || null,
      usuarioId,
    }

    return await tx.produto.upsert({
      where: { usuarioId_sku: { usuarioId, sku: produtoBling.codigo } },
      update: dadosProduto,
      create: dadosProduto
    })
  }

  /**
   * Importar produto com variações usando transação
   */
  private async importarProdutoComVariacoesComTransacao(produtoBling: BlingProduto, usuarioId: number, tx: { produto: { upsert: (args: Record<string, unknown>) => Promise<unknown> } }) {
    try {
      const response = await this.buscarProdutoPorId(produtoBling.id)
      const produtoCompleto = response.data
      
      if (!produtoCompleto) {
        return await this.importarProdutoSimplesComTransacao(produtoBling, usuarioId, tx)
      }

      const produtoPai = await this.importarProdutoSimplesComTransacao(produtoCompleto, usuarioId, tx) as { id: number }

      if (produtoCompleto.variacoes && produtoCompleto.variacoes.length > 0) {
        for (const variacao of produtoCompleto.variacoes) {
          await this.importarProdutoSimplesComTransacao(variacao, usuarioId, tx, produtoPai.id)
        }
      }

      return produtoPai
    } catch (error) {
      logger.error(`Erro ao importar produto com variações ${produtoBling.codigo}:`, error)
      return await this.importarProdutoSimplesComTransacao(produtoBling, usuarioId, tx)
    }
  }

  /**
   * Importar produto simples ou variação individual (SEM transação - legado)
   */
  private async importarProdutoSimples(produtoBling: BlingProduto, usuarioId: number, produtoPaiId?: number) {
    // Calcular cubagem (L x A x P em m³)
    const cubagem = produtoBling.dimensoes
      ? (produtoBling.dimensoes.largura / 100) *
        (produtoBling.dimensoes.altura / 100) *
        (produtoBling.dimensoes.profundidade / 100)
      : 0

    const dadosProduto = {
      nome: produtoBling.nome,
      sku: produtoBling.codigo,
      peso: produtoBling.pesoLiquido || produtoBling.pesoBruto || 0,
      cubagem: cubagem || 0,
      estoque: Math.floor(produtoBling.estoque?.saldoVirtualTotal || 0),
      ativo: produtoBling.situacao === 'A',
      produtoPaiId: produtoPaiId || null,
      usuarioId,
    }

    // Verificar se produto já existe
    const produtoExiste = await prisma.produto.findFirst({
      where: { 
        sku: produtoBling.codigo,
        usuarioId 
      }
    })

    if (produtoExiste) {
      // Atualizar produto existente
      return await prisma.produto.update({
        where: { id: produtoExiste.id },
        data: dadosProduto
      })
    } else {
      // Criar novo produto
      return await prisma.produto.create({
        data: dadosProduto
      })
    }
  }

  /**
   * Importar produto com variações do Bling v3
   */
  private async importarProdutoComVariacoes(produtoBling: BlingProduto, usuarioId: number) {
    try {
      // 1. Buscar detalhes completos do produto (com variações)
      const detalhesResponse = await this.buscarProdutoPorId(produtoBling.id)
      const produtoCompleto = detalhesResponse.data

      // 2. Criar/atualizar produto pai
      const cubagem = produtoCompleto.dimensoes
        ? (produtoCompleto.dimensoes.largura / 100) *
          (produtoCompleto.dimensoes.altura / 100) *
          (produtoCompleto.dimensoes.profundidade / 100)
        : 0

      const dadosProdutoPai = {
        nome: produtoCompleto.nome,
        sku: produtoCompleto.codigo,
        peso: produtoCompleto.pesoLiquido || produtoCompleto.pesoBruto || 0,
        cubagem: cubagem || 0,
        estoque: Math.floor(produtoCompleto.estoque?.saldoVirtualTotal || 0),
        ativo: produtoCompleto.situacao === 'A',
        produtoPaiId: null,
        usuarioId,
      }

      let produtoPai = await prisma.produto.findFirst({
        where: { 
          sku: produtoCompleto.codigo,
          usuarioId 
        }
      })

      if (produtoPai) {
        produtoPai = await prisma.produto.update({
          where: { id: produtoPai.id },
          data: dadosProdutoPai
        })
      } else {
        produtoPai = await prisma.produto.create({
          data: dadosProdutoPai
        })
      }

      // 3. Importar variações (produtos filhos)
      if (produtoCompleto.variacoes && produtoCompleto.variacoes.length > 0) {
        for (const variacao of produtoCompleto.variacoes) {
          await this.importarProdutoSimples(variacao, usuarioId, produtoPai.id)
        }
      }

      return produtoPai
    } catch (error) {
      logger.error(`Erro ao importar produto com variações ${produtoBling.codigo}:`, error)
      // Se falhar ao buscar variações, importar pelo menos o produto pai
      return await this.importarProdutoSimples(produtoBling, usuarioId)
    }
  }
}
