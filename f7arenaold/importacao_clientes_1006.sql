
-- ============================================================================
-- IMPORTAÇÃO DE CLIENTES/FORNECEDORES - EMPRESA 1006
-- Gerado automaticamente em 23/10/2025, 09:50:23
-- Total de registros: 50
-- ============================================================================

-- IMPORTANTE: Execute este script no Supabase Dashboard → SQL Editor

-- 1. Desabilita RLS temporariamente
ALTER TABLE clientes DISABLE ROW LEVEL SECURITY;

-- 2. Insere os dados

INSERT INTO clientes (
    codigo_empresa, codigo, nome, tipo_pessoa, cpf, cnpj, apelido,
    telefone, celular1, whatsapp, email,
    cep, endereco, numero, bairro, cidade, uf,
    flag_cliente, flag_fornecedor, flag_funcionario,
    saldo, limite_credito, status
) VALUES (
    '1006', 1, 'CONSUMIDOR FINAL', 'FÍSICA', NULL, NULL, 'CONSUMIDOR FINAL',
    NULL, NULL, NULL, NULL,
    NULL, NULL, NULL, NULL, NULL, NULL,
    true, false, false,
    0.00, 0.00, 'active'
);

INSERT INTO clientes (
    codigo_empresa, codigo, nome, tipo_pessoa, cpf, cnpj, apelido,
    telefone, celular1, whatsapp, email,
    cep, endereco, numero, bairro, cidade, uf,
    flag_cliente, flag_fornecedor, flag_funcionario,
    saldo, limite_credito, status
) VALUES (
    '1006', 2, 'BHM MIX UBERLANDIA JOAO NAVES', 'JURÍDICA', NULL, '17745613006434', 'SUPERMERCADO BAHAMAS S/A',
    NULL, NULL, NULL, NULL,
    '38408144', 'AVENIDA JOAO NAVES DE AVILA', 'N 3730', 'SANTA MONICA', 'UBERLANDIA', 'MG',
    false, true, false,
    0.00, 0.00, 'active'
);

INSERT INTO clientes (
    codigo_empresa, codigo, nome, tipo_pessoa, cpf, cnpj, apelido,
    telefone, celular1, whatsapp, email,
    cep, endereco, numero, bairro, cidade, uf,
    flag_cliente, flag_fornecedor, flag_funcionario,
    saldo, limite_credito, status
) VALUES (
    '1006', 3, 'BHM MIX UBERLANDIA AEROPORTO', 'JURÍDICA', NULL, '17745613003923', 'SUPERMERCADO BAHAMAS S/A',
    NULL, NULL, NULL, NULL,
    '38406418', 'AVENIDA RUI DE CASTRO SANTOS', '1991', 'MANSOES AEROPORTO', 'UBERLANDIA', 'MG',
    false, true, false,
    0.00, 0.00, 'active'
);

INSERT INTO clientes (
    codigo_empresa, codigo, nome, tipo_pessoa, cpf, cnpj, apelido,
    telefone, celular1, whatsapp, email,
    cep, endereco, numero, bairro, cidade, uf,
    flag_cliente, flag_fornecedor, flag_funcionario,
    saldo, limite_credito, status
) VALUES (
    '1006', 4, 'MART MINAS UBERLANDIA', 'JURÍDICA', NULL, '04737552001029', 'MART MINAS DISTRIBUICAO LTDA',
    '3432218730', NULL, NULL, NULL,
    '38408342', 'R CLEONE CAIRO GOMES', '777', 'SEGISMUNDO PEREIRA', 'UBERLANDIA', 'MG',
    false, true, false,
    0.00, 0.00, 'active'
);

INSERT INTO clientes (
    codigo_empresa, codigo, nome, tipo_pessoa, cpf, cnpj, apelido,
    telefone, celular1, whatsapp, email,
    cep, endereco, numero, bairro, cidade, uf,
    flag_cliente, flag_fornecedor, flag_funcionario,
    saldo, limite_credito, status
) VALUES (
    '1006', 5, 'KAMEL COMERCIO DE ALIMENTOS LT', 'JURÍDICA', NULL, '31550561000198', 'KAMEL COMERCIO DE ALIMENTOS LTDA',
    NULL, NULL, NULL, NULL,
    '38408680', 'AV JOAO NAVES DE AVILA', '4065', 'SANTA MONICA', 'UBERLANDIA', 'MG',
    false, true, false,
    0.00, 0.00, 'active'
);

INSERT INTO clientes (
    codigo_empresa, codigo, nome, tipo_pessoa, cpf, cnpj, apelido,
    telefone, celular1, whatsapp, email,
    cep, endereco, numero, bairro, cidade, uf,
    flag_cliente, flag_fornecedor, flag_funcionario,
    saldo, limite_credito, status
) VALUES (
    '1006', 6, 'CARLOSALBERTO DE MENEZES', 'FÍSICA', '90616057172', NULL, 'CARLOSALBERTO DE MENEZES',
    NULL, NULL, '34999057602', 'CARLOSALBERTOM1979@LOIVE.COM',
    '38407396', 'RUA DO PINTASSILGO', '11', 'MURUMBI', 'UBERL�NDIA', 'MG',
    true, false, true,
    0.00, 0.00, 'active'
);

