-- ============================================================
-- MIGRACIÓN 043: ETAPA 6 — Tabla actuaciones
-- ============================================================
-- Crea la tabla `actuaciones` para soportar múltiples documentos
-- por carpeta, separados en Actos Privados y Actos Protocolares.
-- Cada actuación tiene su propio ciclo de generación (DRAFT → LISTO).
-- ============================================================

-- ══════════════════════════════════════════════════════════
-- PRECHECKS
-- ══════════════════════════════════════════════════════════
-- 1) Verificar que la tabla actuaciones NO existe
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name = 'actuaciones';
-- Esperado: 0 filas
--
-- 2) Verificar que las tablas referenciadas existen
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name IN ('organizaciones', 'carpetas', 'operaciones', 'modelos_actos');
-- Esperado: 4 filas
-- ══════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════
-- APPLY
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS actuaciones (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              UUID NOT NULL REFERENCES organizaciones(id),
    carpeta_id          UUID NOT NULL REFERENCES carpetas(id) ON DELETE CASCADE,
    operacion_id        UUID REFERENCES operaciones(id) ON DELETE SET NULL,

    -- Clasificación
    categoria           VARCHAR(20) NOT NULL CHECK (categoria IN ('PRIVADO', 'PROTOCOLAR')),
    act_type            VARCHAR(80) NOT NULL,
    modelo_id           UUID REFERENCES modelos_actos(id) ON DELETE SET NULL,

    -- Estado de generación
    status              VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
                        CHECK (status IN ('DRAFT', 'GENERANDO', 'LISTO', 'ERROR')),

    -- Archivos de salida
    docx_path           VARCHAR(500),
    pdf_path            VARCHAR(500),
    html_preview        TEXT,
    content_text        TEXT,

    -- Metadata y auditoría de generación
    metadata            JSONB DEFAULT '{}',
    generation_context  JSONB,

    -- Auditoría
    created_by          UUID REFERENCES auth.users(id),
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_actuaciones_carpeta_cat ON actuaciones (carpeta_id, categoria);
CREATE INDEX idx_actuaciones_org ON actuaciones (org_id);
CREATE INDEX idx_actuaciones_status ON actuaciones (status) WHERE status IN ('GENERANDO', 'ERROR');

-- Trigger auto-update updated_at
CREATE OR REPLACE FUNCTION update_actuaciones_modtime()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_actuaciones_updated_at
    BEFORE UPDATE ON actuaciones
    FOR EACH ROW EXECUTE FUNCTION update_actuaciones_modtime();

-- ══════════════════════════════════════════════════════════
-- RLS (Row Level Security)
-- ══════════════════════════════════════════════════════════
ALTER TABLE actuaciones ENABLE ROW LEVEL SECURITY;

-- SELECT: usuarios ven actuaciones de su organización
CREATE POLICY "Usuarios ven actuaciones de su org"
    ON actuaciones FOR SELECT TO authenticated
    USING (user_has_org_access(org_id));

-- INSERT: usuarios crean actuaciones en su organización
CREATE POLICY "Usuarios crean actuaciones en su org"
    ON actuaciones FOR INSERT TO authenticated
    WITH CHECK (user_has_org_access(org_id));

-- UPDATE: usuarios editan actuaciones de su organización
CREATE POLICY "Usuarios editan actuaciones de su org"
    ON actuaciones FOR UPDATE TO authenticated
    USING (user_has_org_access(org_id));

-- DELETE: usuarios borran actuaciones de su organización
CREATE POLICY "Usuarios borran actuaciones de su org"
    ON actuaciones FOR DELETE TO authenticated
    USING (user_has_org_access(org_id));

-- Service role bypass (para server actions con supabaseAdmin)
CREATE POLICY "Service role full access actuaciones"
    ON actuaciones FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- ══════════════════════════════════════════════════════════
-- POSTCHECKS
-- ══════════════════════════════════════════════════════════
-- 1) Verificar que la tabla fue creada
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name = 'actuaciones';
-- Esperado: 1 fila
--
-- 2) Verificar columnas principales
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'actuaciones'
-- ORDER BY ordinal_position;
-- Esperado: 18 columnas
--
-- 3) Verificar RLS activado
-- SELECT relrowsecurity FROM pg_class WHERE relname = 'actuaciones';
-- Esperado: true
--
-- 4) Verificar índices
-- SELECT indexname FROM pg_indexes WHERE tablename = 'actuaciones';
-- Esperado: actuaciones_pkey, idx_actuaciones_carpeta_cat, idx_actuaciones_org, idx_actuaciones_status
-- ══════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════
-- ROLLBACK (ejecutar solo si se necesita revertir)
-- ══════════════════════════════════════════════════════════
-- DROP TRIGGER IF EXISTS trg_actuaciones_updated_at ON actuaciones;
-- DROP FUNCTION IF EXISTS update_actuaciones_modtime();
-- DROP TABLE IF EXISTS actuaciones CASCADE;
