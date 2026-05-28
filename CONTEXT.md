# Contexto — Sistema Fretes

Glossário de termos do domínio. Sem detalhes de implementação.

## Assistente IA

Conjunto de dois agentes que conversam com o **dono da conta autenticado** (Usuario) e atuam no próprio escopo dele. Não atende cliente final externo nem integração de terceiros.

### Agente de Escrita

Agente IA que executa operações **CRUD** sobre os dados do usuário — Transportadoras, Regiões, Faixas de Peso, Taxas, Produtos, Cubagens.

Toda operação passa por **aprovação humana** antes de ser aplicada: o agente **propõe** um **Plano de Mudanças** e o usuário **confirma** antes da execução. Deleções exigem confirmação reforçada.

### Plano de Mudanças

Conjunto ordenado de operações (create/update/delete) propostas pelo **Agente de Escrita**, exibidas como um único bloco editável. O usuário pode desmarcar ou editar itens individuais antes de aplicar tudo numa só ação. Não tem persistência: existe enquanto o usuário está na conversa; é descartado se não for aplicado.

### Conversa

Cada interação do usuário com um agente vive em uma **Conversa** — análoga aos chats em ferramentas como ChatGPT/Claude. O usuário pode criar conversas novas, listar as antigas, renomear, excluir. As mensagens (turnos do usuário e do agente) ficam persistidas para servir de contexto e histórico, **não** como mecanismo de auditoria de mudanças aplicadas. Uma conversa pertence a um único agente (Escrita **ou** Consulta) — não se misturam. Se o usuário envia uma mensagem que não cabe no agente da conversa atual (ex: pede pra criar dados num chat de Consulta), o agente responde orientando a abrir uma conversa do outro agente.

### Cota de Mensagens

Limite mensal de mensagens enviadas pelo usuário, contabilizado por `Usuario`. Conta apenas turnos do usuário (não turnos do agente, não tool calls internas, não ações grátis como abrir/listar/excluir conversa). Ao esgotar, o assistente fica bloqueado até o início do próximo mês. Operadores da plataforma podem ajustar a cota individual de um usuário.

### Agente de Consulta

Agente IA somente-leitura. Responde perguntas em linguagem natural sobre o estado do sistema. Nunca altera configuração. Pode produzir cotações e logá-las (CotacaoLog), mas o efeito colateral é apenas histórico.

Cobre quatro tipos de pergunta:

1. **Cotação ativa** — "quanto custa o frete de N unidades do produto X pra cidade/CEP Y?". Roda a cotação e devolve preços/prazos.
2. **Diagnóstico de cotação** — "por que a transportadora T não aparece nas cotações pro CEP Z?". Explica falhas com base em regras (CEP fora de região, SKU sem cadastro, faixa de peso ausente).
3. **Analytics histórico** — "quantas cotações falharam pro RJ esse mês?", "quais SKUs mais cotados?". Lê CotacaoLog e AuditoriaCotacao.
4. **Audit de configuração** — "minhas faixas de peso têm gaps?", "esta região tem GRIS sem valor mínimo, é intencional?". Roda checks sobre a configuração atual.