INSERT INTO clientes (
    codigo_empresa, codigo, nome, tipo_pessoa, cpf, cnpj, apelido,
    telefone, celular1, whatsapp, email,
    cep, endereco, numero, bairro, cidade, uf,
    flag_cliente, flag_fornecedor, flag_funcionario,
    saldo, limite_credito, status
) VALUES (
    '1006', 7, 'RAFAEL VICENTE DE OLIVEIRA', 'FÍSICA', '70221857605', NULL, 'RAFAEL VICENTE DE OLIVEIRA',
    NULL, NULL, '34996713749', 'RV394130@GMAIL.COM',
    '38407306', 'RUA CELEIRO', '391', 'MURUMBI', 'UBERL�NDIA', 'MG',
    true, false, false,
    0.00, 0.00, 'active'
);

INSERT INTO clientes (
    codigo_empresa, codigo, nome, tipo_pessoa, cpf, cnpj, apelido,
    telefone, celular1, whatsapp, email,
    cep, endereco, numero, bairro, cidade, uf,
    flag_cliente, flag_fornecedor, flag_funcionario,
    saldo, limite_credito, status
) VALUES (
    '1006', 8, 'GUILHERME SALES', 'FÍSICA', '09223230624', NULL, 'GUILHERME SALES',
    NULL, NULL, '34996977798', NULL,
    '38407306', 'RUA CELEIRO', '372', 'MURUMBI', 'UBERL�NDIA', 'MG',
    true, false, false,
    0.00, 0.00, 'active'
);

INSERT INTO clientes (
    codigo_empresa, codigo, nome, tipo_pessoa, cpf, cnpj, apelido,
    telefone, celular1, whatsapp, email,
    cep, endereco, numero, bairro, cidade, uf,
    flag_cliente, flag_fornecedor, flag_funcionario,
    saldo, limite_credito, status
) VALUES (
    '1006', 9, 'SEXTA FEIRA 20:0,0 HORAS', 'FÍSICA', '09183807667', NULL, 'MAYCON DOUGLAS SOUSA ESILVA',
    NULL, NULL, '34988410159', NULL,
    '38407321', 'RUA JURUBEBA', '170', 'MURUMBI', 'UBERL�NDIA', 'MG',
    true, false, false,
    0.00, 0.00, 'active'
);

INSERT INTO clientes (
    codigo_empresa, codigo, nome, tipo_pessoa, cpf, cnpj, apelido,
    telefone, celular1, whatsapp, email,
    cep, endereco, numero, bairro, cidade, uf,
    flag_cliente, flag_fornecedor, flag_funcionario,
    saldo, limite_credito, status
) VALUES (
    '1006', 10, 'ANT�NIO RAILSON LEAL DE S�', 'FÍSICA', '18098888673', NULL, 'ANT�NIO RAILSON LEAL DE S�',
    '3491568297', NULL, NULL, 'RAILSONLEALDESA@GMAIL.COM',
    '38407473', 'RUA FERNANDO OLIVEIRA MOTA', '0', 'MORUMBI�', 'UBERL�NDIA', 'MG',
    true, false, false,
    0.00, 0.00, 'active'
);

INSERT INTO clientes (
    codigo_empresa, codigo, nome, tipo_pessoa, cpf, cnpj, apelido,
    telefone, celular1, whatsapp, email,
    cep, endereco, numero, bairro, cidade, uf,
    flag_cliente, flag_fornecedor, flag_funcionario,
    saldo, limite_credito, status
) VALUES (
    '1006', 11, 'MATHEUS DO SOCORRO COSTA DE AIZ', 'FÍSICA', '01787967271', NULL, 'MATHEUS DO SOCORRO COSTA DE AIZ',
    NULL, NULL, '349913002367', 'MATHEUSCM1479M@GMAIL.COM',
    '38408396', 'RUA I ESQUINA CARNAUBA', '1', 'MANA', 'UBERL�NDIA', 'MG',
    true, false, false,
    0.00, 0.00, 'active'
);

INSERT INTO clientes (
    codigo_empresa, codigo, nome, tipo_pessoa, cpf, cnpj, apelido,
    telefone, celular1, whatsapp, email,
    cep, endereco, numero, bairro, cidade, uf,
    flag_cliente, flag_fornecedor, flag_funcionario,
    saldo, limite_credito, status
) VALUES (
    '1006', 12, 'IGREJA METODISTA UDI LESTE EM UBERLANDIA', 'JURÍDICA', NULL, '03547733013036', 'ASSOCIACAO DA IGREJA METODISTA - QUINTA REGIAO ECLESIASTICA',
    '34991586617', NULL, '34991586617', 'IMULE@OUTLOOK.COM.BR',
    '38408188', 'AVENIDA JAIME RIBEIRO DA LUZ', '1251', 'SANTA MONICA', 'UBERLANDIA', 'MG',
    true, false, false,
    0.00, 0.00, 'active'
);

