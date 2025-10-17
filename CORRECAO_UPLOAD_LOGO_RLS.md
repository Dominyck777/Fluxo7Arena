# 🔒 Correção: Erro de Upload de Logo (RLS Policy)

## ❌ **Erro Identificado**

```
StorageApiError: new row violates row-level security policy
```

**Causa**: O bucket `logos` no Supabase Storage está com políticas RLS (Row Level Security) que bloqueiam o upload.

---

## 🔍 **Diagnóstico**

### **Código Atual** (`EmpresasPage.jsx`, linha 196-198)
```javascript
const path = `${userProfile.codigo_empresa}/logo.${ext}`;
const { error: upErr } = await supabase.storage
  .from('logos')
  .upload(path, file, { upsert: true, contentType: file.type || undefined });
```

### **Problema**
O bucket `logos` precisa de políticas RLS configuradas para permitir:
1. **INSERT** (upload de novos arquivos)
2. **UPDATE** (upsert de arquivos existentes)
3. **SELECT** (leitura pública das logos)

---

## ✅ **Solução: Configurar RLS no Supabase**

### **1. Acessar o Supabase Dashboard**
1. Vá para: https://supabase.com/dashboard
2. Selecione seu projeto
3. Menu lateral: **Storage** → **Policies**
4. Selecione o bucket **`logos`**

---

### **2. Criar Política de INSERT (Upload)**

**Nome**: `Allow authenticated users to upload logos`

**Operação**: `INSERT`

**Target roles**: `authenticated`

**Policy definition**:
```sql
-- Permite upload apenas na pasta do código da empresa do usuário
(bucket_id = 'logos'::text) 
AND 
(
  (storage.foldername(name))[1] = (
    SELECT codigo_empresa::text 
    FROM public.usuarios 
    WHERE id = auth.uid()
  )
)
```

---

### **3. Criar Política de UPDATE (Upsert)**

**Nome**: `Allow authenticated users to update their logos`

**Operação**: `UPDATE`

**Target roles**: `authenticated`

**Policy definition**:
```sql
-- Permite atualizar apenas arquivos da pasta da empresa do usuário
(bucket_id = 'logos'::text) 
AND 
(
  (storage.foldername(name))[1] = (
    SELECT codigo_empresa::text 
    FROM public.usuarios 
    WHERE id = auth.uid()
  )
)
```

---

### **4. Criar Política de SELECT (Leitura Pública)**

**Nome**: `Allow public read access to logos`

**Operação**: `SELECT`

**Target roles**: `public` (ou `anon` se preferir)

**Policy definition**:
```sql
-- Permite leitura pública de todas as logos
bucket_id = 'logos'::text
```

---

### **5. Criar Política de DELETE (Opcional)**

**Nome**: `Allow authenticated users to delete their logos`

**Operação**: `DELETE`

**Target roles**: `authenticated`

**Policy definition**:
```sql
-- Permite deletar apenas arquivos da pasta da empresa do usuário
(bucket_id = 'logos'::text) 
AND 
(
  (storage.foldername(name))[1] = (
    SELECT codigo_empresa::text 
    FROM public.usuarios 
    WHERE id = auth.uid()
  )
)
```

---

## 🛠️ **Alternativa: SQL Direto**

Execute no **SQL Editor** do Supabase:

```sql
-- 1. Política de INSERT (Upload)
CREATE POLICY "Allow authenticated users to upload logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'logos' 
  AND (storage.foldername(name))[1] = (
    SELECT codigo_empresa::text 
    FROM public.usuarios 
    WHERE id = auth.uid()
  )
);

-- 2. Política de UPDATE (Upsert)
CREATE POLICY "Allow authenticated users to update their logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'logos' 
  AND (storage.foldername(name))[1] = (
    SELECT codigo_empresa::text 
    FROM public.usuarios 
    WHERE id = auth.uid()
  )
);

-- 3. Política de SELECT (Leitura Pública)
CREATE POLICY "Allow public read access to logos"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'logos');

-- 4. Política de DELETE (Opcional)
CREATE POLICY "Allow authenticated users to delete their logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'logos' 
  AND (storage.foldername(name))[1] = (
    SELECT codigo_empresa::text 
    FROM public.usuarios 
    WHERE id = auth.uid()
  )
);
```

---

## 📋 **Verificação**

Após aplicar as políticas, teste:

1. **Login** no sistema
2. Vá para **Empresa** → **Editar Dados**
3. Clique em **"Escolher imagem"**
4. Selecione uma imagem
5. ✅ Deve fazer upload sem erro
6. ✅ Logo deve aparecer no preview

---

## 🔐 **Segurança**

As políticas garantem que:
- ✅ Cada empresa só pode fazer upload na **sua própria pasta** (`codigo_empresa`)
- ✅ Usuários não autenticados podem **apenas ler** (visualizar logos)
- ✅ Não é possível sobrescrever logos de outras empresas
- ✅ Estrutura de pastas: `logos/1004/logo.png`, `logos/1005/logo.jpg`, etc.

---

## 📝 **Estrutura do Bucket**

```
logos/
├── 1004/
│   └── logo.png
├── 1005/
│   └── logo.jpg
└── 1006/
    └── logo.webp
```

---

## 🚨 **Importante**

Se o bucket `logos` não existir, crie-o primeiro:

1. **Storage** → **New bucket**
2. Nome: `logos`
3. ✅ Marcar: **Public bucket** (para leitura pública)
4. Criar bucket
5. Depois aplicar as políticas RLS acima

---

**Problema identificado**: 17/10/2025  
**Solução**: Configurar RLS policies no bucket `logos`
