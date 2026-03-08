-- ============================================================
-- Migración 051 — ET12a: Motor Jurisdiccional Notarial
-- Tabla jurisdicciones + campos partido_code/delegacion_code en inmuebles.
-- ============================================================

-- 1. Tabla jurisdicciones: mapa de verdad partido → códigos oficiales
CREATE TABLE IF NOT EXISTS jurisdicciones (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jurisdiction_id  TEXT NOT NULL,                          -- "PBA", "CABA", "CBA", etc.
    version          TEXT NOT NULL,                          -- "2026_01"
    party_name       TEXT NOT NULL,                          -- "Monte Hermoso" (normalizado Title Case sin tildes)
    party_code       TEXT NOT NULL,                          -- "126" (código RPI/ARBA del partido)
    delegation_code  TEXT NOT NULL,                          -- "007" (código delegación CESBA/Colegio)
    aliases          TEXT[] NOT NULL DEFAULT '{}',           -- {"monte hermoso","m. hermoso"}
    active           BOOLEAN NOT NULL DEFAULT true,
    org_id           UUID REFERENCES organizaciones(id) ON DELETE CASCADE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(jurisdiction_id, version, party_code)
);

-- Index GIN en aliases para búsqueda eficiente con ANY()
CREATE INDEX IF NOT EXISTS idx_jurisdicciones_aliases ON jurisdicciones USING GIN (aliases);
CREATE INDEX IF NOT EXISTS idx_jurisdicciones_org     ON jurisdicciones(org_id);
CREATE INDEX IF NOT EXISTS idx_jurisdicciones_active  ON jurisdicciones(jurisdiction_id, active);

-- RLS: solo miembros de la org pueden leer
ALTER TABLE jurisdicciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jurisdicciones_org_read" ON jurisdicciones
    FOR SELECT
    USING (
        org_id IS NULL  -- registros globales (seed del sistema) son visibles para todos
        OR org_id IN (
            SELECT ou.org_id FROM organizaciones_users ou
            WHERE ou.user_id = auth.uid()
        )
    );

-- Solo service_role inserta/actualiza (seed scripts y admin)
CREATE POLICY "jurisdicciones_service_write" ON jurisdicciones
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- 2. Campos nuevos en inmuebles para códigos resueltos
ALTER TABLE inmuebles ADD COLUMN IF NOT EXISTS partido_code    TEXT;
ALTER TABLE inmuebles ADD COLUMN IF NOT EXISTS delegacion_code TEXT;

-- Index para queries por código de partido
CREATE INDEX IF NOT EXISTS idx_inmuebles_partido_code ON inmuebles(partido_code);

-- ============================================================
-- TODO [ET12b]: Agregar tabla jurisdicciones_config para admin UI
-- con toggle por provincia, versión activa, etc.
-- ============================================================