INSERT INTO clientes (
    codigo_empresa, codigo, nome, tipo_pessoa, cpf, cnpj, apelido,
    telefone, celular1, whatsapp, email,
    cep, endereco, numero, bairro, cidade, uf,
    flag_cliente, flag_fornecedor, flag_funcionario,
    saldo, limite_credito, status
) VALUES (
    '1006', 13, 'KOREIIY', 'FÍSICA', '10940764652', NULL, 'MARCO AURELIO DA SILVA',
    NULL, NULL, '34992798606', 'MARCOIEIAVITOR@GMAIL.COM',
    '38407219', 'RUA BENZEDOR', '0', 'MURUMBI', 'UBERL�NDIA', 'MG',
    true, false, false,
    0.00, 0.00, 'active'
);

INSERT INTO clientes (
    codigo_empresa, codigo, nome, tipo_pessoa, cpf, cnpj, apelido,
    telefone, celular1, whatsapp, email,
    cep, endereco, numero, bairro, cidade, uf,
    flag_cliente, flag_fornecedor, flag_funcionario,
    saldo, limite_credito, status
) VALUES (
    '1006', 14, 'Mn Supermercados Ltda', 'JURÍDICA', NULL, '09442132001462', 'Mn Supermercados Ltda',
    '3432279588', NULL, NULL, NULL,
    '38407132', 'Rua Facao, 93', '0', 'Morumbi', 'Uberlandia', 'MG',
    false, true, false,
    0.00, 0.00, 'active'
);

INSERT INTO clientes (
    codigo_empresa, codigo, nome, tipo_pessoa, cpf, cnpj, apelido,
    telefone, celular1, whatsapp, email,
    cep, endereco, numero, bairro, cidade, uf,
    flag_cliente, flag_fornecedor, flag_funcionario,
    saldo, limite_credito, status
) VALUES (
    '1006', 15, 'BAIANO', 'FÍSICA', '08137215557', NULL, 'ADAILDON',
    NULL, NULL, NULL, NULL,
    '38407384', 'RUA MURICY', '80', 'MURUMBI', 'UBERL�NDIA', 'MG',
    true, false, false,
    0.00, 0.00, 'active'
);

INSERT INTO clientes (
    codigo_empresa, codigo, nome, tipo_pessoa, cpf, cnpj, apelido,
    telefone, celular1, whatsapp, email,
    cep, endereco, numero, bairro, cidade, uf,
    flag_cliente, flag_fornecedor, flag_funcionario,
    saldo, limite_credito, status
) VALUES (
    '1006', 16, 'CDD UBERLANDIA', 'JURÍDICA', NULL, '56228356009864', 'CRBS SA - CDD Uberlandia',
    '08008871111', NULL, NULL, NULL,
    '38414327', 'ROD BR 497 Anel Viario Ayrton Se', 'SN', 'Luizote de Freitas', 'UBERLANDIA', 'MG',
    false, true, false,
    0.00, 0.00, 'active'
);

INSERT INTO clientes (
    codigo_empresa, codigo, nome, tipo_pessoa, cpf, cnpj, apelido,
    telefone, celular1, whatsapp, email,
    cep, endereco, numero, bairro, cidade, uf,
    flag_cliente, flag_fornecedor, flag_funcionario,
    saldo, limite_credito, status
) VALUES (
    '1006', 17, 'AMERICA PAINEIS E AUTOMACOES', 'JURÍDICA', NULL, '51090992000126', '51.090.992 EDIMAR VIEIRA DE CARVALHO',
    NULL, NULL, NULL, 'COMERCIAL@AMERICAPAINEIS.COM.BR',
    '38414346', 'RUA JORGE ZACARIAS', '700', 'JARDIM PATRICIA', 'UBERLANDIA', 'MG',
    false, true, false,
    0.00, 0.00, 'active'
);

INSERT INTO clientes (
    codigo_empresa, codigo, nome, tipo_pessoa, cpf, cnpj, apelido,
    telefone, celular1, whatsapp, email,
    cep, endereco, numero, bairro, cidade, uf,
    flag_cliente, flag_fornecedor, flag_funcionario,
    saldo, limite_credito, status
) VALUES (
    '1006', 18, 'Universo Embalagens e Descartaveis', 'JURÍDICA', NULL, '29312016000111', 'PADUA EMBALAGENS E DESCARTAVEIS LTDA',
    '3432271525', NULL, NULL, NULL,
    '38400706', 'AVENIDA AFONSO PENA', '1187', 'NOSSA SENHORA APARECIDA', 'UBERLANDIA', 'MG',
    false, true, false,
    0.00, 0.00, 'active'
);

