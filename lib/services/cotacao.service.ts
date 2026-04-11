import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { cache } from '@/lib/cache'
import type {
  ProdutoCotacao,
  ResultadoCotacao,
  TaxaAplicada,
} from '@/types/cotacao'

export class CotacaoError extends Error {
  public tipo: 'SKU_NAO_ENCONTRADO' | 'CEP_NAO_ATENDIDO'
  public detalhes: Record<string, unknown>

  constructor(tipo: 'SKU_NAO_ENCONTRADO' | 'CEP_NAO_ATENDIDO', message: string, detalhes: Record<string, unknown> = {}) {
    super(message)
    this.tipo = tipo
    this.detalhes = detalhes
    this.name = 'CotacaoError'
  }
}

export class CotacaoService {
  /**
   * Registra falha de cotação na tabela de auditoria
   */
  async registrarAuditoria(params: {
    tipo: 'SKU_NAO_ENCONTRADO' | 'CEP_NAO_ATENDIDO'
    descricao: string
    detalhes?: Record<string, unknown>
    cep?: string
    skus: string[]
    origem?: string
    marketplace?: string
    integracaoId?: number
    usuarioId: number
  }): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (prisma as any).auditoriaCotacao.create({
        data: {
          tipo: params.tipo,
          descricao: params.descricao,
          detalhes: params.detalhes ? JSON.parse(JSON.stringify(params.detalhes)) : null,
          cep: params.cep || null,
          skus: params.skus,
          origem: params.origem || 'API',
          marketplace: params.marketplace || null,
          integracaoId: params.integracaoId || null,
          usuarioId: params.usuarioId,
          status: 'PENDENTE',
        },
      })
    } catch (error) {
      logger.error('Erro ao registrar auditoria:', error)
    }
  }

  /**
   * Realiza cotação de frete para um CEP e lista de produtos
   */
  async cotar(cep: string, produtos: ProdutoCotacao[], usuarioId?: number): Promise<{ cotacoes: ResultadoCotacao[]; erros: string[] }> {
    const cepLimpo = cep.replace(/\D/g, '')

    // Buscar regiões e produtos em PARALELO (2 queries independentes)
    const [regioes, produtosCompletos] = await Promise.all([
      this.buscarTransportadorasPorCep(cepLimpo, usuarioId),
      this.buscarDadosProdutos(produtos, usuarioId),
    ])

    if (regioes.length === 0) {
      throw new CotacaoError(
        'CEP_NAO_ATENDIDO',
        `Nenhuma transportadora encontrada para o CEP ${cep}`,
        { cep: cepLimpo }
      )
    }
    const skusEncontrados = produtosCompletos.map(p => p.sku)
    const skusNaoEncontrados = produtos
      .map(p => p.sku)
      .filter(sku => !skusEncontrados.includes(sku))

    if (skusNaoEncontrados.length > 0) {
      throw new CotacaoError(
        'SKU_NAO_ENCONTRADO',
        `Produtos não encontrados: ${skusNaoEncontrados.join(', ')}`,
        { skus_nao_encontrados: skusNaoEncontrados }
      )
    }

    // OTIMIZADO: Calcular todas as cotações em paralelo
    const errosPorTransportadora: string[] = []
    const cotacoesPromises = regioes.map(async (regiao) => {
      try {
        return await this.calcularCotacao(regiao, produtosCompletos)
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        errosPorTransportadora.push(`${regiao.transportadora.nome}: ${msg}`)
        logger.error(`Erro ao calcular cotação para transportadora ${regiao.transportadora.nome}: ${msg}`)
        return null
      }
    })

    const resultados = await Promise.all(cotacoesPromises)
    const cotacoes = resultados.filter((c): c is ResultadoCotacao => c !== null)

    // Se TODAS as cotações falharam, registrar na auditoria
    if (cotacoes.length === 0 && errosPorTransportadora.length > 0 && usuarioId) {
      const skus = produtos.map(p => p.sku)
      await this.registrarAuditoria({
        tipo: 'CEP_NAO_ATENDIDO',
        descricao: `Cotação falhou para todas as ${errosPorTransportadora.length} transportadora(s) do CEP ${cepLimpo}`,
        detalhes: { erros: errosPorTransportadora, cep: cepLimpo, skus },
        cep: cepLimpo,
        skus,
        origem: 'API',
        usuarioId,
      })
    }

    return {
      cotacoes: cotacoes.sort((a, b) => a.valor_frete - b.valor_frete),
      erros: errosPorTransportadora,
    }
  }

  /**
   * Busca transportadoras que atendem o CEP informado (com cache de 60s)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async buscarTransportadorasPorCep(cep: string, usuarioId?: number): Promise<any[]> {
    const cacheKey = `regioes:${usuarioId}:${cep}`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cached = cache.get<any[]>(cacheKey)
    if (cached) return cached

    const whereClause: Record<string, unknown> = {
      ativo: true,
      transportadora: { ativo: true },
      cepInicio: { lte: cep },
      cepFim: { gte: cep },
    }

    if (usuarioId) {
      whereClause.usuarioId = usuarioId
    }

    const result = await prisma.transportadoraRegiao.findMany({
      where: whereClause,
      include: {
        transportadora: {
          select: { id: true, nome: true, fatorCubagem: true, margemLucro: true },
        },
        precos: { orderBy: { pesoInicial: 'asc' } },
        kgAdicional: true,
        taxas: true,
      },
    })

    cache.set(cacheKey, result, 60)
    return result
  }

  /**
   * Busca dados completos dos produtos no banco (com cache de 60s)
   */
  private async buscarDadosProdutos(produtos: ProdutoCotacao[], usuarioId?: number) {
    const skus = produtos.map(p => p.sku)
    const skusSorted = [...skus].sort().join(',')
    const cacheKey = `produtos:${usuarioId}:${skusSorted}`

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let produtosDB: any[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cachedDB = cache.get<any[]>(cacheKey)

    if (cachedDB) {
      produtosDB = cachedDB
    } else {
      const whereClause: Record<string, unknown> = {
        sku: { in: skus },
        ativo: true,
      }

      if (usuarioId) {
        whereClause.usuarioId = usuarioId
      }

      produtosDB = await prisma.produto.findMany({
        where: whereClause,
        include: {
          cubagens: true,
          produtoPai: {
            include: {
              cubagens: true,
            },
          },
        },
      })

      cache.set(cacheKey, produtosDB, 60)
    }

    return produtosDB.map(p => {
      const produtoInput = produtos.find(pi => pi.sku === p.sku)
      return {
        ...p,
        quantidade: produtoInput?.quantidade || 1,
        valorVenda: produtoInput?.valor || 0,
      }
    })
  }

  /**
   * Calcula cotação para uma transportadora/região específica
   */
  private async calcularCotacao(
    regiao: Awaited<ReturnType<typeof this.buscarTransportadorasPorCep>>[0],
    produtos: Awaited<ReturnType<typeof this.buscarDadosProdutos>>
  ): Promise<ResultadoCotacao> {
    const fatorCubagem = Number(regiao.transportadora.fatorCubagem)
    
    let pesoReal = 0
    let pesoCubado = 0
    let valorVendaTotal = 0

    for (const produto of produtos) {
      const quantidade = (produto as unknown as { quantidade: number }).quantidade || 1
      const valorVenda = (produto as unknown as { valorVenda: number }).valorVenda || 0

      // Produto pai e flag de herança
      const pai = produto.produtoPai as typeof produto | null
      const usarDadosPadraosPai = pai && (pai as unknown as { usarDadosPaiParaVariacoes: boolean }).usarDadosPaiParaVariacoes

      // Config por transportadora: SEMPRE herda do pai se o filho não tem (independente da flag)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const configFilho = produto.cubagens.find((c: any) => c.transportadoraId === regiao.transportadoraId)
      const configPai = pai
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? pai.cubagens.find((c: any) => c.transportadoraId === regiao.transportadoraId)
        : undefined

      // Prioridade cubagem: config filho > config pai > cubagem filho (se > 0 ou flag desligada) > cubagem pai
      let cubagemM3: number
      if (configFilho?.cubagem != null) {
        cubagemM3 = Number(configFilho.cubagem)
      } else if (configPai?.cubagem != null) {
        cubagemM3 = Number(configPai.cubagem)
      } else if (Number(produto.cubagem) > 0 || !usarDadosPadraosPai) {
        cubagemM3 = Number(produto.cubagem)
      } else {
        cubagemM3 = Number(pai!.cubagem)
      }

      // Prioridade peso: config filho > config pai > peso filho (se > 0 ou flag desligada) > peso pai
      let pesoRealUnitario: number
      let fontePeso = ''
      if (configFilho?.peso != null) {
        pesoRealUnitario = Number(configFilho.peso)
        fontePeso = 'config_filho'
      } else if (configPai?.peso != null) {
        pesoRealUnitario = Number(configPai.peso)
        fontePeso = 'config_pai'
      } else if (Number(produto.peso) > 0 || !usarDadosPadraosPai) {
        pesoRealUnitario = Number(produto.peso)
        fontePeso = 'padrao_filho'
      } else {
        pesoRealUnitario = Number(pai!.peso)
        fontePeso = 'padrao_pai'
      }
      const pesoCubadoUnitario = this.calcularPesoCubado(fatorCubagem, cubagemM3)

      logger.info(`[Cotação] SKU=${produto.sku} transp=${regiao.transportadora.nome} | peso=${pesoRealUnitario}(${fontePeso}) cubagem=${cubagemM3} pesoCubado=${pesoCubadoUnitario} | temPai=${!!pai} configFilho=${!!configFilho} configPai=${!!configPai}`)

      pesoReal += pesoRealUnitario * quantidade
      pesoCubado += pesoCubadoUnitario * quantidade
      valorVendaTotal += valorVenda * quantidade
    }

    const pesoTaxado = this.determinarPesoTaxado(pesoReal, pesoCubado, fatorCubagem)
    const pesoFinal = this.arredondarPeso(pesoTaxado)

    // Buscar faixa que contenha o peso exato
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let faixaPreco = regiao.precos.find(
      (f: any) => pesoFinal >= Number(f.pesoInicial) && pesoFinal <= Number(f.pesoFinal)
    )
    
    let valorBase = 0
    let valorKgAdicional = 0
    let pesoExcedente = 0

    if (faixaPreco) {
      // CASO 1: Peso está dentro de uma faixa válida
      // Usa apenas o valor base, SEM kg adicional
      valorBase = Number(faixaPreco.valor)
      valorKgAdicional = 0
    } else {
      // CASO 2: Peso ultrapassa todas as faixas
      // Verifica se tem kg adicional configurado
      if (!regiao.kgAdicional || Number(regiao.kgAdicional.valorKgAdicional) <= 0) {
        throw new Error(`Nenhuma faixa de preço encontrada para peso ${pesoFinal}kg e kg adicional não configurado`)
      }

      // Pega a última faixa (maior peso final)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ultimaFaixa = regiao.precos.reduce((prev: any, current: any) =>
        Number(current.pesoFinal) > Number(prev.pesoFinal) ? current : prev
      )

      faixaPreco = ultimaFaixa
      valorBase = Number(ultimaFaixa.valor)
      
      // Calcula kg excedente: peso total - peso final da última faixa
      pesoExcedente = pesoFinal - Number(ultimaFaixa.pesoFinal)
      valorKgAdicional = pesoExcedente * Number(regiao.kgAdicional.valorKgAdicional)
    }

    const valorSemTaxas = valorBase + valorKgAdicional

    const { valorTaxas, taxasAplicadas } = this.calcularTaxas(
      regiao.taxas,
      valorSemTaxas,
      pesoTaxado,
      valorVendaTotal
    )

    const valorComTaxas = valorSemTaxas + valorTaxas

    const aliquotaICMS = regiao.taxas ? Number((regiao.taxas as unknown as { icms: number }).icms || 0) / 100 : 0
    const valorICMS = valorComTaxas * aliquotaICMS

    let valorFinal = valorComTaxas + valorICMS

    // Aplicar margem de lucro da transportadora
    const margemLucro = Number(regiao.transportadora.margemLucro || 0)
    let valorMargemLucro = 0
    if (margemLucro > 0) {
      valorMargemLucro = valorFinal * (margemLucro / 100)
      valorFinal += valorMargemLucro
    }

    const prazoCrossDocking = produtos.reduce((acc, p) => acc + p.crossDocking, 0)
    let prazoFinal = Number(faixaPreco.prazo) + prazoCrossDocking

    if (pesoCubado > pesoReal) {
      prazoFinal += 2
    }

    return {
      transportadora_id: regiao.transportadora.id,
      transportadora_nome: regiao.transportadora.nome,
      valor_frete: Math.round(valorFinal * 100) / 100,
      prazo_entrega: prazoFinal,
      peso_real: Math.round(pesoReal * 100) / 100,
      peso_cubado: Math.round(pesoCubado * 100) / 100,
      peso_taxado: Math.round(pesoTaxado * 100) / 100,
      peso_final: pesoFinal,
      detalhes: {
        valor_base: Math.round(valorBase * 100) / 100,
        valor_kg_adicional: Math.round(valorKgAdicional * 100) / 100,
        valor_taxas: Math.round(valorTaxas * 100) / 100,
        valor_icms: Math.round(valorICMS * 100) / 100,
        taxas_aplicadas: taxasAplicadas,
        faixa_utilizada: `${faixaPreco.pesoInicial}kg - ${faixaPreco.pesoFinal}kg`,
      },
    }
  }

  /**
   * Calcula todas as taxas aplicáveis
   */
  private calcularTaxas(
    taxas: Awaited<ReturnType<typeof this.buscarTransportadorasPorCep>>[0]['taxas'],
    valorBase: number,
    pesoTaxado: number,
    valorVendaTotal: number
  ): { valorTaxas: number; taxasAplicadas: TaxaAplicada[] } {
    let valorTaxas = 0
    const taxasAplicadas: TaxaAplicada[] = []

    if (!taxas) {
      return { valorTaxas, taxasAplicadas }
    }

    const taxasParaCalcular = [
      { nome: 'Frete Valor', tipo: taxas.freteTipo, valor: taxas.freteValor, minimo: taxas.freteMinimo },
      { nome: 'GRIS', tipo: taxas.grisTipo, valor: taxas.grisValor, minimo: taxas.grisMinimo },
      { nome: 'Despacho', tipo: taxas.despachoTipo, valor: taxas.despachoValor, minimo: taxas.despachoMinimo },
      { nome: 'TAS', tipo: taxas.tasTipo, valor: taxas.tasValor, minimo: taxas.tasMinimo },
    ]

    if (taxas.tdaAtivo) {
      taxasParaCalcular.push({ nome: 'TDA', tipo: taxas.tdaTipo, valor: taxas.tdaValor, minimo: taxas.tdaMinimo })
    }
    if (taxas.tdeAtivo) {
      taxasParaCalcular.push({ nome: 'TDE', tipo: taxas.tdeTipo, valor: taxas.tdeValor, minimo: taxas.tdeMinimo })
    }
    if (taxas.trfAtivo) {
      taxasParaCalcular.push({ nome: 'TRF', tipo: taxas.trfTipo, valor: taxas.trfValor, minimo: taxas.trfMinimo })
    }
    if (taxas.seguroFluvialAtivo) {
      taxasParaCalcular.push({ nome: 'Seguro Fluvial', tipo: taxas.seguroFluvialTipo, valor: taxas.seguroFluvialValor, minimo: taxas.seguroFluvialMinimo })
    }
    if (taxas.trtAtivo) {
      taxasParaCalcular.push({ nome: 'TRT', tipo: taxas.trtTipo, valor: taxas.trtValor, minimo: taxas.trtMinimo })
    }
    if (taxas.suframaAtivo) {
      taxasParaCalcular.push({ nome: 'SUFRAMA', tipo: taxas.suframaTipo, valor: taxas.suframaValor, minimo: taxas.suframaMinimo })
    }

    for (const taxa of taxasParaCalcular) {
      const valorTaxa = Number(taxa.valor)
      const minimoTaxa = Number(taxa.minimo)
      
      if (valorTaxa === 0) continue

      let valorCalculado = 0

      if (taxa.tipo === 'VALOR') {
        valorCalculado = valorTaxa
      } else if (taxa.tipo === 'PERCENTUAL') {
        // Taxas percentuais são calculadas sobre o valor da venda (mercadoria)
        valorCalculado = valorVendaTotal * (valorTaxa / 100)
        if (minimoTaxa > 0 && valorCalculado < minimoTaxa) {
          valorCalculado = minimoTaxa
        }
      }

      valorTaxas += valorCalculado

      taxasAplicadas.push({
        nome: taxa.nome,
        tipo: taxa.tipo === 'PERCENTUAL' ? 'PERCENTUAL' : 'FIXO',
        valor: valorTaxa,
        valor_calculado: Math.round(valorCalculado * 100) / 100,
      })
    }

    // Pedágio - valor fixo por 100kg (ou fração)
    const valorPedagio = Number(taxas.pedagioValor)
    if (valorPedagio > 0) {
      const fracoes100kg = Math.ceil(pesoTaxado / 100)
      const valorPedagioCalculado = fracoes100kg * valorPedagio
      
      valorTaxas += valorPedagioCalculado
      
      taxasAplicadas.push({
        nome: 'Pedágio',
        tipo: 'FIXO',
        valor: valorPedagio,
        valor_calculado: Math.round(valorPedagioCalculado * 100) / 100,
      })
    }

    return { valorTaxas, taxasAplicadas }
  }

  /**
   * Calcula o peso cubado baseado no fator de cubagem da transportadora
   * Fórmula: Fator de Cubagem x Cubagem do Produto = Peso Cubado
   * Exemplo: 300 x 0.4m³ = 120kg
   */
  private calcularPesoCubado(fatorCubagem: number, cubagemM3: number): number {
    if (fatorCubagem === 0) {
      return 0
    }
    return fatorCubagem * cubagemM3
  }

  /**
   * Determina o peso que será usado para taxação
   * Regra: Usa o MAIOR entre peso real e peso cubado
   * Se fator cubagem = 0, sempre usa peso real
   */
  private determinarPesoTaxado(pesoReal: number, pesoCubado: number, fatorCubagem: number): number {
    if (fatorCubagem === 0) {
      return pesoReal
    }
    return Math.max(pesoReal, pesoCubado)
  }

  /**
   * Retorna o peso exato sem arredondamento
   */
  private arredondarPeso(peso: number): number {
    return peso
  }

  /**
   * Salva log da cotação no banco
   */
  async salvarLogCotacao(
    cep: string,
    produtos: ProdutoCotacao[],
    resultados: ResultadoCotacao[],
    origem: string = 'MANUAL',
    marketplace?: string,
    usuarioId?: number,
    ipOrigem?: string,
    userAgent?: string,
    tempoMs?: number,
    erros?: string[]
  ): Promise<void> {
    const melhorCotacao = resultados[0]

    // Buscar dados completos dos produtos (filtrado por tenant)
    const produtosDB = await prisma.produto.findMany({
      where: {
        sku: {
          in: produtos.map(p => p.sku),
        },
        ...(usuarioId ? { usuarioId } : {}),
      },
      select: {
        id: true,
        sku: true,
        nome: true,
        peso: true,
      },
    })

    // Criar mapa de produtos por SKU para facilitar lookup
    const produtosPorSku = new Map(produtosDB.map(p => [p.sku, p]))

    await prisma.cotacaoLog.create({
      data: {
        cep,
        origem,
        marketplace,
        produtosJson: JSON.stringify(produtos),
        resultadoJson: JSON.stringify({
          cotacoes: resultados,
          _erros: erros || [],
        }),
        melhorTransportadoraId: melhorCotacao?.transportadora_id,
        melhorValor: melhorCotacao?.valor_frete,
        melhorPrazo: melhorCotacao?.prazo_entrega,
        totalTransportadoras: resultados.length,
        ipOrigem,
        userAgent,
        tempoMs,
        usuarioId,
        produtos: {
          create: produtos
            .map(p => {
              const produtoDB = produtosPorSku.get(p.sku)
              if (!produtoDB) return null

              const pesoUnitario = Number(produtoDB.peso)
              const pesoTotal = pesoUnitario * p.quantidade

              return {
                produtoId: produtoDB.id,
                produtoNome: produtoDB.nome,
                produtoSku: produtoDB.sku,
                quantidade: p.quantidade,
                pesoTotal,
                usuarioId,
              }
            })
            .filter((p): p is NonNullable<typeof p> => p !== null),
        },
      },
    })
  }
}

export const cotacaoService = new CotacaoService()
