import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import { withAuth } from '@/lib/middleware/auth'

const perfilSchema = z.object({
  nome: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  email: z.string().email('E-mail inválido'),
})

export const GET = withAuth(async (req, { userId }) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nome: true,
        email: true,
        tipo: true,
        ativo: true,
        dataCriacao: true,
      },
    })

    if (!usuario) {
      return NextResponse.json(
        { erro: 'Usuário não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json(usuario)
  } catch (error) {
    logger.error('Erro ao buscar perfil:', error)
    return NextResponse.json(
      { erro: 'Erro ao buscar perfil' },
      { status: 500 }
    )
  }
})

export const PUT = withAuth(async (req, { userId }) => {
  try {
    const body = await req.json()
    const validation = perfilSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { erro: 'Dados inválidos', detalhes: validation.error.errors },
        { status: 400 }
      )
    }

    // Verificar se o email já está em uso por outro usuário
    const emailExistente = await prisma.usuario.findFirst({
      where: {
        email: validation.data.email,
        NOT: {
          id: userId,
        },
      },
    })

    if (emailExistente) {
      return NextResponse.json(
        { erro: 'E-mail já está em uso' },
        { status: 409 }
      )
    }

    const usuarioAtualizado = await prisma.usuario.update({
      where: { id: userId },
      data: {
        nome: validation.data.nome,
        email: validation.data.email,
      },
      select: {
        id: true,
        nome: true,
        email: true,
        tipo: true,
      },
    })

    return NextResponse.json(usuarioAtualizado)
  } catch (error) {
    logger.error('Erro ao atualizar perfil:', error)
    return NextResponse.json(
      { erro: 'Erro ao atualizar perfil' },
      { status: 500 }
    )
  }
})
