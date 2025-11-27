# 🔧 Configuração do JSONBin para ISIS Feedback

## ❌ Problema Atual
Erro 401: "X-Master-Key is invalid or the bin doesn't belong to your account"

## 🔍 Diagnóstico
O erro indica que a chave de API ou o BIN_ID estão incorretos.

## ✅ Soluções

### Opção 1: Verificar Credenciais Existentes
1. Acesse [JSONBin.io](https://jsonbin.io)
2. Faça login na sua conta
3. Vá em **API Keys** e copie a chave correta
4. Vá em **Bins** e verifique se o bin `690605e5ae596e708f3c7bc5` existe
5. Atualize o arquivo `.env` com as credenciais corretas

### Opção 2: Criar Novo Bin
1. Execute no console do navegador:
```javascript
// Importe as funções de debug
import { testarCredenciaisJsonBin, criarBinTeste } from './src/utils/debugJsonBin.js';

// Teste as credenciais atuais
await testarCredenciaisJsonBin();

// Se falhar, crie um novo bin
await criarBinTeste();
```

2. Use o novo BIN_ID retornado no arquivo `.env`

### Opção 3: Usar Fallback Local (Temporário)
O sistema já está configurado para salvar feedbacks localmente quando o JSONBin falha.
Os dados ficam em `localStorage` com a chave `isis-feedbacks`.

## 🔑 Formato Correto das Variáveis

```env
VITE_JSONBIN_BIN_ID=seu_bin_id_aqui
VITE_JSONBIN_API_KEY=$2b$10$sua_chave_api_aqui
```

## 📊 Estrutura Esperada no Bin

```json
{
  "feedback-isis": [
    {
      "id": "unique-id",
      "timestamp": "2025-11-11T15:22:00.000Z",
      "estrelas": 5,
      "nome_cliente": "João Silva",
      "empresa": "Arena Palace",
      "projeto": "fluxo7arena",
      "comentario": "Excelente atendimento!"
    }
  ],
  "devs": [
    {
      "id": "dominyck",
      "name": "Dominyck",
      "password": "777", 
      "role": "admin",
      "active": true
    }
  ]
}
```

## 🚀 Teste Rápido
Após configurar, teste no console:
```javascript
import { testarCredenciaisJsonBin } from './src/utils/debugJsonBin.js';
await testarCredenciaisJsonBin();
```

## 💡 Dica
O sistema continuará funcionando mesmo com erro no JSONBin, salvando os feedbacks localmente como fallback.
