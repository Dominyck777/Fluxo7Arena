/**
 * Script de Importação de Clientes/Fornecedores para Fluxo7Arena
 * Importa dados do pessoas.csv para a tabela 'clientes' no Supabase
 * Empresa: 1006
 */

const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// ============================================================================
// CONFIGURAÇÕES
// ============================================================================

// Carrega variáveis de ambiente do arquivo .env.python
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
const CSV_FILE = "pessoas.csv";

// Modo dry-run: true = apenas mostra o que seria inserido, false = insere no banco
const DRY_RUN = false; // MODO PRODUÇÃO - VAI INSERIR!

// Validação de credenciais
if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.log("❌ ERRO: Credenciais do Supabase não encontradas!");
    console.log("   Certifique-se de que o arquivo .env.python existe");
    process.exit(1);
}

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

function limparNumeros(valor) {
    if (!valor) return '';
    return String(valor).replace(/\D/g, '');
}

function validarCPF(cpf) {
    const cpfLimpo = limparNumeros(cpf);
    return cpfLimpo.length === 11 && cpfLimpo !== '00000000000';
}

function validarCNPJ(cnpj) {
    const cnpjLimpo = limparNumeros(cnpj);
    return cnpjLimpo.length === 14 && cnpjLimpo !== '00000000000000';
}

function validarEmail(email) {
    if (!email) return false;
    const pattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return pattern.test(String(email));
}

function formatarCEP(cep) {
    if (!cep) return null;
    const cepLimpo = limparNumeros(cep);
    return cepLimpo.length === 8 ? cepLimpo : null;
}

function formatarTelefone(telefone) {
    if (!telefone) return null;
    const telLimpo = limparNumeros(telefone);
    return telLimpo.length >= 10 ? telLimpo : null;
}

function converterData(dataStr) {
    if (!dataStr) return null;
    
    try {
        const str = String(dataStr);
        // Formato DD.MM.YYYY
        if (str.includes('.')) {
            const [dia, mes, ano] = str.split('.');
            if (dia && mes && ano) {
                return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
            }
        }
        // Formato DD/MM/YYYY
        if (str.includes('/')) {
            const [dia, mes, ano] = str.split('/');
            if (dia && mes && ano) {
                return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
            }
        }
    } catch (e) {
        return null;
    }
    
    return null;
}

function flagParaBool(valor) {
    if (!valor) return false;
    return String(valor).toUpperCase().trim() === 'S';
}

function limparTexto(texto) {
    if (!texto || texto === '') return null;
    return String(texto).trim() || null;
}

function detectarTipoPessoa(cnpjCpf) {
    if (!cnpjCpf) return ['FÍSICA', null, null];
    
    const docLimpo = limparNumeros(cnpjCpf);
    
    if (docLimpo.length === 11 && validarCPF(docLimpo)) {
        return ['FÍSICA', docLimpo, null];
    } else if (docLimpo.length === 14 && validarCNPJ(docLimpo)) {
        return ['JURÍDICA', null, docLimpo];
    }
    
    return ['FÍSICA', null, null];
}

function converterDecimal(valor) {
    if (!valor || valor === '') return 0.0;
    
    try {
        const valorStr = String(valor).replace(',', '.');
        return parseFloat(valorStr) || 0.0;
    } catch (e) {
        return 0.0;
    }
}

// ============================================================================
// PROCESSAMENTO DO CSV
// ============================================================================

