import { NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { withAuth } from '@/lib/middleware/auth'
import { operacaoSchema, type Operacao } from '@/lib/ai/operacoes/schemas'

const aplicarPlanoSchema = z.object({
  conversaId: z.number().int().positive(),
  mensagemId: z.number().int().positive().optional(),
  operacoes: z.array(operacaoSchema).min(1, 'Plano vazio'),
})

class ConflitoOptimisticLock extends Error {
  constructor(public entidade: string, public id: number, public tipo: string) {
    super(`Estado mudou: ${entidade}#${id} foi modificada após a proposta. Recarregue a conversa.`)
  }
}

class FalhaOperacao extends Error {
  constructor(public indice: number, public tipo: string, mensagem: string) {
    super(mensagem)
  }
}

/**
 * Resolve placeholders "@criar_regiao:NOME" e "@criar_transportadora:NOME" para
 * IDs reais à medida que as operações de create são executadas.
 */
function normalizarChave(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

class ResolvedorRefs {
  // Mapeia índice da operação no plano → id criado no banco
  private idsPorIndice = new Map<number, { tipo: 'regiao' | 'transportadora'; id: number; nomeOriginal: string }>()
  // Fallback por nome quando o LLM continuar usando @criar_regiao:NOME (compat)
  private regioes: Array<{ chave: string; nomeOriginal: string; id: number }> = []
  private transportadoras: Array<{ chave: string; nomeOriginal: string; id: number }> = []

  registrarRegiao(indice: number, nome: string, id: number) {
    this.idsPorIndice.set(indice, { tipo: 'regiao', id, nomeOriginal: nome })
    this.regioes.push({ chave: normalizarChave(nome), nomeOriginal: nome, id })
  }
  registrarTransportadora(indice: number, nome: string, id: number) {
    this.idsPorIndice.set(indice, { tipo: 'transportadora', id, nomeOriginal: nome })
    this.transportadoras.push({ chave: normalizarChave(nome), nomeOriginal: nome, id })
  }

  private resolverPorNome(
    lista: Array<{ chave: string; nomeOriginal: string; id: number }>,
    nomeBuscado: string,
    rotulo: string
  ): number {
    if (lista.length === 0) {
      throw new Error(`${rotulo} "${nomeBuscado}" não foi criada antes nesta sequência (nenhuma criação anterior).`)
    }
    const chaveBuscada = normalizarChave(nomeBuscado)
    const exato = lista.find(e => e.chave === chaveBuscada)
    if (exato) return exato.id
    const sub = lista.find(e => e.chave.includes(chaveBuscada) || chaveBuscada.includes(e.chave))
    if (sub) return sub.id
    const disponiveis = lista.map(e => `"${e.nomeOriginal}"`).join(', ')
    throw new Error(
      `${rotulo} "${nomeBuscado}" não bate com nenhuma criada nesta sequência. Disponíveis: ${disponiveis}. Use no placeholder "@op:N" onde N é o índice (0-based) da operação que criou a região.`
    )
  }

  resolverRegiaoId(valor: number | string): number {
    if (typeof valor === 'number') return valor
    const matchOp = /^@op:(\d+)$/.exec(valor)
    if (matchOp) {
      const idx = parseInt(matchOp[1], 10)
      const ref = this.idsPorIndice.get(idx)
      if (!ref || ref.tipo !== 'regiao') {
        throw new Error(`@op:${idx} não referencia uma região criada anteriormente neste plano.`)
      }
      return ref.id
    }
    const matchNome = /^@criar_regiao:(.+)$/.exec(valor)
    if (matchNome) return this.resolverPorNome(this.regioes, matchNome[1], 'Região')
    throw new Error(`regiaoId inválido: ${valor}. Use número (ID existente) ou "@op:N" referenciando o índice da operação criadora.`)
  }

  resolverTransportadoraId(valor: number | string): number {
    if (typeof valor === 'number') return valor
    const matchOp = /^@op:(\d+)$/.exec(valor)
    if (matchOp) {
      const idx = parseInt(matchOp[1], 10)
      const ref = this.idsPorIndice.get(idx)
      if (!ref || ref.tipo !== 'transportadora') {
        throw new Error(`@op:${idx} não referencia uma transportadora criada anteriormente neste plano.`)
      }
      return ref.id
    }
    const matchNome = /^@criar_transportadora:(.+)$/.exec(valor)
    if (matchNome) return this.resolverPorNome(this.transportadoras, matchNome[1], 'Transportadora')
    throw new Error(`transportadoraId inválido: ${valor}.`)
  }
}

function normalizarCep(cep: string): string {
  return cep.replace(/\D/g, '').padStart(8, '0').replace(/^(\d{5})(\d{3})$/, '$1-$2')
}

async function aplicarOperacao(
  tx: Prisma.TransactionClient,
  op: Operacao,
  indice: number,
  userId: number,
  refs: ResolvedorRefs
): Promise<{ tipo: string; resultado: unknown }> {
  try {
    switch (op.tipo) {
      case 'criar_transportadora': {
        const t = await tx.transportadora.create({
          data: {
            usuarioId: userId,
            nome: op.nome,
            fatorCubagem: op.fatorCubagem,
            margemLucro: op.margemLucro,
          },
        })
        refs.registrarTransportadora(indice, op.nome, t.id)
        return { tipo: op.tipo, resultado: { id: t.id, nome: t.nome } }
      }
      case 'editar_transportadora': {
        const existente = await tx.transportadora.findFirst({
          where: { id: op.id, usuarioId: userId },
          select: { id: true, dataAtualizacao: true },
        })
        if (!existente) throw new FalhaOperacao(indice, op.tipo, `Transportadora ${op.id} não encontrada`)
        if (existente.dataAtualizacao.toISOString() !== op.dataAtualizacaoEsperada) {
          throw new ConflitoOptimisticLock('Transportadora', op.id, op.tipo)
        }
        const t = await tx.transportadora.update({
          where: { id: op.id },
          data: {
            ...(op.nome !== undefined && { nome: op.nome }),
            ...(op.fatorCubagem !== undefined && { fatorCubagem: op.fatorCubagem }),
            ...(op.margemLucro !== undefined && { margemLucro: op.margemLucro }),
            ...(op.ativo !== undefined && { ativo: op.ativo }),
          },
        })
        return { tipo: op.tipo, resultado: { id: t.id } }
      }
      case 'excluir_transportadora': {
        const existente = await tx.transportadora.findFirst({
          where: { id: op.id, usuarioId: userId },
          select: { id: true, dataAtualizacao: true },
        })
        if (!existente) throw new FalhaOperacao(indice, op.tipo, `Transportadora ${op.id} não encontrada`)
        if (existente.dataAtualizacao.toISOString() !== op.dataAtualizacaoEsperada) {
          throw new ConflitoOptimisticLock('Transportadora', op.id, op.tipo)
        }
        await tx.transportadora.delete({ where: { id: op.id } })
        return { tipo: op.tipo, resultado: { id: op.id } }
      }
      case 'criar_regiao': {
        const transportadoraId = refs.resolverTransportadoraId(op.transportadoraId)
        // Garante que a transportadora pertence ao usuário
        const t = await tx.transportadora.findFirst({
          where: { id: transportadoraId, usuarioId: userId },
          select: { id: true },
        })
        if (!t) throw new FalhaOperacao(indice, op.tipo, `Transportadora ${transportadoraId} não pertence ao usuário`)
        const r = await tx.transportadoraRegiao.create({
          data: {
            transportadoraId,
            usuarioId: userId,
            nome: op.nome,
            cepInicio: normalizarCep(op.cepInicio),
            cepFim: normalizarCep(op.cepFim),
          },
        })
        refs.registrarRegiao(indice, op.nome, r.id)
        return { tipo: op.tipo, resultado: { id: r.id, nome: r.nome } }
      }
      case 'editar_regiao': {
        const existente = await tx.transportadoraRegiao.findFirst({
          where: { id: op.id, usuarioId: userId },
          select: { id: true, dataAtualizacao: true },
        })
        if (!existente) throw new FalhaOperacao(indice, op.tipo, `Região ${op.id} não encontrada`)
        if (existente.dataAtualizacao.toISOString() !== op.dataAtualizacaoEsperada) {
          throw new ConflitoOptimisticLock('Região', op.id, op.tipo)
        }
        const r = await tx.transportadoraRegiao.update({
          where: { id: op.id },
          data: {
            ...(op.nome !== undefined && { nome: op.nome }),
            ...(op.cepInicio !== undefined && { cepInicio: normalizarCep(op.cepInicio) }),
            ...(op.cepFim !== undefined && { cepFim: normalizarCep(op.cepFim) }),
            ...(op.ativo !== undefined && { ativo: op.ativo }),
          },
        })
        return { tipo: op.tipo, resultado: { id: r.id } }
      }
      case 'excluir_regiao': {
        const existente = await tx.transportadoraRegiao.findFirst({
          where: { id: op.id, usuarioId: userId },
          select: { id: true, dataAtualizacao: true },
        })
        if (!existente) throw new FalhaOperacao(indice, op.tipo, `Região ${op.id} não encontrada`)
        if (existente.dataAtualizacao.toISOString() !== op.dataAtualizacaoEsperada) {
          throw new ConflitoOptimisticLock('Região', op.id, op.tipo)
        }
        await tx.transportadoraRegiao.delete({ where: { id: op.id } })
        return { tipo: op.tipo, resultado: { id: op.id } }
      }
      case 'criar_faixa_peso': {
        const regiaoId = refs.resolverRegiaoId(op.regiaoId)
        const r = await tx.transportadoraRegiao.findFirst({
          where: { id: regiaoId, usuarioId: userId },
          select: { id: true },
        })
        if (!r) throw new FalhaOperacao(indice, op.tipo, `Região ${regiaoId} não pertence ao usuário`)
        const f = await tx.transportadoraRegiaoPreco.create({
          data: {
            transportadoraRegiaoId: regiaoId,
            pesoInicial: op.pesoInicial,
            pesoFinal: op.pesoFinal,
            valor: op.valor,
            prazo: op.prazo,
          },
        })
        return { tipo: op.tipo, resultado: { id: f.id } }
      }
      case 'editar_faixa_peso': {
        const existente = await tx.transportadoraRegiaoPreco.findFirst({
          where: { id: op.id, regiao: { usuarioId: userId } },
          select: { id: true, dataAtualizacao: true },
        })
        if (!existente) throw new FalhaOperacao(indice, op.tipo, `Faixa de peso ${op.id} não encontrada`)
        if (existente.dataAtualizacao.toISOString() !== op.dataAtualizacaoEsperada) {
          throw new ConflitoOptimisticLock('Faixa de Peso', op.id, op.tipo)
        }
        const f = await tx.transportadoraRegiaoPreco.update({
          where: { id: op.id },
          data: {
            ...(op.pesoInicial !== undefined && { pesoInicial: op.pesoInicial }),
            ...(op.pesoFinal !== undefined && { pesoFinal: op.pesoFinal }),
            ...(op.valor !== undefined && { valor: op.valor }),
            ...(op.prazo !== undefined && { prazo: op.prazo }),
          },
        })
        return { tipo: op.tipo, resultado: { id: f.id } }
      }
      case 'excluir_faixa_peso': {
        const existente = await tx.transportadoraRegiaoPreco.findFirst({
          where: { id: op.id, regiao: { usuarioId: userId } },
          select: { id: true, dataAtualizacao: true },
        })
        if (!existente) throw new FalhaOperacao(indice, op.tipo, `Faixa de peso ${op.id} não encontrada`)
        if (existente.dataAtualizacao.toISOString() !== op.dataAtualizacaoEsperada) {
          throw new ConflitoOptimisticLock('Faixa de Peso', op.id, op.tipo)
        }
        await tx.transportadoraRegiaoPreco.delete({ where: { id: op.id } })
        return { tipo: op.tipo, resultado: { id: op.id } }
      }
      case 'definir_kg_adicional': {
        const regiaoId = refs.resolverRegiaoId(op.regiaoId)
        const r = await tx.transportadoraRegiao.findFirst({
          where: { id: regiaoId, usuarioId: userId },
          select: { id: true },
        })
        if (!r) throw new FalhaOperacao(indice, op.tipo, `Região ${regiaoId} não pertence ao usuário`)
        const k = await tx.transportadoraRegiaoKgAdicional.upsert({
          where: { transportadoraRegiaoId: regiaoId },
          create: { transportadoraRegiaoId: regiaoId, valorKgAdicional: op.valorKgAdicional },
          update: { valorKgAdicional: op.valorKgAdicional },
        })
        return { tipo: op.tipo, resultado: { id: k.id } }
      }
      case 'definir_taxas': {
        const regiaoId = refs.resolverRegiaoId(op.regiaoId)
        const r = await tx.transportadoraRegiao.findFirst({
          where: { id: regiaoId, usuarioId: userId },
          select: { id: true },
        })
        if (!r) throw new FalhaOperacao(indice, op.tipo, `Região ${regiaoId} não pertence ao usuário`)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updateData: any = {}
        if (op.frete?.tipo) updateData.freteTipo = op.frete.tipo
        if (op.frete?.valor !== undefined) updateData.freteValor = op.frete.valor
        if (op.frete?.minimo !== undefined) updateData.freteMinimo = op.frete.minimo
        if (op.gris?.tipo) updateData.grisTipo = op.gris.tipo
        if (op.gris?.valor !== undefined) updateData.grisValor = op.gris.valor
        if (op.gris?.minimo !== undefined) updateData.grisMinimo = op.gris.minimo
        if (op.despacho?.tipo) updateData.despachoTipo = op.despacho.tipo
        if (op.despacho?.valor !== undefined) updateData.despachoValor = op.despacho.valor
        if (op.despacho?.minimo !== undefined) updateData.despachoMinimo = op.despacho.minimo
        if (op.pedagioValor !== undefined) updateData.pedagioValor = op.pedagioValor
        if (op.tas?.tipo) updateData.tasTipo = op.tas.tipo
        if (op.tas?.valor !== undefined) updateData.tasValor = op.tas.valor
        if (op.tas?.minimo !== undefined) updateData.tasMinimo = op.tas.minimo
        const opts: Array<['tda' | 'tde' | 'trf' | 'seguroFluvial' | 'trt' | 'suframa', string]> = [
          ['tda', 'tda'], ['tde', 'tde'], ['trf', 'trf'],
          ['seguroFluvial', 'seguroFluvial'], ['trt', 'trt'], ['suframa', 'suframa'],
        ]
        for (const [k, prefix] of opts) {
          const v = op[k]
          if (!v) continue
          if (v.ativo !== undefined) updateData[`${prefix}Ativo`] = v.ativo
          if (v.tipo) updateData[`${prefix}Tipo`] = v.tipo
          if (v.valor !== undefined) updateData[`${prefix}Valor`] = v.valor
          if (v.minimo !== undefined) updateData[`${prefix}Minimo`] = v.minimo
        }
        if (op.icms !== undefined) updateData.icms = op.icms

        const tx_ = await tx.transportadoraRegiaoTaxa.upsert({
          where: { transportadoraRegiaoId: regiaoId },
          create: { transportadoraRegiaoId: regiaoId, ...updateData },
          update: updateData,
        })
        return { tipo: op.tipo, resultado: { id: tx_.id } }
      }
      case 'editar_produto': {
        const existente = await tx.produto.findFirst({
          where: { id: op.id, usuarioId: userId },
          select: { id: true, dataAtualizacao: true },
        })
        if (!existente) throw new FalhaOperacao(indice, op.tipo, `Produto ${op.id} não encontrado`)
        if (existente.dataAtualizacao.toISOString() !== op.dataAtualizacaoEsperada) {
          throw new ConflitoOptimisticLock('Produto', op.id, op.tipo)
        }
        const p = await tx.produto.update({
          where: { id: op.id },
          data: {
            ...(op.nome !== undefined && { nome: op.nome }),
            ...(op.peso !== undefined && { peso: op.peso }),
            ...(op.cubagem !== undefined && { cubagem: op.cubagem }),
            ...(op.ativo !== undefined && { ativo: op.ativo }),
          },
        })
        return { tipo: op.tipo, resultado: { id: p.id } }
      }
      default:
        throw new Error(`Operação não suportada: ${String((op as { tipo?: unknown }).tipo)}`)
    }
  } catch (e) {
    if (e instanceof ConflitoOptimisticLock) throw e
    if (e instanceof FalhaOperacao) throw e
    const tipo = String((op as { tipo?: unknown }).tipo ?? 'desconhecido')
    if (e instanceof Error) throw new FalhaOperacao(indice, tipo, e.message)
    throw new FalhaOperacao(indice, tipo, 'Erro desconhecido')
  }
}

export const POST = withAuth(async (req, { userId }) => {
  const body = await req.json()
  const validation = aplicarPlanoSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json(
      { erro: 'Plano inválido', detalhes: validation.error.errors },
      { status: 400 }
    )
  }
  const { conversaId, operacoes } = validation.data

  // Confirma que a conversa pertence ao usuário e é de Escrita
  const conversa = await prisma.assistenteConversa.findFirst({
    where: { id: conversaId, usuarioId: userId },
    select: { id: true, agente: true },
  })
  if (!conversa) {
    return NextResponse.json({ erro: 'Conversa não encontrada' }, { status: 404 })
  }
  if (conversa.agente !== 'ESCRITA') {
    return NextResponse.json({ erro: 'Apenas conversas de Escrita podem aplicar planos' }, { status: 400 })
  }

  try {
    const resultados = await prisma.$transaction(async (tx) => {
      const refs = new ResolvedorRefs()
      const res: Array<{ tipo: string; resultado: unknown }> = []
      for (let i = 0; i < operacoes.length; i++) {
        res.push(await aplicarOperacao(tx, operacoes[i], i, userId, refs))
      }
      return res
    })
    return NextResponse.json({ ok: true, aplicadas: resultados.length, resultados })
  } catch (e) {
    if (e instanceof ConflitoOptimisticLock) {
      return NextResponse.json(
        { erro: e.message, tipo: 'CONFLITO_ESTADO', entidade: e.entidade, id: e.id },
        { status: 409 }
      )
    }
    if (e instanceof FalhaOperacao) {
      return NextResponse.json(
        {
          erro: `Falha na operação ${e.indice + 1} (${e.tipo}): ${e.message}`,
          tipo: 'FALHA_OPERACAO',
          indice: e.indice,
          operacaoTipo: e.tipo,
        },
        { status: 400 }
      )
    }
    logger.error('Erro ao aplicar plano:', e)
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : 'Erro desconhecido' },
      { status: 500 }
    )
  }
})