INSERT INTO clientes (
    codigo_empresa, codigo, nome, tipo_pessoa, cpf, cnpj, apelido,
    telefone, celular1, whatsapp, email,
    cep, endereco, numero, bairro, cidade, uf,
    flag_cliente, flag_fornecedor, flag_funcionario,
    saldo, limite_credito, status
) VALUES (
    '1006', 19, 'DEPARTAMENTO MUNICIPAL DE AGUA E ESGOTO', 'JURÍDICA', NULL, '25769548000121', 'DEPARTAMENTO MUNICIPAL DE AGUA E ESGOTO',
    NULL, NULL, NULL, NULL,
    '38405142', 'AV RONDON PACHECO', '6400', 'TIBERY', 'UBERLANDIA', 'MG',
    false, true, false,
    0.00, 0.00, 'active'
);

INSERT INTO clientes (
    codigo_empresa, codigo, nome, tipo_pessoa, cpf, cnpj, apelido,
    telefone, celular1, whatsapp, email,
    cep, endereco, numero, bairro, cidade, uf,
    flag_cliente, flag_fornecedor, flag_funcionario,
    saldo, limite_credito, status
) VALUES (
    '1006', 20, 'RECEITA FEDERAL', 'FÍSICA', NULL, NULL, 'RECEITA FEDERAL',
    NULL, NULL, NULL, NULL,
    '38405142', 'AV RONDON PACHECO', '4488', 'TIBERY', 'UBERL�NDIA', 'MG',
    false, true, false,
    0.00, 0.00, 'active'
);

INSERT INTO clientes (
    codigo_empresa, codigo, nome, tipo_pessoa, cpf, cnpj, apelido,
    telefone, celular1, whatsapp, email,
    cep, endereco, numero, bairro, cidade, uf,
    flag_cliente, flag_fornecedor, flag_funcionario,
    saldo, limite_credito, status
) VALUES (
    '1006', 21, 'SIMPLES NACIONAL', 'JURÍDICA', NULL, '00000000000000', 'SIMPLES NACIONAL',
    NULL, NULL, NULL, NULL,
    '38405142', 'AV RONDON PACHECO', '4488', 'TIBERY', 'UBERL�NDIA', 'MG',
    false, true, false,
    0.00, 0.00, 'active'
);

INSERT INTO clientes (
    codigo_empresa, codigo, nome, tipo_pessoa, cpf, cnpj, apelido,
    telefone, celular1, whatsapp, email,
    cep, endereco, numero, bairro, cidade, uf,
    flag_cliente, flag_fornecedor, flag_funcionario,
    saldo, limite_credito, status
) VALUES (
    '1006', 22, 'PREFEITURA DE UBERLANDIA', 'JURÍDICA', NULL, '00000000000000', 'PREFEITURA DE UBERLANDIA',
    NULL, NULL, NULL, NULL,
    '38408900', 'AV ANSELMO ALVES DOS SANTOS', '600', 'SANTA MONICA', 'UBERL�NDIA', 'MG',
    false, true, false,
    0.00, 0.00, 'active'
);

INSERT INTO clientes (
    codigo_empresa, codigo, nome, tipo_pessoa, cpf, cnpj, apelido,
    telefone, celular1, whatsapp, email,
    cep, endereco, numero, bairro, cidade, uf,
    flag_cliente, flag_fornecedor, flag_funcionario,
    saldo, limite_credito, status
) VALUES (
    '1006', 23, 'CEMIG D', 'JURÍDICA', NULL, '06981180000116', 'CEMIG DISTRIBUICAO S.A',
    NULL, NULL, NULL, 'EDIRAMOS@CEMIG.COM.BR',
    '30190924', 'AV BARBACENA', '1200', 'SANTO AGOSTINHO', 'BELO HORIZONTE', 'MG',
    false, true, false,
    0.00, 0.00, 'active'
);

INSERT INTO clientes (
    codigo_empresa, codigo, nome, tipo_pessoa, cpf, cnpj, apelido,
    telefone, celular1, whatsapp, email,
    cep, endereco, numero, bairro, cidade, uf,
    flag_cliente, flag_fornecedor, flag_funcionario,
    saldo, limite_credito, status
) VALUES (
    '1006', 24, 'Supermercados Leal Ltda', 'JURÍDICA', NULL, '25926205000638', 'Supermercados Leal Ltda',
    '3432322999', NULL, NULL, NULL,
    '38407114', 'R. Aristides Fernandes Morais', '495', 'Conj Alvorada', 'Uberlandia', 'MG',
    false, true, false,
    0.00, 0.00, 'active'
);

