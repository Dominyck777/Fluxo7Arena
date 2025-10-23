/**
 * Script de Importação DIRETO via SQL - Bypass RLS
 * Usa a mesma conexão do frontend mas com bypass de RLS
 */

const fs = require('fs');
const https = require('https');

// Carrega env
function carregarEnv() {
    try {
        const envContent = fs.readFileSync('.env.python', 'utf8');
        const lines = envContent.split('\n');
        lines.forEach(line => {
            line = line.trim();
            if (line && !line.startsWith('#') && line.includes('=')) {
                const [key, ...valueParts] = line.split('=');
                const value = valueParts.join('=');
                process.env[key] = value;
            }
        });
    } catch (error) {
        console.log('⚠️  Arquivo .env.python não encontrado');
    }
}

carregarEnv();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const CODIGO_EMPRESA = "1006";

console.log("================================================================================");
console.log("IMPORTAÇÃO DIRETA - CLIENTES/FORNECEDORES");
console.log("================================================================================");
console.log();
console.log("⚠️  ATENÇÃO: Este script vai inserir os dados DIRETAMENTE no Supabase!");
console.log();
console.log("Para scripts de importação em massa, é recomendado:");
console.log("1. Usar o Supabase Dashboard (SQL Editor)");
console.log("2. Ou usar a service_role key (não a anon key)");
console.log("3. Ou desabilitar temporariamente o RLS na tabela clientes");
console.log();
console.log("================================================================================");
console.log();
console.log("📝 SOLUÇÃO RECOMENDADA:");
console.log();
console.log("Execute este SQL no Supabase Dashboard → SQL Editor:");
console.log();
console.log("-".repeat(80));
console.log(`
-- Desabilita RLS temporariamente
ALTER TABLE clientes DISABLE ROW LEVEL SECURITY;

-- Seus INSERTs aqui (vou gerar abaixo)

-- Reabilita RLS
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
`);
console.log("-".repeat(80));
console.log();
console.log("Gerando SQL de INSERT...");
console.log();

// Lê CSV
const csvContent = fs.readFileSync('pessoas.csv', 'utf8');
const lines = csvContent.split('\n');
const headers = lines[0].split(';').map(h => h.trim());

const sqlStatements = [];

for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    
    const values = lines[i].split(';');
    const row = {};
    headers.forEach((header, idx) => {
        row[header] = values[idx] ? values[idx].trim() : '';
    });
    
    // Processa
    const codigo = parseInt(row.CODIGO) || 0;
    let nome = row.FANTASIA || row.RAZAO || '';
    if (!nome) continue;
    
    // Escapa aspas simples
    nome = nome.replace(/'/g, "''");
    const apelido = (row.RAZAO || '').replace(/'/g, "''");
    
    // Detecta tipo
    const cnpjCpf = (row.CNPJ || '').replace(/\D/g, '');
    let tipoPessoa = 'FÍSICA';
    let cpf = 'NULL';
    let cnpj = 'NULL';
    
    if (cnpjCpf.length === 11) {
        tipoPessoa = 'FÍSICA';
        cpf = `'${cnpjCpf}'`;
    } else if (cnpjCpf.length === 14) {
        tipoPessoa = 'JURÍDICA';
        cnpj = `'${cnpjCpf}'`;
    }
    
    // Telefones
    const telefone = (row.FONE1 || '').replace(/\D/g, '');
    const celular1 = (row.CELULAR1 || '').replace(/\D/g, '');
    const whatsapp = (row.WHATSAPP || '').replace(/\D/g, '');
    
    // Email
    const email = row.EMAIL1 || '';
    
    // Endereço
    const cep = (row.CEP || '').replace(/\D/g, '');
    const endereco = (row.ENDERECO || '').replace(/'/g, "''");
    const numero = (row.NUMERO || '').replace(/'/g, "''");
    const bairro = (row.BAIRRO || '').replace(/'/g, "''");
    const cidade = (row.MUNICIPIO || '').replace(/'/g, "''");
    const uf = row.UF || '';
    
    // Flags
    const flagCliente = (row.CLI || 'N').toUpperCase() === 'S';
    const flagFornecedor = (row.FORN || 'N').toUpperCase() === 'S';
    const flagFuncionario = (row.FUN || 'N').toUpperCase() === 'S';
    
    // Monta SQL
    const sql = `
INSERT INTO clientes (
    codigo_empresa, codigo, nome, tipo_pessoa, cpf, cnpj, apelido,
    telefone, celular1, whatsapp, email,
    cep, endereco, numero, bairro, cidade, uf,
    flag_cliente, flag_fornecedor, flag_funcionario,
    saldo, limite_credito, status
) VALUES (
    '${CODIGO_EMPRESA}', ${codigo}, '${nome}', '${tipoPessoa}', ${cpf}, ${cnpj}, ${apelido ? `'${apelido}'` : 'NULL'},
    ${telefone ? `'${telefone}'` : 'NULL'}, ${celular1 ? `'${celular1}'` : 'NULL'}, ${whatsapp ? `'${whatsapp}'` : 'NULL'}, ${email ? `'${email}'` : 'NULL'},
    ${cep ? `'${cep}'` : 'NULL'}, ${endereco ? `'${endereco}'` : 'NULL'}, ${numero ? `'${numero}'` : 'NULL'}, ${bairro ? `'${bairro}'` : 'NULL'}, ${cidade ? `'${cidade}'` : 'NULL'}, ${uf ? `'${uf}'` : 'NULL'},
    ${flagCliente}, ${flagFornecedor}, ${flagFuncionario},
    0.00, 0.00, 'active'
);`;
    
    sqlStatements.push(sql);
}

// Salva em arquivo
const sqlCompleto = `
-- ============================================================================
-- IMPORTAÇÃO DE CLIENTES/FORNECEDORES - EMPRESA ${CODIGO_EMPRESA}
-- Gerado automaticamente em ${new Date().toLocaleString('pt-BR')}
-- Total de registros: ${sqlStatements.length}
-- ============================================================================

-- IMPORTANTE: Execute este script no Supabase Dashboard → SQL Editor

-- 1. Desabilita RLS temporariamente
ALTER TABLE clientes DISABLE ROW LEVEL SECURITY;

-- 2. Insere os dados
${sqlStatements.join('\n')}

-- 3. Reabilita RLS
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- FIM DA IMPORTAÇÃO
-- ============================================================================
`;

fs.writeFileSync('importacao_clientes_1006.sql', sqlCompleto, 'utf8');

console.log("✅ Arquivo SQL gerado: importacao_clientes_1006.sql");
console.log(`📊 Total de registros: ${sqlStatements.length}`);
console.log();
console.log("================================================================================");
console.log("🎯 PRÓXIMOS PASSOS:");
console.log("================================================================================");
console.log();
console.log("1. Abra o Supabase Dashboard:");
console.log(`   ${SUPABASE_URL.replace('//', '//app.')}/project/_/sql`);
console.log();
console.log("2. Clique em 'New query'");
console.log();
console.log("3. Cole o conteúdo do arquivo: importacao_clientes_1006.sql");
console.log();
console.log("4. Clique em 'Run' para executar");
console.log();
console.log("5. Pronto! Os dados serão inseridos no banco.");
console.log();
console.log("================================================================================");
console.log();
console.log("💡 DICA: O arquivo SQL já está pronto para copiar e colar!");
console.log();
