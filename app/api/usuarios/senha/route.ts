import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { withAuth } from '@/lib/middleware/auth'

const senhaSchema = z.object({
  senhaAtual: z.string().min(1, 'Senha atual é obrigatória'),
  novaSenha: z.string().min(6, 'Nova senha deve ter no mínimo 6 caracteres'),
  confirmarSenha: z.string().min(1, 'Confirmação de senha é obrigatória'),
}).refine((data) => data.novaSenha === data.confirmarSenha, {
  message: 'As senhas não coincidem',
  path: ['confirmarSenha'],
})

export const PUT = withAuth(async (req, { userId }) => {
  try {
    const body = await req.json()
    const validation = senhaSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { erro: 'Dados inválidos', detalhes: validation.error.errors },
        { status: 400 }
      )
    }

    // Buscar usuário atual com a senha
    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      select: {
        id: true,
        senha: true,
      },
    })

    if (!usuario) {
      return NextResponse.json(
        { erro: 'Usuário não encontrado' },
        { status: 404 }
      )
    }

    // Verificar se a senha atual está correta
    const senhaCorreta = await bcrypt.compare(
      validation.data.senhaAtual,
      usuario.senha
    )

    if (!senhaCorreta) {
      return NextResponse.json(
        { erro: 'Senha atual incorreta' },
        { status: 401 }
      )
    }

    // Hash da nova senha
    const novaSenhaHash = await bcrypt.hash(validation.data.novaSenha, 10)

    // Atualizar senha
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        senha: novaSenhaHash,
      },
    })

    return NextResponse.json({ sucesso: true, mensagem: 'Senha alterada com sucesso' })
  } catch (error) {
    logger.error('Erro ao alterar senha:', error)
    return NextResponse.json(
      { erro: 'Erro ao alterar senha' },
      { status: 500 }
    )
  }
})
