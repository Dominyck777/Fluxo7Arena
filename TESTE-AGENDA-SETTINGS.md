# 🧪 TESTE - Configurações de Agenda com Logs Detalhados

## 📋 **Passo a Passo para Testar**

### **1. Abra o Console do Navegador**
- Pressione **F12** (DevTools)
- Vá na aba **Console**
- Limpe o console (ícone 🚫 ou Ctrl+L)

### **2. Recarregue a Página**
- Pressione **F5** ou **Ctrl+R**
- Observe os logs que aparecem:

```
[AgendaSettings][LOAD] Iniciando carregamento...
[AgendaSettings][LOAD] Resultado da query: { data: ..., error: ... }
```

**O que verificar:**
- ✅ `company_id` tem um valor UUID válido?
- ✅ `data` retorna `null` ou um objeto?
- ✅ `error` é `null` ou tem algum erro?

### **3. Abra o Modal de Configurações**
- Clique no ícone de **Engrenagem** (⚙️) no header da agenda
- Marque a checkbox **"Confirmação automática"**
- Selecione **"2 h"** no dropdown

### **4. Clique em "Salvar"**
- Observe os logs no console:

```
[AgendaSettings][SAVE] Iniciando salvamento...
[AgendaSettings][SAVE] Payload preparado: { empresa_id: "...", ... }
[AgendaSettings][SAVE] Resultado do upsert: { data: [...], error: null }
```

**O que verificar:**
- ✅ `empresa_id` está preenchido?
- ✅ `payload` tem os valores corretos?
- ✅ `error` é `null`?
- ✅ `data` retorna um array com o registro?

### **5. Recarregue a Página Novamente**
- Pressione **F5**
- Observe os logs de carregamento:

```
[AgendaSettings][LOAD] Iniciando carregamento...
[AgendaSettings][LOAD] Resultado da query: { data: { ... }, error: null }
```

**O que verificar:**
- ✅ `data` agora retorna um objeto (não mais `null`)?
- ✅ `data.auto_confirm_enabled` é `true`?
- ✅ `data.auto_confirm_hours` é `2`?

### **6. Abra o Modal Novamente**
- A checkbox deve estar **marcada** ✅
- O dropdown deve mostrar **"2 h"**

---

## 🚨 **CENÁRIOS DE ERRO E SOLUÇÕES**

### **Erro 1: `company_id` é `undefined`**
```
[AgendaSettings][LOAD] Aguardando autenticação...
```

**Causa:** Contexto de autenticação não carregou
**Solução:** Aguardar alguns segundos e recarregar

---

### **Erro 2: `error: { code: "42501", message: "permission denied" }`**
```
[AgendaSettings][LOAD] ERRO ao carregar: { code: "42501", ... }
```

**Causa:** Políticas RLS não permitem SELECT
**Solução:** Verificar se as políticas foram criadas corretamente

**Execute no Supabase SQL Editor:**
```sql
SELECT * FROM pg_policies WHERE tablename = 'agenda_settings';
```

Deve retornar **4 políticas** (SELECT, INSERT, UPDATE, DELETE)

---

### **Erro 3: `error: { code: "23505", message: "duplicate key" }`**
```
[AgendaSettings][SAVE] Resultado do upsert: { error: { code: "23505" } }
```

**Causa:** Conflito de chave primária (raro com upsert)
**Solução:** Deletar registro existente e tentar novamente

**Execute no Supabase SQL Editor:**
```sql
DELETE FROM agenda_settings WHERE empresa_id = 'SEU_COMPANY_ID';
```

---

### **Erro 4: `data` retorna `null` após salvar**
```
[AgendaSettings][SAVE] Resultado do upsert: { data: null, error: null }
```

**Causa:** Política de SELECT não permite ler o registro recém-criado
**Solução:** Adicionar `.select()` no upsert (já implementado)

---

### **Erro 5: Carregamento retorna `null` mas salvamento funciona**
```
[AgendaSettings][LOAD] Resultado da query: { data: null, error: null }
[AgendaSettings][SAVE] Resultado do upsert: { data: [...], error: null }
```

**Causa:** Política de SELECT usa `codigo_empresa` mas salvamento usa `id`
**Solução:** Verificar se `empresa_id` no banco corresponde ao `company.id` do contexto

**Execute no Supabase SQL Editor:**
```sql
-- Ver qual empresa_id foi salvo
SELECT * FROM agenda_settings;

-- Ver qual company.id está no contexto
SELECT id, codigo_empresa FROM empresas;
```

---

## 🔍 **VERIFICAÇÃO MANUAL NO BANCO**

### **1. Abra o Supabase Dashboard**
- Vá em **Table Editor**
- Selecione a tabela **`agenda_settings`**

### **2. Verifique se o registro existe**
- Deve haver **1 linha** com seu `empresa_id`
- Valores devem corresponder ao que você salvou

### **3. Se não houver registro:**
- Execute INSERT manual:

```sql
INSERT INTO agenda_settings (
  empresa_id,
  auto_confirm_enabled,
  auto_confirm_hours,
  auto_start_enabled,
  auto_finish_enabled
) VALUES (
  'SEU_COMPANY_ID_AQUI',  -- Pegar do console: company?.id
  true,
  2,
  true,
  true
);
```

---

## 📊 **RESULTADO ESPERADO**

### **Console após Salvar:**
```
[AgendaSettings][SAVE] Iniciando salvamento... { authReady: true, company_id: "uuid-aqui" }
[AgendaSettings][SAVE] Payload preparado: {
  empresa_id: "uuid-aqui",
  auto_confirm_enabled: true,
  auto_confirm_hours: 2,
  auto_start_enabled: true,
  auto_finish_enabled: true
}
[AgendaSettings][SAVE] Resultado do upsert: {
  data: [{
    empresa_id: "uuid-aqui",
    auto_confirm_enabled: true,
    auto_confirm_hours: 2,
    ...
  }],
  error: null
}
```

### **Console após Recarregar:**
```
[AgendaSettings][LOAD] Iniciando carregamento... { authReady: true, company_id: "uuid-aqui" }
[AgendaSettings][LOAD] Resultado da query: {
  data: {
    empresa_id: "uuid-aqui",
    auto_confirm_enabled: true,
    auto_confirm_hours: 2,
    ...
  },
  error: null
}
```

---

## ✅ **CHECKLIST DE SUCESSO**

- [ ] Console mostra logs de carregamento ao abrir a página
- [ ] `company_id` tem valor UUID válido
- [ ] Ao salvar, console mostra payload correto
- [ ] Upsert retorna `data` com o registro (não `null`)
- [ ] Upsert não retorna `error`
- [ ] Ao recarregar, `data` retorna o registro salvo (não `null`)
- [ ] Modal abre com checkbox marcada
- [ ] Dropdown mostra o valor correto

---

## 🆘 **SE AINDA NÃO FUNCIONAR**

Copie **TODOS os logs do console** e me envie:
1. Logs do carregamento inicial
2. Logs do salvamento
3. Logs do carregamento após reload

Também envie o resultado desta query no Supabase:
```sql
SELECT * FROM agenda_settings;
SELECT id, codigo_empresa FROM empresas;
SELECT id, codigo_empresa FROM colaboradores WHERE id = auth.uid();
```
