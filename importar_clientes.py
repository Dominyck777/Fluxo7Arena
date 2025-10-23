"""
Script de Importação de Clientes/Fornecedores para Fluxo7Arena
Importa dados do pessoas.csv para a tabela 'clientes' no Supabase
Empresa: 1006
"""

import pandas as pd
import re
from datetime import datetime
from supabase import create_client, Client
import os
from typing import Optional
import sys
from pathlib import Path

# ============================================================================
# CONFIGURAÇÕES
# ============================================================================

# Carrega variáveis de ambiente do arquivo .env.python
def carregar_env():
    env_file = Path(__file__).parent / '.env.python'
    if env_file.exists():
        with open(env_file, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ[key] = value
    else:
        print(f"⚠️  Arquivo .env.python não encontrado em {env_file}")

carregar_env()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
CODIGO_EMPRESA = "1006"
CSV_FILE = "pessoas.csv"

# Modo dry-run: True = apenas mostra o que seria inserido, False = insere no banco
DRY_RUN = True

# Validação de credenciais
if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ ERRO: Credenciais do Supabase não encontradas!")
    print("   Certifique-se de que o arquivo .env.python existe com:")
    print("   SUPABASE_URL=...")
    print("   SUPABASE_KEY=...")
    sys.exit(1)

# ============================================================================
# FUNÇÕES AUXILIARES
# ============================================================================

def limpar_numeros(valor: str) -> str:
    """Remove tudo que não é número"""
    if pd.isna(valor) or valor == '':
        return ''
    return re.sub(r'\D', '', str(valor))

def validar_cpf(cpf: str) -> bool:
    """Valida CPF (simplificado)"""
    cpf = limpar_numeros(cpf)
    return len(cpf) == 11 and cpf != '00000000000'

def validar_cnpj(cnpj: str) -> bool:
    """Valida CNPJ (simplificado)"""
    cnpj = limpar_numeros(cnpj)
    return len(cnpj) == 14 and cnpj != '00000000000000'

def validar_email(email: str) -> bool:
    """Valida email"""
    if pd.isna(email) or email == '':
        return False
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, str(email)))

def formatar_cep(cep: str) -> Optional[str]:
    """Formata CEP para 8 dígitos"""
    if pd.isna(cep) or cep == '':
        return None
    cep_limpo = limpar_numeros(cep)
    if len(cep_limpo) == 8:
        return cep_limpo
    return None

def formatar_telefone(telefone: str) -> Optional[str]:
    """Formata telefone"""
    if pd.isna(telefone) or telefone == '':
        return None
    tel_limpo = limpar_numeros(telefone)
    if len(tel_limpo) >= 10:
        return tel_limpo
    return None

def converter_data(data_str: str) -> Optional[str]:
    """Converte data de DD.MM.YYYY para YYYY-MM-DD"""
    if pd.isna(data_str) or data_str == '':
        return None
    
    try:
        # Tenta formato DD.MM.YYYY
        if '.' in str(data_str):
            partes = str(data_str).split('.')
            if len(partes) == 3:
                dia, mes, ano = partes
                return f"{ano}-{mes.zfill(2)}-{dia.zfill(2)}"
        
        # Tenta formato DD/MM/YYYY
        if '/' in str(data_str):
            partes = str(data_str).split('/')
            if len(partes) == 3:
                dia, mes, ano = partes
                return f"{ano}-{mes.zfill(2)}-{dia.zfill(2)}"
    except:
        pass
    
    return None

def flag_para_bool(valor: str) -> bool:
    """Converte S/N para True/False"""
    if pd.isna(valor):
        return False
    return str(valor).upper().strip() == 'S'

def limpar_texto(texto: str) -> Optional[str]:
    """Limpa e normaliza texto"""
    if pd.isna(texto) or texto == '':
        return None
    
    texto = str(texto).strip()
    
    # Tenta corrigir encoding comum
    replacements = {
        '�': 'Â',
        'Â': 'Ã',
        'Ã': 'Ã',
        'Ã': 'Á',
        'Ã': 'À',
        'Ã': 'Ç',
        'Ã': 'É',
        'Ã': 'Ê',
        'Ã': 'Í',
        'Ã': 'Ó',
        'Ã': 'Ô',
        'Ã': 'Õ',
        'Ã': 'Ú',
    }
    
    for old, new in replacements.items():
        texto = texto.replace(old, new)
    
    return texto if texto else None

