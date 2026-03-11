import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { withAuthTyped } from '@/lib/middleware/auth'
import { parseRouteId } from '@/lib/utils/parse'
import { verifyOwnership } from '@/lib/utils/ownership'
import type { ProdutoWithProdutoPaiId } from '@/lib/types/prisma-helpers'

interface RouteParams {
  id: string
}

const variacaoTipoSchema = z.object({
  nome: z.string().min(1),
  valores: z.array(z.string().min(1)),
})

const gerarVariacoesSchema = z.object({
  skuBase: z.string().min(1),
  tipos: z.array(variacaoTipoSchema).min(1),
})

export const GET = withAuthTyped<RouteParams>(async (req, { userId }, params) => {
  try {
    const produtoPaiId = parseRouteId(params!.id)

    const produtoPai = await verifyOwnership<ProdutoWithProdutoPaiId>(
      prisma.produto,
      produtoPaiId,
      userId
    )

    if (!produtoPai || produtoPai.produtoPaiId !== null) {
      return NextResponse.json(
        { erro: 'Produto não encontrado, sem permissão ou não é um produto pai' },
        { status: 404 }
      )
    }

    // Buscar variações (filtradas por usuário)
    const variacoes = await prisma.produto.findMany({
      where: {
        produtoPaiId: produtoPaiId,
        usuarioId: userId
      },
      include: {
        atributos: true,
      },
      orderBy: { sku: 'asc' },
    })

    return NextResponse.json({
      produtoPai,
      variacoes,
    })
  } catch (error) {
    logger.error('Erro ao buscar variações:', error)
    return NextResponse.json(
      { erro: 'Erro ao buscar variações' },
      { status: 500 }
    )
  }
})

export const POST = withAuthTyped<RouteParams>(async (req, { userId }, params) => {
  try {
    const produtoPaiId = parseRouteId(params!.id)
    const body = await req.json()
    
    const validation = gerarVariacoesSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { erro: 'Dados inválidos', detalhes: validation.error.errors },
        { status: 400 }
      )
    }

    const { skuBase, tipos } = validation.data

    const produtoPai = await verifyOwnership<ProdutoWithProdutoPaiId>(
      prisma.produto,
      produtoPaiId,
      userId
    )

    if (!produtoPai || produtoPai.produtoPaiId !== null) {
      return NextResponse.json(
        { erro: 'Produto pai não encontrado' },
        { status: 404 }
      )
    }

    // Gerar todas as combinações
    let combinacoes: Array<Array<{ tipo: string; valor: string }>> = [[]]

    for (const tipo of tipos) {
      const novasCombinacoes: Array<Array<{ tipo: string; valor: string }>> = []
      for (const combinacao of combinacoes) {
        for (const valor of tipo.valores) {
          novasCombinacoes.push([...combinacao, { tipo: tipo.nome, valor }])
        }
      }
      combinacoes = novasCombinacoes
    }

    // OTIMIZAÇÃO: Gerar todos os SKUs primeiro
    const variacoesParaCriar = combinacoes.map(combinacao => {
      const sufixoSKU = combinacao.map(c => c.valor).join('-')
      const nomeVariacao = `${produtoPai.nome} - ${combinacao.map(c => c.valor).join(' ')}`
      
      return {
        sku: `${skuBase}-${sufixoSKU}`,
        nome: nomeVariacao,
        combinacao,
      }
    })

    // OTIMIZAÇÃO: Verificar todos os SKUs de uma vez (1 query ao invés de N)
    const skusParaVerificar = variacoesParaCriar.map(v => v.sku)
    const produtosExistentes = await prisma.produto.findMany({
      where: {
        sku: { in: skusParaVerificar },
        usuarioId: userId,
      },
      select: { sku: true },
    })

    // Criar Set de SKUs existentes para lookup O(1)
    const skusExistentes = new Set(produtosExistentes.map(p => p.sku))

    // Filtrar variações válidas e preparar erros
    const erros: string[] = []
    const variacoesValidas = variacoesParaCriar.filter(v => {
      if (skusExistentes.has(v.sku)) {
        erros.push(`SKU '${v.sku}' já existe`)
        return false
      }
      return true
    })

    // OTIMIZAÇÃO: Criar todas as variações em uma transação
    const variacoesCriadas = await prisma.$transaction(async (tx) => {
      const created = []
      
      for (const variacao of variacoesValidas) {
        const variacaoCriada = await tx.produto.create({
          data: {
            produtoPaiId: produtoPaiId,
            nome: variacao.nome,
            sku: variacao.sku,
            peso: produtoPai.peso,
            cubagem: produtoPai.cubagem,
            crossDocking: produtoPai.crossDocking,
            estoque: produtoPai.estoque,
            ativo: true,
            usuarioId: userId,
            atributos: {
              create: variacao.combinacao.map(c => ({
                atributo: c.tipo,
                valor: c.valor,
              })),
            },
          },
          include: {
            atributos: true,
          },
        })
        
        created.push(variacaoCriada)
      }
      
      return created
    })

    return NextResponse.json({
      sucesso: true,
      total: variacoesCriadas.length,
      variacoes: variacoesCriadas,
      erros,
    })
  } catch (error) {
    logger.error('Erro ao gerar variações:', error)
    return NextResponse.json(
      { erro: 'Erro ao gerar variações' },
      { status: 500 }
    )
  }
})
