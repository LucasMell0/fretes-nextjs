# Dois agentes de IA separados (Escrita e Consulta), nunca unificados

O **Assistente IA** é dividido em dois agentes distintos — **Agente de Escrita** (CRUD via Plano de Mudanças + aprovação humana) e **Agente de Consulta** (somente-leitura: cotação, diagnóstico, analytics, audit). Uma **Conversa** pertence a um único agente; a UI tem dois botões "Nova conversa de Escrita" e "Nova conversa de Consulta", e se o usuário tentar a operação errada o agente educadamente redireciona.

A alternativa óbvia — um agente único com todas as tools (leitura + escrita) — foi rejeitada porque eles têm modelos mentais e perfis de risco diferentes: o de Escrita exige cuidado extra (Plano + aprovação + DELETE com confirmação), o de Consulta é mais solto. Misturar tudo num agente único cria um buraco onde "eu só queria cotar e ele criou uma região" — quebra a invariante de que toda mudança passa por aprovação consciente. A separação também simplifica o system prompt e as tools de cada agente.
