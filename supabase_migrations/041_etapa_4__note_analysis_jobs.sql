-- ============================================================
-- MIGRACIÓN 041: ETAPA 4 — NOTE_ANALYSIS Jobs
-- ============================================================
-- Extiende ingestion_jobs para soportar job_type NOTE_ANALYSIS.
-- Agrega columnas job_type, payload, entity_ref.
-- Nuevos índices para queries por job_type.
-- ============================================================

-- ══════════════════════════════════════════════════════════
-- PRECHECKS
-- ══════════════════════════════════════════════════════════
-- Ejecutar antes para validar pre-condiciones:
--
-- 1) Verificar que ingestion_jobs existe
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name = 'ingestion_jobs';
-- Esperado: 1 fila
--
-- 2) Verificar que las columnas nuevas NO existen aún
-- SELECT column_name FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'ingestion_jobs'
--   AND column_name IN ('job_type', 'payload', 'entity_ref');
-- Esperado: 0 filas
--
-- 3) Verificar que apuntes y sugerencias existen (migración 040)
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name IN ('apuntes', 'sugerencias');
-- Esperado: 2 filas
-- ══════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════
-- APPLY
-- ══════════════════════════════════════════════════════════

-- ── 1. Agregar columna job_type con default 'INGEST' ──
ALTER TABLE ingestion_jobs
    ADD COLUMN job_type text NOT NULL DEFAULT 'INGEST';

-- ── 2. Agregar columna payload (datos del job) ──
ALTER TABLE ingestion_jobs
    ADD COLUMN payload jsonb;

-- ── 3. Agregar columna entity_ref (referencia a entidad origen) ──
ALTER TABLE ingestion_jobs
    ADD COLUMN entity_ref jsonb;

-- ── 4. Relajar NOT NULL en file_path y original_filename ──
-- NOTE_ANALYSIS jobs no tienen archivo, solo texto del apunte
ALTER TABLE ingestion_jobs
    ALTER COLUMN file_path DROP NOT NULL;

ALTER TABLE ingestion_jobs
    ALTER COLUMN original_filename DROP NOT NULL;

-- ── 5. Agregar org_id a ingestion_jobs (para RLS directo) ──
-- Actualmente RLS usa carpeta_id → carpetas → org, pero NOTE_ANALYSIS
-- necesita org_id directo para consistencia con apuntes/sugerencias
ALTER TABLE ingestion_jobs
    ADD COLUMN org_id uuid REFERENCES organizaciones(id);

-- ── 6. Índices nuevos ──
CREATE INDEX idx_ingestion_jobs_type_status
    ON ingestion_jobs(job_type, status);

CREATE INDEX idx_ingestion_jobs_carpeta_type
    ON ingestion_jobs(carpeta_id, job_type);

CREATE INDEX idx_ingestion_jobs_entity_ref
    ON ingestion_jobs USING gin(entity_ref);

-- ══════════════════════════════════════════════════════════
-- POSTCHECKS
-- ══════════════════════════════════════════════════════════
-- Ejecutar después de aplicar:
--
-- 1) Verificar columnas nuevas
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'ingestion_jobs'
--   AND column_name IN ('job_type', 'payload', 'entity_ref', 'org_id');
-- Esperado: 4 filas
--
-- 2) Verificar que jobs existentes tienen job_type = 'INGEST'
-- SELECT DISTINCT job_type FROM ingestion_jobs;
-- Esperado: solo 'INGEST'
--
-- 3) Verificar índices nuevos
-- SELECT indexname FROM pg_indexes
-- WHERE schemaname = 'public' AND tablename = 'ingestion_jobs'
--   AND indexname LIKE 'idx_ingestion_jobs_%';
-- Esperado: incluye idx_ingestion_jobs_type_status, idx_ingestion_jobs_carpeta_type,
--           idx_ingestion_jobs_entity_ref
--
-- 4) Test funcional: insertar job NOTE_ANALYSIS de prueba
-- INSERT INTO ingestion_jobs (
--     user_id, carpeta_id, org_id, job_type, status,
--     entity_ref, payload
-- ) VALUES (
--     (SELECT id FROM auth.users LIMIT 1),
--     (SELECT id FROM carpetas LIMIT 1),
--     'a0000000-0000-0000-0000-000000000001',
--     'NOTE_ANALYSIS',
--     'pending',
--     '{"apunte_id": "test-uuid"}'::jsonb,
--     '{"version": 1}'::jsonb
-- ) RETURNING id, job_type, status;
-- DELETE FROM ingestion_jobs WHERE job_type = 'NOTE_ANALYSIS' AND entity_ref->>'apunte_id' = 'test-uuid';
-- ══════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════
-- ROLLBACK (ejecutar solo si se necesita revertir)
-- ══════════════════════════════════════════════════════════
-- DROP INDEX IF EXISTS idx_ingestion_jobs_entity_ref;
-- DROP INDEX IF EXISTS idx_ingestion_jobs_carpeta_type;
-- DROP INDEX IF EXISTS idx_ingestion_jobs_type_status;
-- ALTER TABLE ingestion_jobs DROP COLUMN IF EXISTS org_id;
-- ALTER TABLE ingestion_jobs DROP COLUMN IF EXISTS entity_ref;
-- ALTER TABLE ingestion_jobs DROP COLUMN IF EXISTS payload;
-- ALTER TABLE ingestion_jobs DROP COLUMN IF EXISTS job_type;
-- ALTER TABLE ingestion_jobs ALTER COLUMN file_path SET NOT NULL;
-- ALTER TABLE ingestion_jobs ALTER COLUMN original_filename SET NOT NULL;
