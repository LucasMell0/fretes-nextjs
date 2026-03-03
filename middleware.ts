export { default } from "next-auth/middleware"

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/produtos/:path*",
    "/transportadoras/:path*",
    "/cotacoes/:path*",
    "/regioes/:path*",
  ],
}
