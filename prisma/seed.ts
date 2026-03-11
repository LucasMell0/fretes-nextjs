import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...')

  // Criar usuário admin
  const adminPassword = await hash('admin123', 10)
  const admin = await prisma.usuario.upsert({
    where: { email: 'admin@sistema.com' },
    update: {},
    create: {
      nome: 'Administrador',
      email: 'admin@sistema.com',
      senha: adminPassword,
      tipo: 'ADMIN',
      ativo: true,
    },
  })
  console.log('✅ Usuário admin criado:', admin.email)

  // Criar canais de integração
  const canais = await prisma.canalIntegracao.createMany({
    data: [
      {
        nome: 'Bling ERP',
        slug: 'erp-bling',
        tipo: 'ERP',
        logoUrl: '/logos/bling.png',
        endpointPattern: '/api/v1/erp-bling/webhook/{token}',
        metodosHttp: ['POST'],
        payloadExemplo: {
          produto: { id: 12345678 },
          saldoFisicoTotal: 1500.75,
          saldoVirtualTotal: 1500.75
        },
        responseExemplo: {
          success: true,
          message: 'Webhook processed successfully'
        },
        ativo: true,
      },
      {
        nome: 'Mercado Livre',
        slug: 'marketplace-mercadolivre',
        tipo: 'MARKETPLACE',
        logoUrl: null,
        endpointPattern: '/api/v1/marketplace/mercadolivre/webhook/{token}',
        metodosHttp: ['POST'],
        payloadExemplo: {
          topic: 'orders_v2',
          resource: '/orders/123456789'
        },
        responseExemplo: {
          success: true
        },
        ativo: true,
      },
      {
        nome: 'Shopee',
        slug: 'marketplace-shopee',
        tipo: 'MARKETPLACE',
        logoUrl: null,
        endpointPattern: '/api/v1/marketplace/shopee/webhook/{token}',
        metodosHttp: ['POST'],
        payloadExemplo: {
          event: 'order.update',
          data: {}
        },
        responseExemplo: {
          success: true
        },
        ativo: true,
      },
    ],
    skipDuplicates: true,
  })
  console.log('✅ Canais de integração criados:', canais.count)

  // Criar transportadora de exemplo
  const transportadora = await prisma.transportadora.create({
    data: {
      nome: 'Transportadora Express',
      fatorCubagem: 300,
      ativo: true,
    },
  })
  console.log('✅ Transportadora criada:', transportadora.nome)

  // Criar região de exemplo
  const regiao = await prisma.transportadoraRegiao.create({
    data: {
      transportadoraId: transportadora.id,
      nome: 'São Paulo Capital',
      cepInicio: '01000000',
      cepFim: '05999999',
      icms: 12,
      ativo: true,
    },
  })
  console.log('✅ Região criada:', regiao.nome)

  // Criar faixas de preço
  const precos = await prisma.transportadoraRegiaoPreco.createMany({
    data: [
      {
        transportadoraRegiaoId: regiao.id,
        pesoInicial: 0,
        pesoFinal: 10,
        valor: 25.00,
        prazo: 3,
      },
      {
        transportadoraRegiaoId: regiao.id,
        pesoInicial: 10.01,
        pesoFinal: 30,
        valor: 45.00,
        prazo: 3,
      },
      {
        transportadoraRegiaoId: regiao.id,
        pesoInicial: 30.01,
        pesoFinal: 50,
        valor: 65.00,
        prazo: 4,
      },
    ],
  })
  console.log('✅ Faixas de preço criadas:', precos.count)

  // Criar kg adicional
  await prisma.transportadoraRegiaoKgAdicional.create({
    data: {
      transportadoraRegiaoId: regiao.id,
      valorKgAdicional: 1.50,
    },
  })
  console.log('✅ Kg adicional configurado')

  // Criar taxas
  await prisma.transportadoraRegiaoTaxa.create({
    data: {
      transportadoraRegiaoId: regiao.id,
      grisTipo: 'PERCENTUAL',
      grisValor: 0.5,
      grisMinimo: 15,
      despachoTipo: 'VALOR',
      despachoValor: 10,
      pedagioTipo: 'VALOR',
      pedagioValor: 5,
      tasTipo: 'PERCENTUAL',
      tasValor: 0.3,
    },
  })
  console.log('✅ Taxas configuradas')

  // Criar produtos de exemplo
  const produtos = await prisma.produto.createMany({
    data: [
      {
        nome: 'Notebook Dell Inspiron 15',
        sku: 'DELL-INS15-001',
        peso: 2.5,
        cubagem: 0.015,
        estoque: 10,
        crossDocking: 0,
        ativo: true,
      },
      {
        nome: 'Monitor LG 27" UltraWide',
        sku: 'LG-27UW-002',
        peso: 5.8,
        cubagem: 0.045,
        estoque: 5,
        crossDocking: 2,
        ativo: true,
      },
      {
        nome: 'Teclado Mecânico Gamer',
        sku: 'TEC-MEC-003',
        peso: 1.2,
        cubagem: 0.008,
        estoque: 0,
        crossDocking: 5,
        ativo: true,
      },
      {
        nome: 'Mouse Wireless Logitech',
        sku: 'LGT-MSW-004',
        peso: 0.3,
        cubagem: 0.002,
        estoque: 25,
        crossDocking: 0,
        ativo: true,
      },
      {
        nome: 'Webcam Full HD 1080p',
        sku: 'WBC-FHD-005',
        peso: 0.5,
        cubagem: 0.003,
        estoque: 15,
        crossDocking: 0,
        ativo: true,
      },
    ],
  })
  console.log('✅ Produtos criados:', produtos.count)

  console.log('🎉 Seed concluído com sucesso!')
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
