# 📋 Plano de Implementação Completo - Fluxo7 Arena

## 🎯 Objetivo Geral

Implementar sistema de confirmação de agendamentos via WhatsApp com Twilio e migrar aplicação para VPS Hostinger com domínio customizado e segurança Cloudflare.

---

## 📑 Índice

1. [Fase 1: Infraestrutura](#fase-1-infraestrutura)
2. [Fase 2: Backend WhatsApp](#fase-2-backend-whatsapp)
3. [Fase 3: Frontend e Integração](#fase-3-frontend-e-integração)
4. [Fase 4: Deploy e Produção](#fase-4-deploy-e-produção)
5. [Cronograma](#cronograma)

---

## Fase 1: Infraestrutura

### 1.1 Configurar Domínio e Cloudflare

**Objetivo:** Apontar domínio Namecheap para VPS com proteção Cloudflare

**Tarefas:**

- [ ] **Passo 1: Criar conta Cloudflare**
  - Acessar https://www.cloudflare.com
  - Sign up (grátis)
  - Verificar email
  - **Tempo:** 5 minutos

- [ ] **Passo 2: Adicionar domínio no Cloudflare**
  - Dashboard Cloudflare → "+ Add a Site"
  - Digitar domínio (ex: seudominio.com.br)
  - Selecionar plano "Free"
  - **Tempo:** 5 minutos

- [ ] **Passo 3: Copiar Nameservers do Cloudflare**
  - Cloudflare mostra 2 nameservers
  - Exemplo: `ns1.cloudflare.com`, `ns2.cloudflare.com`
  - **Tempo:** 1 minuto

- [ ] **Passo 4: Mudar Nameservers na Namecheap**
  - Painel Namecheap → Domain List
  - Selecionar domínio → Nameservers
  - Selecionar "Custom DNS"
  - Colar nameservers do Cloudflare
  - Salvar
  - **Tempo:** 5 minutos

- [ ] **Passo 5: Aguardar propagação**
  - Pode levar 5 minutos a 24 horas
  - Testar: `ping seudominio.com.br`
  - **Tempo:** Passivo (aguardar)

- [ ] **Passo 6: Configurar DNS no Cloudflare**
  - Cloudflare Dashboard → DNS
  - "+ Add Record"
  - Tipo: A
  - Name: @
  - IPv4: IP da VPS Hostinger
  - Proxy Status: Proxied (laranja)
  - Salvar
  - **Tempo:** 5 minutos

- [ ] **Passo 7: Ativar SSL no Cloudflare**
  - Cloudflare Dashboard → SSL/TLS
  - Selecionar "Full (Strict)"
  - **Tempo:** 2 minutos

**Total Fase 1.1:** ~30 minutos (+ propagação DNS)

---

### 1.2 Configurar VPS Hostinger

**Objetivo:** Preparar servidor Ubuntu 24 LTS para hospedar aplicação

**Tarefas:**

- [ ] **Passo 1: Acessar VPS via SSH**
  ```bash
  ssh root@seu_ip_vps
  ```
  - **Tempo:** 2 minutos

- [ ] **Passo 2: Atualizar sistema**
  ```bash
  sudo apt update
  sudo apt upgrade -y
  ```
  - **Tempo:** 5 minutos

- [ ] **Passo 3: Instalar Node.js**
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
  node --version
  ```
  - **Tempo:** 5 minutos

- [ ] **Passo 4: Instalar Nginx**
  ```bash
  sudo apt install -y nginx
  sudo systemctl start nginx
  sudo systemctl enable nginx
  ```
  - **Tempo:** 3 minutos

- [ ] **Passo 5: Instalar Certbot (Let's Encrypt)**
  ```bash
  sudo apt install -y certbot python3-certbot-nginx
  ```
  - **Tempo:** 3 minutos

- [ ] **Passo 6: Gerar certificado SSL**
  ```bash
  sudo certbot certonly --standalone \
    -d seudominio.com.br \
    -d www.seudominio.com.br
  ```
  - **Tempo:** 5 minutos

- [ ] **Passo 7: Configurar renovação automática SSL**
  ```bash
  sudo systemctl enable certbot.timer
  sudo systemctl start certbot.timer
  ```
  - **Tempo:** 2 minutos

- [ ] **Passo 8: Criar diretório para aplicação**
  ```bash
  sudo mkdir -p /var/www/fluxo7arena
  sudo chown -R $USER:$USER /var/www/fluxo7arena
  ```
  - **Tempo:** 2 minutos

**Total Fase 1.2:** ~30 minutos

---

### 1.3 Configurar Nginx

**Objetivo:** Servir aplicação React através de Nginx com SSL

**Tarefas:**

- [ ] **Passo 1: Criar arquivo de configuração Nginx**
  ```bash
  sudo nano /etc/nginx/sites-available/fluxo7arena
  ```
  - Copiar configuração (ver seção de código abaixo)
  - **Tempo:** 5 minutos

- [ ] **Passo 2: Ativar configuração**
  ```bash
  sudo ln -s /etc/nginx/sites-available/fluxo7arena /etc/nginx/sites-enabled/
  sudo nginx -t
  sudo systemctl reload nginx
  ```
  - **Tempo:** 3 minutos

- [ ] **Passo 3: Testar HTTPS**
  - Acessar `https://seudominio.com.br`
  - Verificar cadeado 🔒
  - **Tempo:** 2 minutos

**Total Fase 1.3:** ~10 minutos

**Código Nginx:**

```nginx
server {
    listen 80;
    server_name seudominio.com.br www.seudominio.com.br;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name seudominio.com.br www.seudominio.com.br;

    ssl_certificate /etc/letsencrypt/live/seudominio.com.br/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/seudominio.com.br/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    root /var/www/fluxo7arena/dist;
    index index.html;

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## Fase 2: Backend WhatsApp

### 2.1 Configurar Twilio

**Objetivo:** Criar conta Twilio e gerar credenciais

**Tarefas:**

- [ ] **Passo 1: Criar conta Twilio**
  - Acessar https://www.twilio.com
  - Sign up (grátis, $15 trial)
  - Verificar email
  - **Tempo:** 5 minutos

- [ ] **Passo 2: Configurar WhatsApp Sandbox**
  - Dashboard Twilio → Messaging → Try it out
  - Selecionar "WhatsApp"
  - Conectar número
  - **Tempo:** 10 minutos

- [ ] **Passo 3: Gerar credenciais**
  - Account SID: `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
  - Auth Token: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
  - WhatsApp Number: `+1234567890`
  - **Tempo:** 2 minutos

- [ ] **Passo 4: Testar envio manual**
  ```bash
  curl -X POST https://api.twilio.com/2010-04-01/Accounts/YOUR_SID/Messages.json \
    -d "From=whatsapp:+1234567890" \
    -d "To=whatsapp:+5511999999999" \
    -d "Body=Olá! Teste" \
    -u YOUR_SID:YOUR_TOKEN
  ```
  - **Tempo:** 5 minutos

**Total Fase 2.1:** ~25 minutos

---

### 2.2 Criar Migrations SQL

**Objetivo:** Preparar banco de dados para confirmações

**Tarefas:**

- [ ] **Passo 1: Adicionar campos na tabela empresas**
  ```sql
  ALTER TABLE empresas ADD COLUMN (
    whatsapp_numero VARCHAR(20),
    whatsapp_token VARCHAR(255),
    whatsapp_habilitado BOOLEAN DEFAULT false
  );
  ```
  - **Tempo:** 5 minutos

- [ ] **Passo 2: Criar tabela agendamento_confirmacoes**
  ```sql
  CREATE TABLE agendamento_confirmacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agendamento_id UUID NOT NULL REFERENCES agendamentos(id) ON DELETE CASCADE,
    empresa_codigo VARCHAR(50) NOT NULL,
    cliente_telefone VARCHAR(20) NOT NULL,
    cliente_nome VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pendente',
    motivo_cancelamento TEXT,
    mensagem_enviada TEXT,
    resposta_cliente TEXT,
    enviado_em TIMESTAMP,
    respondido_em TIMESTAMP,
    criado_em TIMESTAMP DEFAULT now(),
    atualizado_em TIMESTAMP DEFAULT now()
  );
  ```
  - **Tempo:** 5 minutos

- [ ] **Passo 3: Criar índices**
  ```sql
  CREATE INDEX idx_confirmacoes_agendamento ON agendamento_confirmacoes(agendamento_id);
  CREATE INDEX idx_confirmacoes_empresa ON agendamento_confirmacoes(empresa_codigo);
  CREATE INDEX idx_confirmacoes_status ON agendamento_confirmacoes(status);
  ```
  - **Tempo:** 3 minutos

**Total Fase 2.2:** ~15 minutos

---

### 2.3 Implementar Edge Function: send-whatsapp-confirmation

**Objetivo:** Criar função para enviar confirmação via WhatsApp

**Tarefas:**

- [ ] **Passo 1: Criar arquivo Edge Function**
  ```bash
  supabase functions new send-whatsapp-confirmation
  ```
  - **Tempo:** 2 minutos

- [ ] **Passo 2: Implementar lógica**
  - Receber agendamento_id e empresa_codigo
  - Buscar dados agendamento
  - Buscar dados empresa (Twilio token)
  - Buscar dados cliente
  - Formatar mensagem
  - Chamar API Twilio
  - Registrar no banco
  - **Tempo:** 45 minutos

- [ ] **Passo 3: Testar localmente**
  ```bash
  supabase functions serve
  ```
  - **Tempo:** 10 minutos

- [ ] **Passo 4: Deploy**
  ```bash
  supabase functions deploy send-whatsapp-confirmation
  ```
  - **Tempo:** 5 minutos

**Total Fase 2.3:** ~60 minutos

---

### 2.4 Implementar Edge Function: receive-whatsapp-response

**Objetivo:** Criar webhook para receber respostas do cliente

**Tarefas:**

- [ ] **Passo 1: Criar arquivo Edge Function**
  ```bash
  supabase functions new receive-whatsapp-response
  ```
  - **Tempo:** 2 minutos

- [ ] **Passo 2: Implementar lógica**
  - Receber webhook do Twilio
  - Extrair número e resposta
  - Buscar confirmação pendente
  - Processar resposta (SIM/NÃO)
  - Atualizar status
  - Se cancelado, atualizar agendamento
  - **Tempo:** 45 minutos

- [ ] **Passo 3: Validar webhook Twilio**
  - Implementar validação de assinatura
  - **Tempo:** 15 minutos

- [ ] **Passo 4: Testar com Twilio**
  - Configurar webhook no Twilio
  - Enviar resposta de teste
  - Verificar atualização no banco
  - **Tempo:** 10 minutos

- [ ] **Passo 5: Deploy**
  ```bash
  supabase functions deploy receive-whatsapp-response
  ```
  - **Tempo:** 5 minutos

**Total Fase 2.4:** ~75 minutos

---

### 2.5 Configurar Variáveis de Ambiente

**Objetivo:** Armazenar credenciais Twilio com segurança

**Tarefas:**

- [ ] **Passo 1: Adicionar secrets no Supabase**
  ```bash
  supabase secrets set TWILIO_ACCOUNT_SID "ACxxxxxxx"
  supabase secrets set TWILIO_AUTH_TOKEN "xxxxxxx"
  ```
  - **Tempo:** 5 minutos

- [ ] **Passo 2: Verificar secrets**
  ```bash
  supabase secrets list
  ```
  - **Tempo:** 2 minutos

**Total Fase 2.5:** ~10 minutos

---

## Fase 3: Frontend e Integração

### 3.1 Integrar Trigger no IsisBookingPage

**Objetivo:** Disparar envio de confirmação após agendamento

**Tarefas:**

- [ ] **Passo 1: Adicionar lógica após criar agendamento**
  - Após sucesso de criação
  - Calcular tempo de envio (24h antes)
  - Chamar Edge Function send-whatsapp-confirmation
  - **Arquivo:** `src/pages/IsisBookingPage.jsx`
  - **Tempo:** 20 minutos

- [ ] **Passo 2: Testar com dados reais**
  - Criar agendamento via Ísis
  - Verificar se mensagem foi enviada
  - Verificar se foi registrada no banco
  - **Tempo:** 10 minutos

**Total Fase 3.1:** ~30 minutos

---

### 3.2 Criar Dashboard de Confirmações

**Objetivo:** Visualizar status das confirmações

**Tarefas:**

- [ ] **Passo 1: Criar nova página ou aba**
  - **Arquivo:** `src/pages/ConfirmacoesPage.jsx` ou aba em AgendaPage
  - **Tempo:** 10 minutos

- [ ] **Passo 2: Implementar listagem**
  - Listar confirmações por status
  - Mostrar cliente, agendamento, data envio
  - Filtrar por status (pendente, confirmado, cancelado)
  - **Tempo:** 45 minutos

- [ ] **Passo 3: Implementar ações**
  - Reenviar mensagem
  - Cancelar manualmente
  - Ver resposta do cliente
  - **Tempo:** 30 minutos

- [ ] **Passo 4: Adicionar notificações**
  - Notificar quando cliente responde
  - Notificar se taxa de erro > 5%
  - **Tempo:** 20 minutos

- [ ] **Passo 5: Testar fluxo completo**
  - Agendamento → Confirmação → Resposta
  - Verificar atualização em tempo real
  - **Tempo:** 15 minutos

**Total Fase 3.2:** ~120 minutos

---

### 3.3 Adicionar Configuração de WhatsApp por Arena

**Objetivo:** Permitir que cada arena configure seu número Twilio

**Tarefas:**

- [ ] **Passo 1: Criar página de configuração**
  - **Arquivo:** `src/pages/ConfiguracoesPage.jsx` (adicionar seção)
  - **Tempo:** 15 minutos

- [ ] **Passo 2: Implementar formulário**
  - Campo: Número WhatsApp
  - Campo: Token Twilio
  - Toggle: Habilitar/Desabilitar
  - **Tempo:** 25 minutos

- [ ] **Passo 3: Validar e salvar**
  - Validar número (formato)
  - Validar token (testar conexão)
  - Salvar no banco
  - **Tempo:** 20 minutos

- [ ] **Passo 4: Testar**
  - Configurar número
  - Enviar mensagem de teste
  - Verificar se funciona
  - **Tempo:** 10 minutos

**Total Fase 3.3:** ~70 minutos

---

## Fase 4: Deploy e Produção

### 4.1 Preparar Aplicação para Deploy

**Objetivo:** Build e otimização para produção

**Tarefas:**

- [ ] **Passo 1: Clonar repositório na VPS**
  ```bash
  cd /var/www/fluxo7arena
  git clone https://github.com/seu-usuario/Fluxo7Arena.git .
  ```
  - **Tempo:** 5 minutos

- [ ] **Passo 2: Instalar dependências**
  ```bash
  npm install
  ```
  - **Tempo:** 10 minutos

- [ ] **Passo 3: Build para produção**
  ```bash
  npm run build
  ```
  - **Tempo:** 5 minutos

- [ ] **Passo 4: Verificar build**
  - Verificar se `/dist` foi criado
  - Verificar se não há erros
  - **Tempo:** 2 minutos

**Total Fase 4.1:** ~25 minutos

---

### 4.2 Deploy na VPS

**Objetivo:** Colocar aplicação no ar

**Tarefas:**

- [ ] **Passo 1: Recarregar Nginx**
  ```bash
  sudo systemctl reload nginx
  ```
  - **Tempo:** 2 minutos

- [ ] **Passo 2: Testar acesso**
  - Acessar `https://seudominio.com.br`
  - Verificar se carrega
  - Verificar console para erros
  - **Tempo:** 5 minutos

- [ ] **Passo 3: Testar funcionalidades**
  - Login
  - Criar agendamento
  - Enviar confirmação WhatsApp
  - Responder confirmação
  - **Tempo:** 20 minutos

- [ ] **Passo 4: Verificar SSL**
  - Clicar no cadeado 🔒
  - Verificar certificado
  - Verificar validade
  - **Tempo:** 2 minutos

**Total Fase 4.2:** ~30 minutos

---

### 4.3 Configurar CI/CD Simples

**Objetivo:** Automatizar deploy de atualizações

**Tarefas:**

- [ ] **Passo 1: Criar script de deploy**
  ```bash
  nano ~/deploy.sh
  ```
  - Clonar/pull repositório
  - npm install
  - npm run build
  - Recarregar Nginx
  - **Tempo:** 10 minutos

- [ ] **Passo 2: Dar permissão de execução**
  ```bash
  chmod +x ~/deploy.sh
  ```
  - **Tempo:** 1 minuto

- [ ] **Passo 3: Testar script**
  ```bash
  ~/deploy.sh
  ```
  - **Tempo:** 5 minutos

**Total Fase 4.3:** ~15 minutos

---

### 4.4 Monitoramento e Manutenção

**Objetivo:** Garantir funcionamento contínuo

**Tarefas:**

- [ ] **Passo 1: Configurar logs**
  - Monitorar erros de Nginx
  - Monitorar erros de aplicação
  - **Tempo:** 10 minutos

- [ ] **Passo 2: Configurar alertas**
  - Taxa de erro WhatsApp > 5%
  - Certificado SSL expirando
  - VPS com pouca memória
  - **Tempo:** 15 minutos

- [ ] **Passo 3: Documentar processo**
  - Como fazer deploy
  - Como reiniciar serviços
  - Como verificar logs
  - **Tempo:** 20 minutos

- [ ] **Passo 4: Treinar equipe**
  - Mostrar dashboard
  - Explicar fluxo WhatsApp
  - Explicar como reenviar confirmação
  - **Tempo:** 30 minutos

**Total Fase 4.4:** ~75 minutos

---

## 📅 Cronograma

### Semana 1: Infraestrutura

| Dia | Tarefa | Tempo | Status |
|-----|--------|-------|--------|
| Seg | Fase 1.1 - Cloudflare | 30 min | ⏳ |
| Seg | Fase 1.2 - VPS Setup | 30 min | ⏳ |
| Ter | Fase 1.3 - Nginx | 10 min | ⏳ |
| Ter | Fase 2.1 - Twilio | 25 min | ⏳ |
| Qua | Fase 2.2 - Migrations SQL | 15 min | ⏳ |
| **Total Semana 1** | | **110 min** | |

### Semana 2: Backend

| Dia | Tarefa | Tempo | Status |
|-----|--------|-------|--------|
| Seg | Fase 2.3 - Edge Function envio | 60 min | ⏳ |
| Ter | Fase 2.4 - Edge Function webhook | 75 min | ⏳ |
| Qua | Fase 2.5 - Variáveis ambiente | 10 min | ⏳ |
| Qua | Testes backend | 30 min | ⏳ |
| **Total Semana 2** | | **175 min** | |

### Semana 3: Frontend

| Dia | Tarefa | Tempo | Status |
|-----|--------|-------|--------|
| Seg | Fase 3.1 - Trigger IsisBookingPage | 30 min | ⏳ |
| Ter | Fase 3.2 - Dashboard confirmações | 120 min | ⏳ |
| Qua | Fase 3.3 - Config WhatsApp | 70 min | ⏳ |
| Qua | Testes frontend | 30 min | ⏳ |
| **Total Semana 3** | | **250 min** | |

### Semana 4: Deploy e Produção

| Dia | Tarefa | Tempo | Status |
|-----|--------|-------|--------|
| Seg | Fase 4.1 - Preparar deploy | 25 min | ⏳ |
| Ter | Fase 4.2 - Deploy VPS | 30 min | ⏳ |
| Ter | Fase 4.3 - CI/CD | 15 min | ⏳ |
| Qua | Fase 4.4 - Monitoramento | 75 min | ⏳ |
| Qua | Testes produção | 60 min | ⏳ |
| **Total Semana 4** | | **205 min** | |

---

## 📊 Resumo de Tempo

| Fase | Tempo |
|------|-------|
| **Fase 1: Infraestrutura** | 110 min |
| **Fase 2: Backend WhatsApp** | 175 min |
| **Fase 3: Frontend** | 250 min |
| **Fase 4: Deploy** | 205 min |
| **TOTAL** | **740 min** (≈ 12 horas) |

---

## ✅ Checklist Final

### Infraestrutura
- [ ] Domínio apontado para VPS
- [ ] Cloudflare configurado
- [ ] SSL Let's Encrypt instalado
- [ ] Nginx rodando
- [ ] Node.js instalado

### Backend
- [ ] Conta Twilio criada
- [ ] Credenciais geradas
- [ ] Migrations SQL executadas
- [ ] Edge Function envio deployada
- [ ] Edge Function webhook deployada
- [ ] Variáveis de ambiente configuradas

### Frontend
- [ ] Trigger integrado no IsisBookingPage
- [ ] Dashboard de confirmações criado
- [ ] Configuração de WhatsApp por arena
- [ ] Testes completos passando

### Deploy
- [ ] Aplicação clonada na VPS
- [ ] Build executado
- [ ] Nginx servindo aplicação
- [ ] HTTPS funcionando
- [ ] Fluxo completo testado
- [ ] Equipe treinada

---

## 🚀 Próximos Passos

1. **Hoje:** Começar Fase 1.1 (Cloudflare)
2. **Amanhã:** Completar Fase 1 (Infraestrutura)
3. **Próxima semana:** Fase 2 (Backend)
4. **Semana seguinte:** Fase 3 (Frontend)
5. **Última semana:** Fase 4 (Deploy)

---

## 📞 Suporte

- **Dúvidas Twilio:** https://www.twilio.com/docs
- **Dúvidas Supabase:** https://supabase.com/docs
- **Dúvidas Nginx:** https://nginx.org/en/docs/
- **Dúvidas Cloudflare:** https://developers.cloudflare.com/

---

**Documento criado em:** 27 de novembro de 2025  
**Versão:** 1.0  
**Status:** Pronto para execução  
**Responsável:** Equipe Fluxo7