INSERT INTO clientes (
    codigo_empresa, codigo, nome, tipo_pessoa, cpf, cnpj, apelido,
    telefone, celular1, whatsapp, email,
    cep, endereco, numero, bairro, cidade, uf,
    flag_cliente, flag_fornecedor, flag_funcionario,
    saldo, limite_credito, status
) VALUES (
    '1006', 25, 'SCALIBU SPORTS LTDA', 'JURÍDICA', NULL, '05193464000185', 'SCALIBU SPORTS LTDA',
    '3432266642', NULL, NULL, NULL,
    '38408594', 'RUA GALILEU', '263', 'CARAJAS', 'UBERLANDIA', 'MG',
    false, true, false,
    0.00, 0.00, 'active'
);

INSERT INTO clientes (
    codigo_empresa, codigo, nome, tipo_pessoa, cpf, cnpj, apelido,
    telefone, celular1, whatsapp, email,
    cep, endereco, numero, bairro, cidade, uf,
    flag_cliente, flag_fornecedor, flag_funcionario,
    saldo, limite_credito, status
) VALUES (
    '1006', 26, 'QUADRA DE ESPORTES MORUMBI SANTA EFIGENIA', 'JURÍDICA', NULL, '51844741000190', 'QUADRA DE ESPORTES MORUMBI SANTA EFIGENIA LTDA',
    '3499057602', NULL, NULL, NULL,
    '38407477', 'AV ANTONIO JORGE ISAAC', '446', 'MORUMBI', 'UBERLANDIA', 'MG',
    false, true, false,
    0.00, 0.00, 'active'
);

INSERT INTO clientes (
    codigo_empresa, codigo, nome, tipo_pessoa, cpf, cnpj, apelido,
    telefone, celular1, whatsapp, email,
    cep, endereco, numero, bairro, cidade, uf,
    flag_cliente, flag_fornecedor, flag_funcionario,
    saldo, limite_credito, status
) VALUES (
    '1006', 27, 'EFM LOGISTICA LTDA', 'JURÍDICA', NULL, '06338356000116', 'EFM LOGISTICA LTDA',
    NULL, '349967422116', NULL, 'WRASSOCIADOSJF@GMAIL.COM',
    '36026390', 'R DOM VICOSO', '198', 'ALTO DOS PASSOS', 'JUIZ DE FORA', 'MG',
    true, false, false,
    0.00, 0.00, 'active'
);

INSERT INTO clientes (
    codigo_empresa, codigo, nome, tipo_pessoa, cpf, cnpj, apelido,
    telefone, celular1, whatsapp, email,
    cep, endereco, numero, bairro, cidade, uf,
    flag_cliente, flag_fornecedor, flag_funcionario,
    saldo, limite_credito, status
) VALUES (
    '1006', 28, 'ENCOTRO PIT BUL', 'FÍSICA', '02156537186', NULL, 'EDUARDO VERISSIMO SOARES',
    NULL, NULL, '34998591075', NULL,
    '38405220', 'RUA PATAG�NIA', '114', 'CUST�DIO PEREIRA', 'UBERL�NDIA', 'MG',
    true, false, false,
    0.00, 0.00, 'active'
);

INSERT INTO clientes (
    codigo_empresa, codigo, nome, tipo_pessoa, cpf, cnpj, apelido,
    telefone, celular1, whatsapp, email,
    cep, endereco, numero, bairro, cidade, uf,
    flag_cliente, flag_fornecedor, flag_funcionario,
    saldo, limite_credito, status
) VALUES (
    '1006', 29, 'SERRA DOURADA D.T.B.LTDA', 'JURÍDICA', NULL, '10734930000122', 'SERRA DOURADA D.T.B.LTDA',
    '3432236360', NULL, NULL, NULL,
    '38414348', 'AVENIDA JOSE FONSECA E SILVA', '1268', 'LUIZOTE DE FREITAS', 'UBERLANDIA', 'MG',
    false, true, false,
    0.00, 0.00, 'active'
);

INSERT INTO clientes (
    codigo_empresa, codigo, nome, tipo_pessoa, cpf, cnpj, apelido,
    telefone, celular1, whatsapp, email,
    cep, endereco, numero, bairro, cidade, uf,
    flag_cliente, flag_fornecedor, flag_funcionario,
    saldo, limite_credito, status
) VALUES (
    '1006', 30, 'B�RBARA SOUZA DE MENEZES', 'FÍSICA', '70123629608', NULL, 'B�RBARA SOUZA DE MENEZES',
    '34997655568', '34997655568', '34997655568', NULL,
    '38407396', 'RUA DO PINTASSILGO', '11', 'MURUMBI', 'UBERL�NDIA', 'MG',
    true, false, false,
    0.00, 0.00, 'active'
);

INSERT INTO clientes (
    codigo_empresa, codigo, nome, tipo_pessoa, cpf, cnpj, apelido,
    telefone, celular1, whatsapp, email,
    cep, endereco, numero, bairro, cidade, uf,
    flag_cliente, flag_fornecedor, flag_funcionario,
    saldo, limite_credito, status
) VALUES (
    '1006', 31, 'BALI', 'JURÍDICA', NULL, '38160835000181', 'BALI ATACADO E VAREJO DE SECOS E MOLHADOS LTDA',
    '3432277474', NULL, NULL, NULL,
    '38000000', 'RUA CLEONE CAIRO GOMES', '750', 'SEGISMUNDO PEREIRA', 'UBERLANDIA', 'MG',
    false, true, false,
    0.00, 0.00, 'active'
);

