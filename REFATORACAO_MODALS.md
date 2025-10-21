# Refatoração da Arquitetura de Modais

## Problema Identificado

Os modais na `AgendaPage.jsx` estavam fechando indevidamente devido a:
1. Hierarquia de modais aninhados (Dialog dentro de Dialog)
2. Propagação de eventos de fechamento
3. Re-renders causando reset de estado
4. Mesmo problema afetava modal de CEP e modal de edição de participante

## Solução Implementada

### 1. Context de Gerenciamento (`ModalsContext.jsx`)
- Criado em `src/contexts/ModalsContext.jsx`
- Gerencia estado de todos os modais de forma isolada
- Previne interferência entre modais
- Usa React Portals para renderizar fora da hierarquia DOM

### 2. Integração no App.jsx
- `ModalsProvider` envolve toda a aplicação
- Disponível em qualquer componente via `useModals()`

### 3. Migração dos Modais (Em Progresso)
**Modais a migrar:**
- ✅ Modal de Pagamentos (`isPaymentModalOpen`)
- ✅ Modal de Edição de Participante (`editParticipantModal`)

**Modais a manter como estão:**
- Modal Principal de Agendamento (`isModalOpen`) - funciona corretamente
- Outros modais que não apresentam problemas

## Próximos Passos

1. Migrar renderização dos modais de pagamentos e edição de participante
2. Testar funcionalidade completa
3. Remover código antigo de controle de estado
4. Limpar logs de debug

## Benefícios

- Modais completamente isolados
- Sem interferência de re-renders
- Código mais limpo e manutenível
- Fácil adicionar novos modais no futuro
- Resolve problema do CEP também
