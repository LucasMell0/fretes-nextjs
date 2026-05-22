import { prisma } from '@/lib/prisma'

interface FaixaPeso {
  pesoInicial: number
  pesoFinal: number
}

/**
 * Verifica se uma nova faixa de peso se sobrepõe com faixas existentes
 * Retorna true se houver sobreposição, false se estiver válida
 */
export async function verificarSobreposicaoFaixa(
  regiaoId: number,
  pesoInicial: number,
  pesoFinal: number,
  precoIdExcluir?: number
): Promise<{ sobrepoe: boolean; mensagem?: string }> {
  // Buscar todas as faixas existentes da região (exceto a que está sendo editada)
  const faixasExistentes = await prisma.transportadoraRegiaoPreco.findMany({
    where: {
      transportadoraRegiaoId: regiaoId,
      ...(precoIdExcluir ? { id: { not: precoIdExcluir } } : {}),
    },
    select: {
      id: true,
      pesoInicial: true,
      pesoFinal: true,
    },
  })

  // Verificar sobreposição com cada faixa existente
  for (const faixa of faixasExistentes) {
    const faixaInicio = Number(faixa.pesoInicial)
    const faixaFim = Number(faixa.pesoFinal)

    // Verifica se há qualquer tipo de sobreposição
    const hasSobreposicao = 
      (pesoInicial >= faixaInicio && pesoInicial <= faixaFim) || // Início da nova faixa está dentro de uma existente
      (pesoFinal >= faixaInicio && pesoFinal <= faixaFim) ||     // Fim da nova faixa está dentro de uma existente
      (pesoInicial <= faixaInicio && pesoFinal >= faixaFim)      // Nova faixa engloba uma existente

    if (hasSobreposicao) {
      return {
        sobrepoe: true,
        mensagem: `Faixa de ${pesoInicial}kg a ${pesoFinal}kg se sobrepõe com faixa existente de ${faixaInicio}kg a ${faixaFim}kg`,
      }
    }
  }

  return { sobrepoe: false }
}

/**
 * Valida múltiplas faixas de peso (útil para importação em lote)
 * Verifica sobreposição entre as próprias faixas sendo importadas
 */
export function validarFaixasEmLote(faixas: FaixaPeso[]): { valido: boolean; mensagem?: string } {
  const faixasOrdenadas = [...faixas].sort((a, b) => a.pesoInicial - b.pesoInicial)

  for (let i = 0; i < faixasOrdenadas.length; i++) {
    const faixaAtual = faixasOrdenadas[i]

    // Peso final deve ser maior ou igual ao inicial (permite faixa de ponto único, ex: 31-31)
    if (faixaAtual.pesoFinal < faixaAtual.pesoInicial) {
      return {
        valido: false,
        mensagem: `Faixa inválida: peso final (${faixaAtual.pesoFinal}kg) não pode ser menor que peso inicial (${faixaAtual.pesoInicial}kg)`,
      }
    }

    // Verificar sobreposição com próxima faixa
    if (i < faixasOrdenadas.length - 1) {
      const proximaFaixa = faixasOrdenadas[i + 1]

      if (faixaAtual.pesoFinal >= proximaFaixa.pesoInicial) {
        return {
          valido: false,
          mensagem: `Sobreposição detectada: faixa ${faixaAtual.pesoInicial}-${faixaAtual.pesoFinal}kg se sobrepõe com ${proximaFaixa.pesoInicial}-${proximaFaixa.pesoFinal}kg`,
        }
      }
    }
  }

  return { valido: true }
}
