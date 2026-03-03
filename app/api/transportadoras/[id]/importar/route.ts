import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ImportacaoService } from '@/lib/services/importacao.service'
import { importacaoRequestSchema } from '@/lib/validators/importacao.validator'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { erro: 'Não autorizado' },
        { status: 401 }
      )
    }

    const transportadoraId = parseInt(params.id)
    
    if (isNaN(transportadoraId)) {
      return NextResponse.json(
        { erro: 'ID da transportadora inválido' },
        { status: 400 }
      )
    }

    const body = await req.json()
    
    const validacao = importacaoRequestSchema.safeParse({
      transportadoraId,
      regioes: body.regioes
    })

    if (!validacao.success) {
      return NextResponse.json(
        { 
          erro: 'Dados inválidos',
          detalhes: validacao.error.errors 
        },
        { status: 400 }
      )
    }

    const service = new ImportacaoService()
    const resultado = await service.importarRegioes(
      transportadoraId,
      parseInt(session.user.id),
      validacao.data.regioes
    )

    if (!resultado.sucesso) {
      return NextResponse.json(
        { 
          erro: 'Erro ao importar regiões',
          detalhes: resultado.erros 
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      sucesso: true,
      regioesImportadas: resultado.regioesImportadas,
      faixasImportadas: resultado.faixasImportadas,
      mensagem: `Importação concluída! ${resultado.regioesImportadas} regiões e ${resultado.faixasImportadas} faixas de peso importadas.`
    })
  } catch (error) {
    console.error('Erro na importação:', error)
    return NextResponse.json(
      { erro: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