function processarLinha(row, index) {
    try {
        // Detecta tipo de pessoa e documentos
        const [tipoPessoa, cpf, cnpj] = detectarTipoPessoa(row.CNPJ);
        
        // Nome principal
        let nome = limparTexto(row.FANTASIA);
        if (!nome) {
            nome = limparTexto(row.RAZAO);
        }
        
        if (!nome) {
            console.log(`⚠️  Linha ${index + 2}: Nome vazio, pulando...`);
            return null;
        }
        
        // Monta o registro
        const cliente = {
            codigo_empresa: CODIGO_EMPRESA,
            codigo: parseInt(row.CODIGO) || 0,
            nome: nome,
            tipo_pessoa: tipoPessoa,
            
            // Documentos
            cpf: cpf,
            cnpj: cnpj,
            rg: limparTexto(row.RG),
            ie: limparTexto(row.IE),
            
            // Apelido/Razão Social
            apelido: limparTexto(row.RAZAO),
            
            // Contatos
            telefone: formatarTelefone(row.FONE1),
            fone2: formatarTelefone(row.FONE2),
            celular1: formatarTelefone(row.CELULAR1),
            celular2: formatarTelefone(row.CELULAR2),
            whatsapp: formatarTelefone(row.WHATSAPP),
            email: validarEmail(row.EMAIL1) ? limparTexto(row.EMAIL1) : null,
            
            // Endereço
            cep: formatarCEP(row.CEP),
            endereco: limparTexto(row.ENDERECO),
            numero: limparTexto(row.NUMERO),
            complemento: limparTexto(row.COMPLEMENTO),
            bairro: limparTexto(row.BAIRRO),
            cidade: limparTexto(row.MUNICIPIO),
            uf: limparTexto(row.UF),
            cidade_ibge: limparTexto(row.CODMUN),
            
            // Dados pessoais
            aniversario: converterData(row.DT_NASC),
            sexo: limparTexto(row.SEXO),
            estado_civil: limparTexto(row.ECIVIL),
            nome_mae: limparTexto(row.MAE),
            nome_pai: limparTexto(row.PAI),
            
            // Financeiro
            limite_credito: converterDecimal(row.LIMITE),
            saldo: 0.0,
            
            // Flags de categoria
            flag_cliente: flagParaBool(row.CLI),
            flag_fornecedor: flagParaBool(row.FORN),
            flag_funcionario: flagParaBool(row.FUN),
            flag_administradora: flagParaBool(row.ADM),
            flag_ccf_spc: flagParaBool(row.SPC) || flagParaBool(row.CCF),
            
            // Outros
            regime_tributario: limparTexto(row.REGIME_TRIBUTARIO),
            tipo_recebimento: limparTexto(row.TIPO_RECEBIMENTO),
            status: flagParaBool(row.ATIVO) ? 'active' : 'inactive',
            
            observacoes: null,
        };
        
        return cliente;
        
    } catch (error) {
        console.log(`❌ Erro ao processar linha ${index + 2}:`, error.message);
        return null;
    }
}

// ============================================================================
// IMPORTAÇÃO
// ============================================================================

