-- Coordenadas persistidas por estabelecimento CNES para o mapa interativo.
CREATE TABLE IF NOT EXISTS ubs_geolocalizacao (
    cnes VARCHAR(20) PRIMARY KEY,
    city_ibge VARCHAR(7) NOT NULL,
    latitude NUMERIC(9, 6),
    longitude NUMERIC(9, 6),
    fonte VARCHAR(80) NOT NULL DEFAULT 'CNES - Ministério da Saúde',
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_ubs_geo_latitude
        CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
    CONSTRAINT chk_ubs_geo_longitude
        CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180)
);

CREATE INDEX IF NOT EXISTS idx_ubs_geolocalizacao_city
    ON ubs_geolocalizacao (city_ibge);