INSERT INTO clientes (
    codigo_empresa, codigo, nome, tipo_pessoa, cpf, cnpj, apelido,
    telefone, celular1, whatsapp, email,
    cep, endereco, numero, bairro, cidade, uf,
    flag_cliente, flag_fornecedor, flag_funcionario,
    saldo, limite_credito, status
) VALUES (
    '1006', 32, 'SEGUNDA FEIRA FIXO', 'FÍSICA', '00608218685', NULL, 'LANCHE A�AI BAIANO',
    '34', NULL, '34999868370', NULL,
    '38407477', 'AVENIDA ANT�NIO JORGE ISAAC', '244', 'MURUMBI', 'UBERL�NDIA', 'MG',
    true, false, false,
    0.00, 0.00, 'active'
);

INSERT INTO clientes (
    codigo_empresa, codigo, nome, tipo_pessoa, cpf, cnpj, apelido,
    telefone, celular1, whatsapp, email,
    cep, endereco, numero, bairro, cidade, uf,
    flag_cliente, flag_fornecedor, flag_funcionario,
    saldo, limite_credito, status
) VALUES (
    '1006', 33, 'SABADO', 'FÍSICA', '10356407675', NULL, 'CARLOS EDUARDO DOS REIS',
    NULL, NULL, '34997418505', NULL,
    '38407526', 'RUA D', '220', 'LOTEAMENTO INTEGRA��O�', 'UBERL�NDIA', 'MG',
    true, false, false,
    0.00, 0.00, 'active'
);

INSERT INTO clientes (
    codigo_empresa, codigo, nome, tipo_pessoa, cpf, cnpj, apelido,
    telefone, celular1, whatsapp, email,
    cep, endereco, numero, bairro, cidade, uf,
    flag_cliente, flag_fornecedor, flag_funcionario,
    saldo, limite_credito, status
) VALUES (
    '1006', 34, 'QUINTA FEIRA', 'FÍSICA', '16170279605', NULL, 'KAYK DOUGLAS',
    NULL, NULL, '34991562795', NULL,
    '38407069', 'RUA MARIA AUGUSTA MORAIS', '10', 'CONJUNTO ALVORADA', 'UBERL�NDIA', 'MG',
    true, false, false,
    0.00, 0.00, 'active'
);

INSERT INTO clientes (
    codigo_empresa, codigo, nome, tipo_pessoa, cpf, cnpj, apelido,
    telefone, celular1, whatsapp, email,
    cep, endereco, numero, bairro, cidade, uf,
    flag_cliente, flag_fornecedor, flag_funcionario,
    saldo, limite_credito, status
) VALUES (
    '1006', 35, 'QUARTA FEIRA FIXO', 'FÍSICA', '18539310635', NULL, 'LUIZ FELIPE DE CAMARGO',
    NULL, NULL, '34991537975', NULL,
    '38407473', 'RUA FERNANDO OLIVEIRA MOTA', '280', 'MORUMBI�', 'UBERL�NDIA', 'MG',
    true, false, false,
    0.00, 0.00, 'active'
);

INSERT INTO clientes (
    codigo_empresa, codigo, nome, tipo_pessoa, cpf, cnpj, apelido,
    telefone, celular1, whatsapp, email,
    cep, endereco, numero, bairro, cidade, uf,
    flag_cliente, flag_fornecedor, flag_funcionario,
    saldo, limite_credito, status
) VALUES (
    '1006', 36, 'QUARTA FEIRA FIX', 'FÍSICA', '08459050661', NULL, 'JHON CARLOS LEMOS MATOS',
    NULL, NULL, '34991259052', NULL,
    '38407132', 'RUA FAC�O', '477', 'MURUMBI', 'UBERL�NDIA', 'MG',
    true, false, false,
    0.00, 0.00, 'active'
);

INSERT INTO clientes (
    codigo_empresa, codigo, nome, tipo_pessoa, cpf, cnpj, apelido,
    telefone, celular1, whatsapp, email,
    cep, endereco, numero, bairro, cidade, uf,
    flag_cliente, flag_fornecedor, flag_funcionario,
    saldo, limite_credito, status
) VALUES (
    '1006', 37, 'QUARTA FEIRA FIXO', 'FÍSICA', '02302606671', NULL, 'FELIPE LIMA CALVALCANTI',
    NULL, NULL, '34991043536', NULL,
    '38407327', 'MARILENE DE FATIMA CARDOSO', '570', 'MURUMBI', 'UBERL�NDIA', 'MG',
    true, false, false,
    0.00, 0.00, 'active'
);

