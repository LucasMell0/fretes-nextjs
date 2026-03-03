import "next-auth"

declare module "next-auth" {
  interface User {
    id: string
    tipo: string
  }

  interface Session {
    user: User & {
      id: string
      tipo: string
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    tipo: string
  }
}
