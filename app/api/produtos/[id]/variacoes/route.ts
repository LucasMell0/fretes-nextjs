import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const variacaoTipoSchema = z.object({
  nome: z.string().min(1),
  valores: z.array(z.string().min(1)),
})

const gerarVariacoesSchema = z.object({
  skuBase: z.string().min(1),
  tipos: z.array(variacaoTipoSchema).min(1),
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const produtoPaiId = parseInt(params.id)

    // Verificar se produto pai existe
    const produtoPai = await prisma.produto.findUnique({
      where: { id: produtoPaiId },
    })

    if (!produtoPai || produtoPai.produtoPaiId !== null) {
      return NextResponse.json(
        { erro: 'Produto não encontrado ou não é um produto pai' },
        { status: 404 }
      )
    }

    // Buscar variações
    const variacoes = await prisma.produto.findMany({
      where: { produtoPaiId: produtoPaiId },
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
    return NextResponse.json(
      { erro: 'Erro ao buscar variações' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const produtoPaiId = parseInt(params.id)
    const body = await request.json()
    
    const validation = gerarVariacoesSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { erro: 'Dados inválidos', detalhes: validation.error.errors },
        { status: 400 }
      )
    }

    const { skuBase, tipos } = validation.data

    // Buscar produto pai
    const produtoPai = await prisma.produto.findUnique({
      where: { id: produtoPaiId },
    })

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

    const variacoesCriadas = []
    const erros = []

    for (const combinacao of combinacoes) {
      // Gerar SKU e nome
      const sufixo = combinacao.map(c => c.valor.toUpperCase()).join('-')
      const skuVariacao = `${skuBase}-${sufixo}`
      const nomeVariacao = `${produtoPai.nome}-${sufixo}`

      // Verificar se SKU já existe
      const existente = await prisma.produto.findUnique({
        where: { sku: skuVariacao },
      })

      if (existente) {
        erros.push(`SKU '${skuVariacao}' já existe`)
        continue
      }

      // Criar variação
      const variacao = await prisma.produto.create({
        data: {
          produtoPaiId: produtoPaiId,
          nome: nomeVariacao,
          sku: skuVariacao,
          peso: produtoPai.peso,
          cubagem: produtoPai.cubagem,
          crossDocking: produtoPai.crossDocking,
          estoque: 0,
          ativo: true,
          atributos: {
            create: combinacao.map(c => ({
              atributo: c.tipo,
              valor: c.valor,
            })),
          },
        },
        include: {
          atributos: true,
        },
      })

      variacoesCriadas.push(variacao)
    }

    return NextResponse.json({
      sucesso: true,
      total: variacoesCriadas.length,
      variacoes: variacoesCriadas,
      erros,
    })
  } catch (error) {
    console.error('Erro ao gerar variações:', error)
    return NextResponse.json(
      { erro: 'Erro ao gerar variações' },
      { status: 500 }
    )
  }
}