async function importarClientes() {
    console.log("=".repeat(80));
    console.log("IMPORTAÇÃO DE CLIENTES/FORNECEDORES - FLUXO7ARENA");
    console.log("=".repeat(80));
    console.log(`Empresa: ${CODIGO_EMPRESA}`);
    console.log(`Arquivo: ${CSV_FILE}`);
    console.log(`Modo: ${DRY_RUN ? 'DRY-RUN (teste)' : '🔥 PRODUÇÃO (vai inserir no banco)'}`);
    console.log("=".repeat(80));
    console.log();
    
    // Lê o CSV
    console.log("📂 Lendo arquivo CSV...");
    let csvContent;
    try {
        csvContent = fs.readFileSync(CSV_FILE, 'utf8');
        console.log("✅ Arquivo lido com sucesso");
    } catch (error) {
        console.log("❌ Erro ao ler arquivo:", error.message);
        return;
    }
    
    // Parse CSV simples
    const lines = csvContent.split('\n');
    const headers = lines[0].split(';').map(h => h.trim());
    
    console.log(`📊 Total de linhas no CSV: ${lines.length - 1}`);
    console.log();
    
    // Processa cada linha
    console.log("🔄 Processando registros...");
    const registrosValidos = [];
    
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        const values = lines[i].split(';');
        const row = {};
        headers.forEach((header, idx) => {
            row[header] = values[idx] ? values[idx].trim() : '';
        });
        
        const cliente = processarLinha(row, i);
        if (cliente) {
            registrosValidos.push(cliente);
            
            // Mostra resumo
            const flags = [];
            if (cliente.flag_cliente) flags.push('CLIENTE');
            if (cliente.flag_fornecedor) flags.push('FORNECEDOR');
            if (cliente.flag_funcionario) flags.push('FUNCIONÁRIO');
            if (cliente.flag_administradora) flags.push('ADMIN');
            
            const nomeFormatado = cliente.nome.substring(0, 40).padEnd(40);
            console.log(`  ✓ [${String(cliente.codigo).padStart(3)}] ${nomeFormatado} | ${cliente.tipo_pessoa.padEnd(8)} | ${flags.join(', ')}`);
        }
    }
    
    console.log();
    console.log(`✅ Registros processados: ${registrosValidos.length}/${lines.length - 1}`);
    console.log();
    
    // Estatísticas
    const totalClientes = registrosValidos.filter(r => r.flag_cliente).length;
    const totalFornecedores = registrosValidos.filter(r => r.flag_fornecedor).length;
    const totalFuncionarios = registrosValidos.filter(r => r.flag_funcionario).length;
    const totalFisicas = registrosValidos.filter(r => r.tipo_pessoa === 'FÍSICA').length;
    const totalJuridicas = registrosValidos.filter(r => r.tipo_pessoa === 'JURÍDICA').length;
    
    console.log("📈 ESTATÍSTICAS:");
    console.log(`   • Clientes: ${totalClientes}`);
    console.log(`   • Fornecedores: ${totalFornecedores}`);
    console.log(`   • Funcionários: ${totalFuncionarios}`);
    console.log(`   • Pessoas Físicas: ${totalFisicas}`);
    console.log(`   • Pessoas Jurídicas: ${totalJuridicas}`);
    console.log();
    
    if (DRY_RUN) {
        console.log("=".repeat(80));
        console.log("🔍 MODO DRY-RUN ATIVO");
        console.log("=".repeat(80));
        console.log("Os dados foram processados mas NÃO foram inseridos no banco.");
        console.log("Para inserir de verdade, altere DRY_RUN = false no script.");
        console.log();
        console.log("📋 EXEMPLO DE REGISTRO PROCESSADO:");
        console.log("-".repeat(80));
        if (registrosValidos.length > 0) {
            console.log(JSON.stringify(registrosValidos[0], null, 2));
        }
        console.log("=".repeat(80));
        return;
    }
    
    // Conecta ao Supabase
    console.log("🔌 Conectando ao Supabase...");
    let supabase;
    try {
        supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log("✅ Conectado!");
    } catch (error) {
        console.log("❌ Erro ao conectar:", error.message);
        return;
    }
    
    // Insere os registros
    console.log();
    console.log("💾 Inserindo registros no banco...");
    let sucesso = 0;
    let erros = 0;
    
    for (const cliente of registrosValidos) {
        try {
            const { error } = await supabase
                .from('clientes')
                .insert(cliente);
            
            if (error) throw error;
            
            sucesso++;
            const nomeFormatado = cliente.nome.substring(0, 50).padEnd(50);
            console.log(`  ✓ [${String(cliente.codigo).padStart(3)}] ${nomeFormatado}`);
        } catch (error) {
            erros++;
            const nomeFormatado = cliente.nome.substring(0, 50).padEnd(50);
            console.log(`  ✗ [${String(cliente.codigo).padStart(3)}] ${nomeFormatado} - ERRO: ${error.message}`);
        }
    }
    
    console.log();
    console.log("=".repeat(80));
    console.log("✅ IMPORTAÇÃO CONCLUÍDA!");
    console.log("=".repeat(80));
    console.log(`   • Sucesso: ${sucesso}`);
    console.log(`   • Erros: ${erros}`);
    console.log(`   • Total: ${registrosValidos.length}`);
    console.log("=".repeat(80));
}

// ============================================================================
// EXECUÇÃO
// ============================================================================

importarClientes().catch(error => {
    console.error("❌ Erro fatal:", error);
    process.exit(1);
});