INSERT INTO clientes (
    codigo_empresa, codigo, nome, tipo_pessoa, cpf, cnpj, apelido,
    telefone, celular1, whatsapp, email,
    cep, endereco, numero, bairro, cidade, uf,
    flag_cliente, flag_fornecedor, flag_funcionario,
    saldo, limite_credito, status
) VALUES (
    '1006', 38, 'SEGUNDA FEIRA', 'FÍSICA', '04233480602', NULL, 'ODAIR JOSE BARBOSA  DE SOUZA',
    NULL, NULL, '34996587638', NULL,
    '38407477', 'AVENIDA ANT�NIO JORGE ISAAC', '286', 'MURUMBI', 'UBERL�NDIA', 'MG',
    true, false, false,
    0.00, 0.00, 'active'
);

INSERT INTO clientes (
    codigo_empresa, codigo, nome, tipo_pessoa, cpf, cnpj, apelido,
    telefone, celular1, whatsapp, email,
    cep, endereco, numero, bairro, cidade, uf,
    flag_cliente, flag_fornecedor, flag_funcionario,
    saldo, limite_credito, status
) VALUES (
    '1006', 39, 'BAIANIINHO TER�A FEIRA', 'FÍSICA', '09181246625', NULL, 'WESLEY HENRIQUE ANTUNES DE OLIVEIRA',
    NULL, NULL, '34991055115', NULL,
    '38407318', 'RUA GUAPEVA', '818', 'MURUMBI', 'UBERL�NDIA', 'MG',
    true, false, false,
    0.00, 0.00, 'active'
);

INSERT INTO clientes (
    codigo_empresa, codigo, nome, tipo_pessoa, cpf, cnpj, apelido,
    telefone, celular1, whatsapp, email,
    cep, endereco, numero, bairro, cidade, uf,
    flag_cliente, flag_fornecedor, flag_funcionario,
    saldo, limite_credito, status
) VALUES (
    '1006', 40, 'QUINTA FEIRA', 'FÍSICA', '17248654639', NULL, 'YGOR MAESTRI PEREIRA',
    NULL, NULL, '34992384650', NULL,
    '38407477', 'AVENIDA ANT�NIO JORGE ISAAC', '446', 'MURUMBI', 'UBERL�NDIA', 'MG',
    true, false, false,
    0.00, 0.00, 'active'
);

INSERT INTO clientes (
    codigo_empresa, codigo, nome, tipo_pessoa, cpf, cnpj, apelido,
    telefone, celular1, whatsapp, email,
    cep, endereco, numero, bairro, cidade, uf,
    flag_cliente, flag_fornecedor, flag_funcionario,
    saldo, limite_credito, status
) VALUES (
    '1006', 41, 'SEGUNDA FEIRA 20', 'FÍSICA', '12048393608', NULL, 'MATHEUS SOUSA MENDES',
    NULL, NULL, '34991999507', NULL,
    '38407381', 'AV ANTONIO JORGE', '446', 'MORUMBI', 'UBERL�NDIA', 'MG',
    true, false, false,
    0.00, 0.00, 'active'
);

INSERT INTO clientes (
    codigo_empresa, codigo, nome, tipo_pessoa, cpf, cnpj, apelido,
    telefone, celular1, whatsapp, email,
    cep, endereco, numero, bairro, cidade, uf,
    flag_cliente, flag_fornecedor, flag_funcionario,
    saldo, limite_credito, status
) VALUES (
    '1006', 42, 'JOGO DOMINGO', 'FÍSICA', '08426434606', NULL, 'EDSON MORAIS DOS SANTOS',
    NULL, NULL, '34992513436', NULL,
    '38407162', 'RUA ING�', '03', 'MURUMBI', 'UBERL�NDIA', 'MG',
    true, false, false,
    0.00, 0.00, 'active'
);

INSERT INTO clientes (
    codigo_empresa, codigo, nome, tipo_pessoa, cpf, cnpj, apelido,
    telefone, celular1, whatsapp, email,
    cep, endereco, numero, bairro, cidade, uf,
    flag_cliente, flag_fornecedor, flag_funcionario,
    saldo, limite_credito, status
) VALUES (
    '1006', 43, 'VOLEY DOMINGO', 'FÍSICA', '07935003203', NULL, 'MARCOS MACHADO',
    NULL, NULL, '34997107073', NULL,
    '38407658', 'AVENIDA MANUEL LUCIO', '820', 'GRAND VILLE�', 'UBERL�NDIA', 'MG',
    true, false, false,
    0.00, 0.00, 'active'
);

INSERT INTO clientes (
    codigo_empresa, codigo, nome, tipo_pessoa, cpf, cnpj, apelido,
    telefone, celular1, whatsapp, email,
    cep, endereco, numero, bairro, cidade, uf,
    flag_cliente, flag_fornecedor, flag_funcionario,
    saldo, limite_credito, status
) VALUES (
    '1006', 44, 'SABADO', 'FÍSICA', '70385399650', NULL, 'GABRIEL DARC LUCIANO',
    NULL, NULL, '34991151978', NULL,
    '38407114', 'RUA ARISTIDES FERNANDES MORAIS', '405', 'CONJUNTO ALVORADA', 'UBERL�NDIA', 'MG',
    true, false, false,
    0.00, 0.00, 'active'
);