def detectar_tipo_pessoa(cnpj_cpf: str) -> tuple[str, Optional[str], Optional[str]]:
    """
    Detecta se é pessoa física ou jurídica baseado no tamanho do documento
    Retorna: (tipo, cpf, cnpj)
    """
    if pd.isna(cnpj_cpf) or cnpj_cpf == '':
        return ('FÍSICA', None, None)
    
    doc_limpo = limpar_numeros(cnpj_cpf)
    
    if len(doc_limpo) == 11 and validar_cpf(doc_limpo):
        return ('FÍSICA', doc_limpo, None)
    elif len(doc_limpo) == 14 and validar_cnpj(doc_limpo):
        return ('JURÍDICA', None, doc_limpo)
    else:
        return ('FÍSICA', None, None)

def converter_decimal(valor: str) -> float:
    """Converte string para decimal"""
    if pd.isna(valor) or valor == '':
        return 0.0
    
    try:
        # Remove tudo que não é número, ponto ou vírgula
        valor_str = str(valor).replace(',', '.')
        return float(valor_str)
    except:
        return 0.0

# ============================================================================
# PROCESSAMENTO DO CSV
# ============================================================================

def processar_linha(row: pd.Series, index: int) -> Optional[dict]:
    """Processa uma linha do CSV e retorna um dict pronto para inserir"""
    
    try:
        # Detecta tipo de pessoa e documentos
        tipo_pessoa, cpf, cnpj = detectar_tipo_pessoa(row.get('CNPJ', ''))
        
        # Nome principal
        nome = limpar_texto(row.get('FANTASIA', ''))
        if not nome or nome == '':
            nome = limpar_texto(row.get('RAZAO', ''))
        
        if not nome:
            print(f"⚠️  Linha {index + 2}: Nome vazio, pulando...")
            return None
        
        # Monta o registro
        cliente = {
            'codigo_empresa': CODIGO_EMPRESA,
            'codigo': int(row.get('CODIGO', 0)),
            'nome': nome,
            'tipo_pessoa': tipo_pessoa,
            
            # Documentos
            'cpf': cpf,
            'cnpj': cnpj,
            'rg': limpar_texto(row.get('RG', '')),
            'ie': limpar_texto(row.get('IE', '')),
            
            # Apelido/Razão Social
            'apelido': limpar_texto(row.get('RAZAO', '')),
            
            # Contatos
            'telefone': formatar_telefone(row.get('FONE1', '')),
            'fone2': formatar_telefone(row.get('FONE2', '')),
            'celular1': formatar_telefone(row.get('CELULAR1', '')),
            'celular2': formatar_telefone(row.get('CELULAR2', '')),
            'whatsapp': formatar_telefone(row.get('WHATSAPP', '')),
            'email': limpar_texto(row.get('EMAIL1', '')) if validar_email(row.get('EMAIL1', '')) else None,
            
            # Endereço
            'cep': formatar_cep(row.get('CEP', '')),
            'endereco': limpar_texto(row.get('ENDERECO', '')),
            'numero': limpar_texto(row.get('NUMERO', '')),
            'complemento': limpar_texto(row.get('COMPLEMENTO', '')),
            'bairro': limpar_texto(row.get('BAIRRO', '')),
            'cidade': limpar_texto(row.get('MUNICIPIO', '')),
            'uf': limpar_texto(row.get('UF', '')),
            'cidade_ibge': limpar_texto(row.get('CODMUN', '')),
            
            # Dados pessoais
            'aniversario': converter_data(row.get('DT_NASC', '')),
            'sexo': limpar_texto(row.get('SEXO', '')),
            'estado_civil': limpar_texto(row.get('ECIVIL', '')),
            'nome_mae': limpar_texto(row.get('MAE', '')),
            'nome_pai': limpar_texto(row.get('PAI', '')),
            
            # Financeiro
            'limite_credito': converter_decimal(row.get('LIMITE', 0)),
            'saldo': 0.0,  # Iniciar com saldo zero
            
            # Flags de categoria
            'flag_cliente': flag_para_bool(row.get('CLI', 'N')),
            'flag_fornecedor': flag_para_bool(row.get('FORN', 'N')),
            'flag_funcionario': flag_para_bool(row.get('FUN', 'N')),
            'flag_administradora': flag_para_bool(row.get('ADM', 'N')),
            'flag_ccf_spc': flag_para_bool(row.get('SPC', 'N')) or flag_para_bool(row.get('CCF', 'N')),
            
            # Outros
            'regime_tributario': limpar_texto(row.get('REGIME_TRIBUTARIO', '')),
            'tipo_recebimento': limpar_texto(row.get('TIPO_RECEBIMENTO', '')),
            'status': 'active' if flag_para_bool(row.get('ATIVO', 'S')) else 'inactive',
            
            # Observações (pode adicionar info extra aqui)
            'observacoes': None,
        }
        
        return cliente
        
    except Exception as e:
        print(f"❌ Erro ao processar linha {index + 2}: {e}")
        return None

