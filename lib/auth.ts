import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { compare } from "bcryptjs"
import { prisma } from "@/lib/prisma"

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await prisma.usuario.findUnique({
          where: {
            email: credentials.email,
          },
        })

        if (!user || !user.ativo) {
          return null
        }

        const isPasswordValid = await compare(
          credentials.password,
          user.senha
        )

        if (!isPasswordValid) {
          return null
        }

        return {
          id: user.id.toString(),
          email: user.email,
          name: user.nome,
          tipo: user.tipo,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.tipo = user.tipo
      }
      
      // Quando update() é chamado, re-buscar dados do banco (nunca confiar no client)
      if (trigger === "update") {
        const dbUser = await prisma.usuario.findUnique({
          where: { id: parseInt(token.id as string) },
          select: { nome: true, email: true },
        })
        if (dbUser) {
          token.name = dbUser.nome
          token.email = dbUser.email
        }
      }
      
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.tipo = token.tipo as string
        session.user.name = token.name as string
        session.user.email = token.email as string
      }
      return session
    },
  },
}
