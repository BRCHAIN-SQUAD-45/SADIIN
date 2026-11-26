-- ============================================================
-- SCHEMA DO BANCO DE DADOS SADIIN
-- Sistema de Acompanhamento de Dados de Informação em Saúde
-- ============================================================

-- ============================================================
-- 1. TABELA: UF (Unidades Federativas)
-- ============================================================
CREATE TABLE uf (
    id_uf SERIAL PRIMARY KEY,
    sigla VARCHAR(2) NOT NULL UNIQUE,
    nome VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE uf IS 'Unidades Federativas do Brasil';
COMMENT ON COLUMN uf.sigla IS 'Sigla de 2 caracteres (ex: SP, RJ, DF)';

-- ============================================================
-- 2. TABELA: Tipo de Unidade
-- ============================================================
CREATE TABLE tipo_unidade (
    id_tipo_unidade SERIAL PRIMARY KEY,
    descricao VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE tipo_unidade IS 'Tipos de estabelecimentos de saúde (UBS, UPA, Hospital, etc)';

-- ============================================================
-- 3. TABELA: Medicamento
-- ============================================================
CREATE TABLE medicamento (
    id_medicamento SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    categoria VARCHAR(100),
    indicacao TEXT,
    requer_receita BOOLEAN DEFAULT FALSE,
    imagem_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE medicamento IS 'Catálogo de medicamentos disponíveis';
COMMENT ON COLUMN medicamento.requer_receita IS 'Indica se o medicamento exige prescrição médica';

-- ============================================================
-- 4. TABELA: Doença/Sintoma
-- ============================================================
CREATE TABLE doenca (
    id_doenca SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    cid10 VARCHAR(10) UNIQUE,
    categoria VARCHAR(100),
    sintomas_principais TEXT,
    prevencao_tratamento TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE doenca IS 'Catálogo de doenças e sintomas com classificação CID-10';
COMMENT ON COLUMN doenca.cid10 IS 'Código da Classificação Internacional de Doenças (CID-10)';

-- ============================================================
-- 5. TABELA: Município
-- ============================================================
CREATE TABLE municipio (
    id_municipio SERIAL PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    id_uf INTEGER NOT NULL,
    codigo_ibge VARCHAR(7),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_municipio_uf FOREIGN KEY (id_uf) 
        REFERENCES uf(id_uf) 
        ON DELETE RESTRICT 
        ON UPDATE CASCADE
);

COMMENT ON TABLE municipio IS 'Municípios brasileiros vinculados a uma UF';
COMMENT ON COLUMN municipio.codigo_ibge IS 'Código IBGE de 7 dígitos do município';

CREATE INDEX idx_municipio_id_uf ON municipio(id_uf);
CREATE INDEX idx_municipio_codigo_ibge ON municipio(codigo_ibge);

-- ============================================================
-- 6. TABELA: Estabelecimento (Unidade de Saúde)
-- ============================================================
CREATE TABLE estabelecimento (
    id_estabelecimento SERIAL PRIMARY KEY,
    cnes VARCHAR(20) NOT NULL UNIQUE,
    razao_social VARCHAR(255),
    nome_fantasia VARCHAR(255),
    tipo_gestao VARCHAR(100),
    id_tipo_unidade INTEGER,
    cep VARCHAR(10),
    endereco VARCHAR(255),
    numero VARCHAR(50),
    bairro VARCHAR(100),
    id_municipio INTEGER,
    id_uf INTEGER,
    latitude NUMERIC(9, 6),
    longitude NUMERIC(9, 6),
    telefone VARCHAR(50),
    turno_atendimento VARCHAR(100),
    status_funcionamento VARCHAR(50) DEFAULT 'ATIVO',
    lotacao_status VARCHAR(50),
    tempo_medio_espera INTEGER, -- em minutos
    total_profissionais INTEGER DEFAULT 0,
    total_consultorios INTEGER DEFAULT 0,
    total_equipes_esf INTEGER DEFAULT 0,
    data_atualizacao DATE,
    fonte_dados VARCHAR(50) DEFAULT 'DATASUS_CNES',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_estabelecimento_tipo_unidade FOREIGN KEY (id_tipo_unidade) 
        REFERENCES tipo_unidade(id_tipo_unidade) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
    
    CONSTRAINT fk_estabelecimento_municipio FOREIGN KEY (id_municipio) 
        REFERENCES municipio(id_municipio) 
        ON DELETE RESTRICT 
        ON UPDATE CASCADE,
    
    CONSTRAINT fk_estabelecimento_uf FOREIGN KEY (id_uf) 
        REFERENCES uf(id_uf) 
        ON DELETE RESTRICT 
        ON UPDATE CASCADE,
    
    CONSTRAINT chk_status_funcionamento CHECK (status_funcionamento IN ('ATIVO', 'INATIVO', 'DESABILITADO')),
    CONSTRAINT chk_latitude CHECK (latitude BETWEEN -90 AND 90),
    CONSTRAINT chk_longitude CHECK (longitude BETWEEN -180 AND 180)
);

COMMENT ON TABLE estabelecimento IS 'Estabelecimentos de saúde (CNES) com métricas operacionais';
COMMENT ON COLUMN estabelecimento.cnes IS 'Cadastro Nacional de Estabelecimentos de Saúde';
COMMENT ON COLUMN estabelecimento.lotacao_status IS 'Status de lotação (ex: VAZIO, MODERADO, LOTADO)';
COMMENT ON COLUMN estabelecimento.tempo_medio_espera IS 'Tempo médio de espera em minutos';
COMMENT ON COLUMN estabelecimento.total_equipes_esf IS 'Total de Equipes de Saúde da Família';

-- Índices para performance
CREATE INDEX idx_estabelecimento_cnes ON estabelecimento(cnes);
CREATE INDEX idx_estabelecimento_id_municipio ON estabelecimento(id_municipio);
CREATE INDEX idx_estabelecimento_id_uf ON estabelecimento(id_uf);
CREATE INDEX idx_estabelecimento_id_tipo_unidade ON estabelecimento(id_tipo_unidade);
CREATE INDEX idx_estabelecimento_status ON estabelecimento(status_funcionamento);
CREATE INDEX idx_estabelecimento_localizacao ON estabelecimento(latitude, longitude);

-- ============================================================
-- 7. TABELA: Serviço UBS
-- ============================================================
CREATE TABLE servico_ubs (
    id_servico SERIAL PRIMARY KEY,
    id_estabelecimento INTEGER NOT NULL,
    categoria_servico VARCHAR(100),
    nome_servico VARCHAR(255) NOT NULL,
    disponivel BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_servico_estabelecimento FOREIGN KEY (id_estabelecimento) 
        REFERENCES estabelecimento(id_estabelecimento) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE
);

COMMENT ON TABLE servico_ubs IS 'Serviços oferecidos pelos estabelecimentos de saúde';

CREATE INDEX idx_servico_ubs_id_estabelecimento ON servico_ubs(id_estabelecimento);
CREATE INDEX idx_servico_ubs_categoria ON servico_ubs(categoria_servico);

-- ============================================================
-- TABELAS DE RELACIONAMENTO (N:N) - Opcionais mas recomendadas
-- ============================================================

-- Estabelecimento x Medicamento (quais medicamentos cada unidade possui)
CREATE TABLE estabelecimento_medicamento (
    id_estabelecimento INTEGER NOT NULL,
    id_medicamento INTEGER NOT NULL,
    quantidade_estoque INTEGER DEFAULT 0,
    ultima_atualizacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (id_estabelecimento, id_medicamento),
    
    CONSTRAINT fk_est_med_estabelecimento FOREIGN KEY (id_estabelecimento) 
        REFERENCES estabelecimento(id_estabelecimento) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_est_med_medicamento FOREIGN KEY (id_medicamento) 
        REFERENCES medicamento(id_medicamento) 
        ON DELETE CASCADE
);

-- Estabelecimento x Doença (quais doenças cada unidade atende)
CREATE TABLE estabelecimento_doenca (
    id_estabelecimento INTEGER NOT NULL,
    id_doenca INTEGER NOT NULL,
    especialidade VARCHAR(100),
    
    PRIMARY KEY (id_estabelecimento, id_doenca),
    
    CONSTRAINT fk_est_doenca_estabelecimento FOREIGN KEY (id_estabelecimento) 
        REFERENCES estabelecimento(id_estabelecimento) 
        ON DELETE CASCADE,
    
    CONSTRAINT fk_est_doenca_doenca FOREIGN KEY (id_doenca) 
        REFERENCES doenca(id_doenca) 
        ON DELETE CASCADE
);

-- ============================================================
-- TRIGGER PARA ATUALIZAR updated_at AUTOMATICAMENTE
-- ============================================================
CREATE OR REPLACE FUNCTION atualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplica o trigger em todas as tabelas principais
CREATE TRIGGER trigger_uf_updated_at BEFORE UPDATE ON uf
    FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();

CREATE TRIGGER trigger_municipio_updated_at BEFORE UPDATE ON municipio
    FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();

CREATE TRIGGER trigger_tipo_unidade_updated_at BEFORE UPDATE ON tipo_unidade
    FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();

CREATE TRIGGER trigger_estabelecimento_updated_at BEFORE UPDATE ON estabelecimento
    FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();

CREATE TRIGGER trigger_medicamento_updated_at BEFORE UPDATE ON medicamento
    FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();

CREATE TRIGGER trigger_doenca_updated_at BEFORE UPDATE ON doenca
    FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();

CREATE TRIGGER trigger_servico_ubs_updated_at BEFORE UPDATE ON servico_ubs
    FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();