# ============================================================================
# IMPORTAÇÃO
# ============================================================================

def importar_clientes():
    """Função principal de importação"""
    
    print("=" * 80)
    print("IMPORTAÇÃO DE CLIENTES/FORNECEDORES - FLUXO7ARENA")
    print("=" * 80)
    print(f"Empresa: {CODIGO_EMPRESA}")
    print(f"Arquivo: {CSV_FILE}")
    print(f"Modo: {'DRY-RUN (teste)' if DRY_RUN else 'PRODUÇÃO (vai inserir no banco)'}")
    print("=" * 80)
    print()
    
    # Lê o CSV
    print("📂 Lendo arquivo CSV...")
    try:
        # Tenta diferentes encodings
        for encoding in ['utf-8', 'latin1', 'cp1252', 'iso-8859-1']:
            try:
                df = pd.read_csv(CSV_FILE, sep=';', encoding=encoding)
                print(f"✅ Arquivo lido com encoding: {encoding}")
                break
            except:
                continue
        else:
            print("❌ Não foi possível ler o arquivo com nenhum encoding conhecido")
            return
    except Exception as e:
        print(f"❌ Erro ao ler arquivo: {e}")
        return
    
    print(f"📊 Total de linhas no CSV: {len(df)}")
    print()
    
    # Processa cada linha
    print("🔄 Processando registros...")
    registros_validos = []
    
    for index, row in df.iterrows():
        cliente = processar_linha(row, index)
        if cliente:
            registros_validos.append(cliente)
            
            # Mostra resumo
            flags = []
            if cliente['flag_cliente']: flags.append('CLIENTE')
            if cliente['flag_fornecedor']: flags.append('FORNECEDOR')
            if cliente['flag_funcionario']: flags.append('FUNCIONÁRIO')
            if cliente['flag_administradora']: flags.append('ADMIN')
            
            print(f"  ✓ [{cliente['codigo']:3d}] {cliente['nome'][:40]:40s} | {cliente['tipo_pessoa']:8s} | {', '.join(flags)}")
    
    print()
    print(f"✅ Registros processados: {len(registros_validos)}/{len(df)}")
    print()
    
    # Estatísticas
    total_clientes = sum(1 for r in registros_validos if r['flag_cliente'])
    total_fornecedores = sum(1 for r in registros_validos if r['flag_fornecedor'])
    total_funcionarios = sum(1 for r in registros_validos if r['flag_funcionario'])
    total_fisicas = sum(1 for r in registros_validos if r['tipo_pessoa'] == 'FÍSICA')
    total_juridicas = sum(1 for r in registros_validos if r['tipo_pessoa'] == 'JURÍDICA')
    
    print("📈 ESTATÍSTICAS:")
    print(f"   • Clientes: {total_clientes}")
    print(f"   • Fornecedores: {total_fornecedores}")
    print(f"   • Funcionários: {total_funcionarios}")
    print(f"   • Pessoas Físicas: {total_fisicas}")
    print(f"   • Pessoas Jurídicas: {total_juridicas}")
    print()
    
    if DRY_RUN:
        print("=" * 80)
        print("🔍 MODO DRY-RUN ATIVO")
        print("=" * 80)
        print("Os dados foram processados mas NÃO foram inseridos no banco.")
        print("Para inserir de verdade, altere DRY_RUN = False no script.")
        print()
        print("📋 EXEMPLO DE REGISTRO PROCESSADO:")
        print("-" * 80)
        if registros_validos:
            import json
            print(json.dumps(registros_validos[0], indent=2, ensure_ascii=False))
        print("=" * 80)
        return
    
    # Conecta ao Supabase
    print("🔌 Conectando ao Supabase...")
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("✅ Conectado!")
    except Exception as e:
        print(f"❌ Erro ao conectar: {e}")
        return
    
    # Insere os registros
    print()
    print("💾 Inserindo registros no banco...")
    sucesso = 0
    erros = 0
    
    for cliente in registros_validos:
        try:
            supabase.table('clientes').insert(cliente).execute()
            sucesso += 1
            print(f"  ✓ [{cliente['codigo']:3d}] {cliente['nome'][:50]}")
        except Exception as e:
            erros += 1
            print(f"  ✗ [{cliente['codigo']:3d}] {cliente['nome'][:50]} - ERRO: {e}")
    
    print()
    print("=" * 80)
    print("✅ IMPORTAÇÃO CONCLUÍDA!")
    print("=" * 80)
    print(f"   • Sucesso: {sucesso}")
    print(f"   • Erros: {erros}")
    print(f"   • Total: {len(registros_validos)}")
    print("=" * 80)

# ============================================================================
# EXECUÇÃO
# ============================================================================

if __name__ == "__main__":
    importar_clientes()
