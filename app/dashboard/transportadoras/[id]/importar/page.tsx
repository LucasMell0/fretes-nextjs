'use client'

import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import { UploadRegioes } from '@/components/importacao/upload-regioes'

export default function ImportarRegioesPage() {
  const params = useParams()
  const router = useRouter()
  const transportadoraId = parseInt(params.id as string)

  return (
    <div className="container mx-auto p-4 sm:p-6">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Importar Regiões</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Faça upload de uma planilha CSV com regiões e faixas de peso
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={() => router.push('/dashboard/transportadoras')}
          className="w-full sm:w-auto"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </div>

      <UploadRegioes 
        transportadoraId={transportadoraId}
        onSucesso={() => {
          router.push('/dashboard/regioes')
        }}
      />
    </div>
  )
}
