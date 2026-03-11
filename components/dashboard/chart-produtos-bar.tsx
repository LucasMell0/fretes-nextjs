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

export const ChartProdutosBar = React.memo(function ChartProdutosBar({ data: initialData }: ChartProdutosBarProps) {
  const [timeRange, setTimeRange] = React.useState("7d")
  const [data, setData] = React.useState(initialData)
  const [loading, setLoading] = React.useState(false)

  // Buscar dados quando período mudar
  React.useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const dias = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90
        const res = await fetch(`/api/dashboard/stats?dias=${dias}`)
        const stats = await res.json()
        setData(stats.topProdutos || [])
      } catch (error) {
        console.error('Erro ao buscar dados:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [timeRange])

  const chartData = React.useMemo(() => {
    if (!data || data.length === 0) return []
    return data
  }, [data])

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
        {loading ? (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            Carregando...
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            Nenhum dado disponível para o período selecionado
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <BarChart
              accessibilityLayer
              data={chartData}
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