INSERT INTO clientes (
    codigo_empresa, codigo, nome, tipo_pessoa, cpf, cnpj, apelido,
    telefone, celular1, whatsapp, email,
    cep, endereco, numero, bairro, cidade, uf,
    flag_cliente, flag_fornecedor, flag_funcionario,
    saldo, limite_credito, status
) VALUES (
    '1006', 45, 'SABADO', 'FÍSICA', '07991655652', NULL, 'TIAGO A\LVES DOS REIS',
    '34991393149', '34991393149', '34991393149', NULL,
    '38407324', 'RUA DAS CABANAS', '0', 'MURUMBI', 'UBERL�NDIA', 'MG',
    true, false, false,
    0.00, 0.00, 'active'
);

INSERT INTO clientes (
    codigo_empresa, codigo, nome, tipo_pessoa, cpf, cnpj, apelido,
    telefone, celular1, whatsapp, email,
    cep, endereco, numero, bairro, cidade, uf,
    flag_cliente, flag_fornecedor, flag_funcionario,
    saldo, limite_credito, status
) VALUES (
    '1006', 46, 'SABADO 16:00 H', 'FÍSICA', '04259695177', NULL, 'ADRIANO CARLOS DA SILVA',
    '349998372950', '34998372950', '34998372950', NULL,
    '38407414', 'RUA CARNA�BA', '20', 'MURUMBI', 'UBERL�NDIA', 'MG',
    true, false, false,
    0.00, 0.00, 'active'
);

INSERT INTO clientes (
    codigo_empresa, codigo, nome, tipo_pessoa, cpf, cnpj, apelido,
    telefone, celular1, whatsapp, email,
    cep, endereco, numero, bairro, cidade, uf,
    flag_cliente, flag_fornecedor, flag_funcionario,
    saldo, limite_credito, status
) VALUES (
    '1006', 47, 'SEGUNDA FEIRA 20:00', 'FÍSICA', '71634018176', NULL, 'IAGO BORGES FERREIRA',
    '34991713035', '34991713035', '34991713035', NULL,
    '38407309', 'RUA ALAMBIQUE', '451', 'MORUMBI', 'UBERL�NDIA', 'MG',
    true, false, false,
    0.00, 0.00, 'active'
);

INSERT INTO clientes (
    codigo_empresa, codigo, nome, tipo_pessoa, cpf, cnpj, apelido,
    telefone, celular1, whatsapp, email,
    cep, endereco, numero, bairro, cidade, uf,
    flag_cliente, flag_fornecedor, flag_funcionario,
    saldo, limite_credito, status
) VALUES (
    '1006', 48, 'ALISON BISPO DOS SANTOS', 'FÍSICA', '17285993697', NULL, 'ALISON BISPO DOS SANTOS',
    '34999564896', '34999564896', '34999564896', NULL,
    '38407162', 'RUA INGA', '03', 'MORUMBI', 'UBERL�NDIA', 'MG',
    true, false, false,
    0.00, 0.00, 'active'
);

INSERT INTO clientes (
    codigo_empresa, codigo, nome, tipo_pessoa, cpf, cnpj, apelido,
    telefone, celular1, whatsapp, email,
    cep, endereco, numero, bairro, cidade, uf,
    flag_cliente, flag_fornecedor, flag_funcionario,
    saldo, limite_credito, status
) VALUES (
    '1006', 49, 'FUTEBOL', 'FÍSICA', '61101016302', NULL, 'JESSICA CONCEI�AO DA SILVA',
    '34991221610', '34991221610', '34991221610', NULL,
    '38407507', 'RUA DO POVO', '140', 'LOTEAMENTO INTEGRA��O�', 'UBERL�NDIA', 'MG',
    true, false, false,
    0.00, 0.00, 'active'
);

INSERT INTO clientes (
    codigo_empresa, codigo, nome, tipo_pessoa, cpf, cnpj, apelido,
    telefone, celular1, whatsapp, email,
    cep, endereco, numero, bairro, cidade, uf,
    flag_cliente, flag_fornecedor, flag_funcionario,
    saldo, limite_credito, status
) VALUES (
    '1006', 50, 'QUARTA FEIRA', 'FÍSICA', '02133391614', NULL, 'BRUNA RAFAELA ADORNELES SANTOS',
    '34996985911', '34996985911', '34996985911', NULL,
    '38407162', 'RUA ING�', '612', 'MURUMBI', 'UBERL�NDIA', 'MG',
    true, false, false,
    0.00, 0.00, 'active'
);

-- 3. Reabilita RLS
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- FIM DA IMPORTAÇÃO
-- ============================================================================
