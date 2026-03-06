-- 047_etapa_7__cert_extraction.sql
-- ET7: Pre-escriturario AI — Extracción de certificados con IA + confirmación humana
--
-- Extiende la tabla `certificados` con:
--   - storage_path: ruta en Supabase Storage (reemplaza pdf_url manual)
--   - extraction_status: estado del proceso de extracción IA
--   - extraction_data: datos extraídos por IA (jsonb)
--   - extraction_evidence: evidencia/fragmentos del PDF fuente (jsonb)
--   - extraction_error: mensaje de error si falla
--   - confirmed_by / confirmed_at: confirmación humana

-- 1. Nuevas columnas en certificados
ALTER TABLE certificados
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS extraction_status TEXT DEFAULT NULL
    CHECK (extraction_status IS NULL OR extraction_status IN ('PENDIENTE', 'PROCESANDO', 'COMPLETADO', 'ERROR')),
  ADD COLUMN IF NOT EXISTS extraction_data JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS extraction_evidence JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS extraction_error TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES auth.users(id) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Índice para buscar certificados pendientes de extracción
CREATE INDEX IF NOT EXISTS idx_certificados_extraction_status
  ON certificados(extraction_status)
  WHERE extraction_status IS NOT NULL;

-- 3. Storage bucket para certificados (si no existe)
-- Nota: esto se ejecuta desde Supabase Dashboard o via API.
-- INSERT INTO storage.buckets (id, name, public) VALUES ('certificados', 'certificados', false)
-- ON CONFLICT (id) DO NOTHING;

-- 4. Comentario de migración
COMMENT ON COLUMN certificados.storage_path IS 'Ruta en Supabase Storage (bucket certificados). Reemplaza pdf_url para uploads.';
COMMENT ON COLUMN certificados.extraction_status IS 'Estado del job de extracción IA: PENDIENTE→PROCESANDO→COMPLETADO|ERROR';
COMMENT ON COLUMN certificados.extraction_data IS 'Datos extraídos por IA: {titular, inscripcion, gravamenes, fecha_vencimiento, ...}';
COMMENT ON COLUMN certificados.extraction_evidence IS 'Fragmentos/citas del PDF que sustentan la extracción';
COMMENT ON COLUMN certificados.extraction_error IS 'Mensaje de error si la extracción falla';
COMMENT ON COLUMN certificados.confirmed_by IS 'UUID del usuario que confirmó la extracción';
COMMENT ON COLUMN certificados.confirmed_at IS 'Timestamp de confirmación humana';
