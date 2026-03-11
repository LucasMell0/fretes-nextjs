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
      
      // Quando update() é chamado, atualizar o token com os novos dados
      if (trigger === "update" && session) {
        token.name = session.user.name
        token.email = session.user.email
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
