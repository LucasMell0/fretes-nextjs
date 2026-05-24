import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { cache } from '@/lib/cache'
import type {
  ProdutoCotacao,
  ResultadoCotacao,
  TaxaAplicada,
} from '@/types/cotacao'

export type ProdutoLog = { id: number; sku: string; nome: string; peso: unknown }

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
  async cotar(cep: string, produtos: ProdutoCotacao[], usuarioId?: number): Promise<{ cotacoes: ResultadoCotacao[]; erros: string[]; produtosDB?: ProdutoLog[] }> {
    const cepLimpo = cep.replace(/\D/g, '')

    // Cache do resultado final: mesmo CEP + SKUs + quantidades = mesmo resultado
    const skusKey = produtos.map(p => `${p.sku}:${p.quantidade}:${p.valor || 0}`).sort().join('|')
    const cotacaoCacheKey = `cotacao:${usuarioId}:${cepLimpo}:${skusKey}`
    const cachedResult = await cache.get<{ cotacoes: ResultadoCotacao[]; erros: string[]; produtosDB?: ProdutoLog[] }>(cotacaoCacheKey)
    if (cachedResult) return cachedResult

    // Buscar regiões, produtos e config do usuário em PARALELO
    const [regioes, produtosCompletos, cotarPorUnidade] = await Promise.all([
      this.buscarTransportadorasPorCep(cepLimpo, usuarioId),
      this.buscarDadosProdutos(produtos, usuarioId),
      this.buscarConfigCotarPorUnidade(usuarioId),
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
        return await this.calcularCotacao(regiao, produtosCompletos, cotarPorUnidade)
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

    const produtosDB: ProdutoLog[] = produtosCompletos.map(p => ({
      id: p.id,
      sku: p.sku,
      nome: p.nome,
      peso: p.peso,
    }))

    const resultado = {
      cotacoes: cotacoes.sort((a, b) => a.valor_frete - b.valor_frete),
      erros: errosPorTransportadora,
      produtosDB,
    }

    // Cachear resultado final por 30 segundos (fire-and-forget — não bloqueia resposta)
    if (cotacoes.length > 0) {
      cache.set(cotacaoCacheKey, resultado, 30).catch(() => {})
    }

    return resultado
  }

  /**
   * Busca transportadoras que atendem o CEP informado (com cache de 60s)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async buscarTransportadorasPorCep(cep: string, usuarioId?: number): Promise<any[]> {
    const cacheKey = `regioes:${usuarioId}:${cep}`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cached = await cache.get<any[]>(cacheKey)
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

    cache.set(cacheKey, result, 300).catch(() => {}) // 5 minutos (fire-and-forget)
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
    const cachedDB = await cache.get<any[]>(cacheKey)

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

      cache.set(cacheKey, produtosDB, 300).catch(() => {}) // 5 minutos (fire-and-forget)
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
   * Lê do banco o flag global do usuário "cotarPorUnidade".
   * Cacheado por 5min via lib/cache.
   */
  private async buscarConfigCotarPorUnidade(usuarioId?: number): Promise<boolean> {
    if (!usuarioId) return false
    const cacheKey = `usuario-config:${usuarioId}`
    const cached = await cache.get<{ cotarPorUnidade: boolean }>(cacheKey)
    if (cached) return cached.cotarPorUnidade

    const u = await prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { cotarPorUnidade: true },
    })
    const valor = u?.cotarPorUnidade ?? false
    cache.set(cacheKey, { cotarPorUnidade: valor }, 300).catch(() => {})
    return valor
  }

  /**
   * Extrai peso e cubagem unitários de UM produto respeitando a cadeia
   * config-filho → config-pai → padrão-filho → padrão-pai (com flag).
   */
  private obterPesoCubagemUnitario(
    produto: Awaited<ReturnType<typeof this.buscarDadosProdutos>>[0],
    regiao: Awaited<ReturnType<typeof this.buscarTransportadorasPorCep>>[0]
  ): { pesoRealUnitario: number; pesoCubadoUnitario: number; cubagemM3: number } {
    const fatorCubagem = Number(regiao.transportadora.fatorCubagem)
    const pai = produto.produtoPai as typeof produto | null
    const usarDadosPadraosPai = !!(pai && (pai as unknown as { usarDadosPaiParaVariacoes: boolean }).usarDadosPaiParaVariacoes)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const configFilho = produto.cubagens.find((c: any) => c.transportadoraId === regiao.transportadoraId)
    const configPai = pai
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? pai.cubagens.find((c: any) => c.transportadoraId === regiao.transportadoraId)
      : undefined

    let cubagemM3: number
    if (configFilho?.cubagem != null) cubagemM3 = Number(configFilho.cubagem)
    else if (usarDadosPadraosPai && configPai?.cubagem != null) cubagemM3 = Number(configPai.cubagem)
    else if (Number(produto.cubagem) > 0 || !usarDadosPadraosPai) cubagemM3 = Number(produto.cubagem)
    else cubagemM3 = Number(pai!.cubagem)

    let pesoRealUnitario: number
    if (configFilho?.peso != null) pesoRealUnitario = Number(configFilho.peso)
    else if (usarDadosPadraosPai && configPai?.peso != null) pesoRealUnitario = Number(configPai.peso)
    else if (Number(produto.peso) > 0 || !usarDadosPadraosPai) pesoRealUnitario = Number(produto.peso)
    else pesoRealUnitario = Number(pai!.peso)

    const pesoCubadoUnitario = this.calcularPesoCubado(fatorCubagem, cubagemM3)
    return { pesoRealUnitario, pesoCubadoUnitario, cubagemM3 }
  }

  /**
   * Dado um peso taxado, encontra a faixa de preço aplicável e calcula
   * valor base + kg adicional (se peso excede a última faixa).
   * Throw se peso não cabe em nenhuma faixa e não tem kg adicional configurado.
   */
  private resolverFaixa(
    regiao: Awaited<ReturnType<typeof this.buscarTransportadorasPorCep>>[0],
    pesoTaxado: number,
    sku?: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): { valorBase: number; valorKgAdicional: number; faixaUsada: any } {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let faixaUsada: any = regiao.precos.find(
      (f: { pesoInicial: number | string; pesoFinal: number | string }) =>
        pesoTaxado >= Number(f.pesoInicial) && pesoTaxado <= Number(f.pesoFinal)
    )

    if (faixaUsada) {
      return { valorBase: Number(faixaUsada.valor), valorKgAdicional: 0, faixaUsada }
    }

    if (!regiao.kgAdicional || Number(regiao.kgAdicional.valorKgAdicional) <= 0) {
      const ctx = sku ? ` (SKU ${sku})` : ''
      throw new Error(`Nenhuma faixa de preço encontrada para peso ${pesoTaxado}kg${ctx} e kg adicional não configurado`)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    faixaUsada = regiao.precos.reduce((prev: any, current: any) =>
      Number(current.pesoFinal) > Number(prev.pesoFinal) ? current : prev
    )
    const valorBase = Number(faixaUsada.valor)
    const pesoExcedente = pesoTaxado - Number(faixaUsada.pesoFinal)
    const valorKgAdicional = pesoExcedente * Number(regiao.kgAdicional.valorKgAdicional)
    return { valorBase, valorKgAdicional, faixaUsada }
  }

  /**
   * Calcula cotação para uma transportadora/região específica
   */
  private async calcularCotacao(
    regiao: Awaited<ReturnType<typeof this.buscarTransportadorasPorCep>>[0],
    produtos: Awaited<ReturnType<typeof this.buscarDadosProdutos>>,
    cotarPorUnidade = false
  ): Promise<ResultadoCotacao> {
    const fatorCubagem = Number(regiao.transportadora.fatorCubagem)

    let pesoReal = 0
    let pesoCubado = 0
    let valorVendaTotal = 0

    // Modo "cotar por unidade": acumula valor base e kg adicional por produto
    // (cada SKU vira uma sub-cotação independente — busca faixa por peso de 1 unidade
    //  e multiplica pelo quantidade). No modo padrão isso é calculado uma vez no fim.
    let valorBaseAcumulado = 0
    let valorKgAdicionalAcumulado = 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let faixaUsadaParaPrazo: any = null

    for (const produto of produtos) {
      const quantidade = (produto as unknown as { quantidade: number }).quantidade || 1
      const valorVenda = (produto as unknown as { valorVenda: number }).valorVenda || 0

      const { pesoRealUnitario, pesoCubadoUnitario } = this.obterPesoCubagemUnitario(produto, regiao)

      pesoReal += pesoRealUnitario * quantidade
      pesoCubado += pesoCubadoUnitario * quantidade
      valorVendaTotal += valorVenda * quantidade

      if (cotarPorUnidade) {
        // Cota 1 unidade desse produto e multiplica o valor pela quantidade
        const pesoTaxadoUnit = this.determinarPesoTaxado(pesoRealUnitario, pesoCubadoUnitario, fatorCubagem)
        const subCotacao = this.resolverFaixa(regiao, pesoTaxadoUnit, produto.sku)
        valorBaseAcumulado += subCotacao.valorBase * quantidade
        valorKgAdicionalAcumulado += subCotacao.valorKgAdicional * quantidade
        if (!faixaUsadaParaPrazo) faixaUsadaParaPrazo = subCotacao.faixaUsada
      }
    }

    const pesoTaxado = this.determinarPesoTaxado(pesoReal, pesoCubado, fatorCubagem)
    const pesoFinal = this.arredondarPeso(pesoTaxado)

    let valorBase: number
    let valorKgAdicional: number
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let faixaPreco: any

    if (cotarPorUnidade) {
      valorBase = valorBaseAcumulado
      valorKgAdicional = valorKgAdicionalAcumulado
      faixaPreco = faixaUsadaParaPrazo
    } else {
      // Modo somatório (atual): uma única busca de faixa pelo peso total
      const resolvido = this.resolverFaixa(regiao, pesoFinal)
      valorBase = resolvido.valorBase
      valorKgAdicional = resolvido.valorKgAdicional
      faixaPreco = resolvido.faixaUsada
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

    // Cross-docking dos produtos opera em paralelo — usa o maior, não soma.
    const prazoCrossDocking = produtos.reduce((acc, p) => Math.max(acc, p.crossDocking || 0), 0)
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
    erros?: string[],
    respostaCanal?: Record<string, unknown>,
    produtosDBCarregados?: ProdutoLog[]
  ): Promise<void> {
    const melhorCotacao = resultados[0]

    // Reusar produtos já carregados em cotar() para evitar query extra; fallback se não vier
    const produtosDB: ProdutoLog[] = produtosDBCarregados ?? await prisma.produto.findMany({
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
          _respostaCanal: respostaCanal || null,
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
