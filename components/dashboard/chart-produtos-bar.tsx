"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface ProdutoData {
  nome: string
  sku: string
  total_cotacoes: number
  data_cotacao: string
}

interface ChartProdutosBarProps {
  data: ProdutoData[]
}

const chartConfig = {
  total_cotacoes: {
    label: "Cotações",
    color: "hsl(var(--primary))",
  },
  label: {
    color: "hsl(var(--background))",
  },
} satisfies ChartConfig

export const ChartProdutosBar = React.memo(function ChartProdutosBar({ data }: ChartProdutosBarProps) {
  const [timeRange, setTimeRange] = React.useState("7d")

  const filteredAndGroupedData = React.useMemo(() => {
    if (!data || data.length === 0) return []

    const now = new Date()
    let daysToSubtract = 7

    if (timeRange === "30d") {
      daysToSubtract = 30
    } else if (timeRange === "90d") {
      daysToSubtract = 90
    }

    const startDate = new Date(now)
    startDate.setDate(startDate.getDate() - daysToSubtract)

    // Filtrar por período
    const filteredData = data.filter((item) => {
      const itemDate = new Date(item.data_cotacao)
      return itemDate >= startDate
    })

    // Agrupar por produto e contar
    const produtosCount = new Map<string, { nome: string; sku: string; count: number }>()

    filteredData.forEach((item) => {
      const existing = produtosCount.get(item.sku)
      if (existing) {
        existing.count++
      } else {
        produtosCount.set(item.sku, {
          nome: item.nome,
          sku: item.sku,
          count: 1,
        })
      }
    })

    // Converter para array, ordenar e pegar top 5
    return Array.from(produtosCount.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((p) => ({
        nome: p.nome,
        sku: p.sku,
        total_cotacoes: p.count,
      }))
  }, [data, timeRange])

  return (
    <Card>
      <CardHeader className="flex items-center gap-2 space-y-0 border-b py-5 sm:flex-row">
        <div className="grid flex-1 gap-1">
          <CardTitle>Top 5 Produtos Mais Cotados</CardTitle>
          <CardDescription>Produtos com maior volume de cotações</CardDescription>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger
            className="w-[160px] rounded-lg"
            aria-label="Selecionar período"
          >
            <SelectValue placeholder="Últimos 7 dias" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="7d" className="rounded-lg">
              Últimos 7 dias
            </SelectItem>
            <SelectItem value="30d" className="rounded-lg">
              Últimos 30 dias
            </SelectItem>
            <SelectItem value="90d" className="rounded-lg">
              Últimos 90 dias
            </SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {filteredAndGroupedData.length === 0 ? (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            Nenhum dado disponível para o período selecionado
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <BarChart
              accessibilityLayer
              data={filteredAndGroupedData}
              layout="vertical"
              margin={{
                right: 40,
                left: 12,
              }}
            >
            <CartesianGrid horizontal={false} />
            <YAxis
              dataKey="sku"
              type="category"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              hide
            />
            <XAxis dataKey="total_cotacoes" type="number" hide />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="line" />}
            />
            <Bar
              dataKey="total_cotacoes"
              layout="vertical"
              fill="var(--color-total_cotacoes)"
              radius={4}
            >
              <LabelList
                dataKey="sku"
                position="insideLeft"
                offset={8}
                className="fill-[--color-label]"
                fontSize={12}
              />
              <LabelList
                dataKey="total_cotacoes"
                position="right"
                offset={8}
                className="fill-foreground"
                fontSize={12}
              />
            </Bar>
          </BarChart>
        </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
})
