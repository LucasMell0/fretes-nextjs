"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import {
  LayoutDashboard,
  Truck,
  Package,
  MapPin,
  Calculator,
  BarChart3,
  LogOut,
  User2,
  Moon,
  Sun,
  ChevronsUpDown,
  CreditCard,
  Plug,
  ShieldAlert,
} from "lucide-react"
import { useTheme } from "next-themes"
import { signOut } from "next-auth/react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu"

const menuItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Cotação",
    href: "/dashboard/cotacao",
    icon: Calculator,
  },
  {
    title: "Transportadoras",
    href: "/dashboard/transportadoras",
    icon: Truck,
  },
  {
    title: "Produtos",
    href: "/dashboard/produtos",
    icon: Package,
  },
  {
    title: "Regiões",
    href: "/dashboard/regioes",
    icon: MapPin,
  },
  {
    title: "Integrações",
    href: "/dashboard/integracoes",
    icon: Plug,
  },
  {
    title: "Auditoria",
    href: "/dashboard/auditoria",
    icon: ShieldAlert,
  },
  {
    title: "Relatórios",
    href: "/dashboard/relatorios",
    icon: BarChart3,
  },
]

interface AppSidebarProps {
  user?: {
    name?: string | null
    email?: string | null
  }
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center justify-center py-3 group-data-[collapsible=icon]:px-0 px-4">
          <Link href="/dashboard">
            <Image
              src="/logos/ginte-white.png"
              alt="Ginte"
              width={110}
              height={36}
              className="hidden dark:block group-data-[collapsible=icon]:!hidden max-w-[110px] h-auto"
              priority
            />
            <Image
              src="/logos/ginte-dark.png"
              alt="Ginte"
              width={110}
              height={36}
              className="block dark:hidden group-data-[collapsible=icon]:!hidden max-w-[110px] h-auto"
              priority
            />
            <Image
              src="/icon.png"
              alt="Ginte"
              width={32}
              height={32}
              className="hidden group-data-[collapsible=icon]:!block"
              priority
            />
          </Link>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={item.href}>
                        <Icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                    <User2 className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      {user?.name || "Usuário"}
                    </span>
                    <span className="truncate text-xs">
                      {user?.email || "email@example.com"}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="right"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuLabel className="p-0 font-normal">
                  <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                      <User2 className="size-4" />
                    </div>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">
                        {user?.name || "Usuário"}
                      </span>
                      <span className="truncate text-xs">
                        {user?.email || "email@example.com"}
                      </span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem className="cursor-pointer" asChild>
                    <Link href="/dashboard/conta">
                      <User2 className="mr-2 h-4 w-4" />
                      Conta
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="cursor-pointer">
                    <CreditCard className="mr-2 h-4 w-4" />
                    Faturamento
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                {mounted && (
                  <DropdownMenuItem onClick={toggleTheme} className="cursor-pointer">
                    {theme === "dark" ? (
                      <Sun className="mr-2 h-4 w-4" />
                    ) : (
                      <Moon className="mr-2 h-4 w-4" />
                    )}
                    <span>{theme === "dark" ? "Modo Claro" : "Modo Escuro"}</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="cursor-pointer"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
