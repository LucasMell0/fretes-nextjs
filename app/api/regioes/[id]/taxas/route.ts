import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const taxasSchema = z.object({
  // Frete Valor
  freteTipo: z.enum(['PERCENTUAL', 'VALOR']).optional(),
  freteValor: z.number().min(0).optional(),
  freteMinimo: z.number().min(0).optional(),
  
  // GRIS
  grisTipo: z.enum(['PERCENTUAL', 'VALOR']).optional(),
  grisValor: z.number().min(0).optional(),
  grisMinimo: z.number().min(0).optional(),
  
  // Despacho
  despachoTipo: z.enum(['PERCENTUAL', 'VALOR']).optional(),
  despachoValor: z.number().min(0).optional(),
  despachoMinimo: z.number().min(0).optional(),
  
  // Pedágio (valor fixo por 100kg)
  pedagioValor: z.number().min(0).optional(),
  
  // TAS
  tasTipo: z.enum(['PERCENTUAL', 'VALOR']).optional(),
  tasValor: z.number().min(0).optional(),
  tasMinimo: z.number().min(0).optional(),
  
  // TDA
  tdaAtivo: z.boolean().optional(),
  tdaTipo: z.enum(['PERCENTUAL', 'VALOR']).optional(),
  tdaValor: z.number().min(0).optional(),
  tdaMinimo: z.number().min(0).optional(),
  
  // TDE
  tdeAtivo: z.boolean().optional(),
  tdeTipo: z.enum(['PERCENTUAL', 'VALOR']).optional(),
  tdeValor: z.number().min(0).optional(),
  tdeMinimo: z.number().min(0).optional(),
  
  // TRF
  trfAtivo: z.boolean().optional(),
  trfTipo: z.enum(['PERCENTUAL', 'VALOR']).optional(),
  trfValor: z.number().min(0).optional(),
  trfMinimo: z.number().min(0).optional(),
  
  // Seguro Fluvial
  seguroFluvialAtivo: z.boolean().optional(),
  seguroFluvialTipo: z.enum(['PERCENTUAL', 'VALOR']).optional(),
  seguroFluvialValor: z.number().min(0).optional(),
  seguroFluvialMinimo: z.number().min(0).optional(),
  
  // TRT
  trtAtivo: z.boolean().optional(),
  trtTipo: z.enum(['PERCENTUAL', 'VALOR']).optional(),
  trtValor: z.number().min(0).optional(),
  trtMinimo: z.number().min(0).optional(),
  
  // SUFRAMA
  suframaAtivo: z.boolean().optional(),
  suframaTipo: z.enum(['PERCENTUAL', 'VALOR']).optional(),
  suframaValor: z.number().min(0).optional(),
  suframaMinimo: z.number().min(0).optional(),
  
  // ICMS
  icms: z.number().min(0).max(100).optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const regiaoId = parseInt(params.id)

    const regiao = await prisma.transportadoraRegiao.findUnique({
      where: { id: regiaoId },
      include: {
        transportadora: true,
        taxas: true,
      },
    })

    if (!regiao) {
      return NextResponse.json(
        { erro: 'Região não encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      regiao,
      taxas: regiao.taxas,
    })
  } catch (error) {
    return NextResponse.json(
      { erro: 'Erro ao buscar taxas' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const regiaoId = parseInt(params.id)
    const body = await request.json()

    const validation = taxasSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { erro: 'Dados inválidos', detalhes: validation.error.errors },
        { status: 400 }
      )
    }

    // Verificar se região existe
    const regiao = await prisma.transportadoraRegiao.findUnique({
      where: { id: regiaoId },
      include: { taxas: true },
    })

    if (!regiao) {
      return NextResponse.json(
        { erro: 'Região não encontrada' },
        { status: 404 }
      )
    }

    let taxas

    if (regiao.taxas) {
      // Atualizar taxas existentes
      taxas = await prisma.transportadoraRegiaoTaxa.update({
        where: { id: regiao.taxas.id },
        data: validation.data,
      })
    } else {
      // Criar novas taxas
      taxas = await prisma.transportadoraRegiaoTaxa.create({
        data: {
          transportadoraRegiaoId: regiaoId,
          ...validation.data,
        },
      })
    }

    return NextResponse.json(taxas)
  } catch (error) {
    console.error('Erro ao salvar taxas:', error)
    return NextResponse.json(
      { erro: 'Erro ao salvar taxas' },
      { status: 500 }
    )
  }
}
