import { PrismaClient, TipoCanal } from '@prisma/client'

const prisma = new PrismaClient()

export async function seedCanaisIntegracao() {
  console.log('🌱 Seeding canais de integração...')

  const canais = [
    // Marketplaces
    {
      nome: 'Mercado Livre',
      slug: 'mercado-livre',
      tipo: TipoCanal.MARKETPLACE,
      logoUrl: '/logos/mercadolivre.png',
      endpointPattern: '/api/v1/mercado-livre/{token}',
      metodosHttp: ['GET'],
      payloadExemplo: {
        cep: '01310100',
        produtos: [
          { sku: 'ABC-001', quantidade: 2 }
        ]
      },
      responseExemplo: {
        sucesso: true,
        cotacoes: []
      }
    },
    {
      nome: 'Shopee',
      slug: 'shopee',
      tipo: TipoCanal.MARKETPLACE,
      logoUrl: '/logos/shopee.png',
      endpointPattern: '/api/v1/shopee/{token}',
      metodosHttp: ['POST'],
      payloadExemplo: {
        cep: '01310100',
        produtos: []
      }
    },
    {
      nome: 'Anymarket',
      slug: 'anymarket',
      tipo: TipoCanal.MARKETPLACE,
      logoUrl: '/logos/anymarket.png',
      endpointPattern: '/api/v1/anymarket/{token}',
      metodosHttp: ['POST'],
      payloadExemplo: {
        zipcode: '01310100',
        items: []
      }
    },
    {
      nome: 'Magalu',
      slug: 'magalu',
      tipo: TipoCanal.MARKETPLACE,
      logoUrl: '/logos/magalu.png',
      endpointPattern: '/api/v1/magalu/{token}',
      metodosHttp: ['POST'],
      payloadExemplo: {
        destination_zip: '01310100',
        products: []
      }
    },
    
    // ERPs com Webhook
    {
      nome: 'Bling ERP',
      slug: 'erp-bling',
      tipo: TipoCanal.ERP,
      logoUrl: '/logos/bling.svg',
      endpointPattern: '/api/v1/erp-bling/webhook/{token}',
      metodosHttp: ['POST'],
      payloadExemplo: {
        event: 'stock.updated',
        products: [
          { sku: 'ABC-001', quantity: 50 }
        ]
      }
    },
    {
      nome: 'Tiny ERP',
      slug: 'erp-tiny',
      tipo: TipoCanal.ERP,
      logoUrl: '/logos/tiny.svg',
      endpointPattern: '/api/v1/erp-tiny/webhook/{token}',
      metodosHttp: ['POST'],
      payloadExemplo: {
        tipo: 'estoque_atualizado',
        produtos: []
      }
    }
  ]

  for (const canal of canais) {
    await prisma.canalIntegracao.upsert({
      where: { slug: canal.slug },
      update: canal,
      create: canal,
    })
  }

  console.log(`✅ ${canais.length} canais de integração criados`)
}

if (require.main === module) {
  seedCanaisIntegracao()
    .then(() => prisma.$disconnect())
    .catch((e) => {
      console.error(e)
      prisma.$disconnect()
      process.exit(1)
    })
}
