-- Cache persistente das unidades CNES por município IBGE.
-- A aplicação também cria esta tabela automaticamente na primeira consulta.
CREATE TABLE IF NOT EXISTS ubs_cache_municipio (
    city_ibge VARCHAR(7) PRIMARY KEY,
    city_data JSONB NOT NULL,
    units_data JSONB NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ubs_cache_municipio_expires
    ON ubs_cache_municipio (expires_at);
