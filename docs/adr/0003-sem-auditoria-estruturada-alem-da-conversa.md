# Sem auditoria estruturada de Planos Aplicados além da Conversa

Quando um **Plano de Mudanças** é aplicado pelo **Agente de Escrita**, **não** registramos uma trilha estruturada do tipo "Plano X aplicado por usuário Y em data Z, operações: [...]". O único histórico fica na **Conversa** — a mensagem do usuário que pediu, a resposta do agente com o Plano, e a confirmação. Não há tabela `PlanoAplicado` linkada a `AssistenteMensagem`.

A alternativa — log estruturado de cada aplicação, indexável por entidade modificada — foi considerada e rejeitada por agora pela complexidade que adiciona (schema novo, FKs entre conversa e operações materializadas, UI de "ver quem criou esta região"). O dono da conta optou por simplicidade no v1.

**Consequência conhecida e aceita:** dentro de alguns meses alguém vai perguntar *"quem criou esta região com a faixa de peso errada?"* e a resposta será *"alguém via o Assistente em alguma data — confere o histórico de Conversas"*. Buscar entre conversas vai ser manual. Se essa dor virar concreta, este ADR é revogado e introduzimos a tabela então — sem perda significativa, porque a migração retroativa não tem como existir mesmo (os planos antigos já foram aplicados sem o log).
