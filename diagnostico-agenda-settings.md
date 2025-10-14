# 🔍 DIAGNÓSTICO - Configurações de Agenda Não Persistem

## ✅ Passo 1: SQL Executado com Sucesso
- Políticas RLS foram criadas
- "Success. No rows returned" é o comportamento esperado

## 🔍 Passo 2: Verificar no Console do Navegador

### Abra o DevTools (F12) e execute:

```javascript
// 1. Verificar se as políticas foram criadas
console.log('Testando políticas RLS...');

// 2. Verificar company.id
const authContext = JSON.parse(localStorage.getItem('auth:company'));
console.log('Company ID:', authContext?.id);

// 3. Testar SELECT manualmente
const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
const supabaseUrl = 'SEU_SUPABASE_URL';
const supabaseKey = 'SEU_SUPABASE_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

const { data, error } = await supabase
  .from('agenda_settings')
  .select('*')
  .eq('empresa_id', authContext?.id);

console.log('SELECT Result:', { data, error });
```

## 🚨 Possíveis Causas do Problema

### **Causa 1: company.id está NULL ou undefined**
```javascript
// Verificar no código (linha 486)
if (!authReady || !company?.id) {
  // Está retornando aqui?
}
```

**Solução:** Adicionar log antes do upsert:
```javascript
console.log('[DEBUG] Salvando configurações:', { 
  company_id: company.id, 
  payload 
});
```

### **Causa 2: Erro no UPSERT não está sendo capturado**
```javascript
const { error } = await supabase
  .from('agenda_settings')
  .upsert(payload, { onConflict: 'empresa_id' });

console.log('[DEBUG] Upsert result:', { error });
```

### **Causa 3: Políticas RLS bloqueando INSERT**
- Política de INSERT permite criar?
- `empresa_id` corresponde ao usuário autenticado?

### **Causa 4: Carregamento não está buscando corretamente**
```javascript
// Verificar linha 394-398
const { data, error } = await supabase
  .from('agenda_settings')
  .select('*')
  .eq('empresa_id', company.id)
  .maybeSingle();

console.log('[DEBUG] Load result:', { data, error });
```

## 🔧 CORREÇÃO IMEDIATA

Vou adicionar logs detalhados no código para identificar onde está falhando.
