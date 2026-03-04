-- ============================================================
-- MIGRACIÓN 042: ETAPA 5 — Audit columns en sugerencias
-- ============================================================
-- Agrega columnas de auditoría para el motor determinístico:
-- applied_at, applied_by, apply_error, applied_changes
-- ============================================================

-- ══════════════════════════════════════════════════════════
-- PRECHECKS
-- ══════════════════════════════════════════════════════════
-- 1) Verificar que la tabla sugerencias existe
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name = 'sugerencias';
-- Esperado: 1 fila
--
-- 2) Verificar que las columnas NO existen aún
-- SELECT column_name FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'sugerencias'
--   AND column_name IN ('applied_at', 'applied_by', 'apply_error', 'applied_changes');
-- Esperado: 0 filas
-- ══════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════
-- APPLY
-- ══════════════════════════════════════════════════════════

-- Timestamp de cuándo se ejecutó la acción real
ALTER TABLE sugerencias ADD COLUMN applied_at timestamptz;

-- Usuario que ejecutó la acción (puede diferir de decided_by en el futuro)
ALTER TABLE sugerencias ADD COLUMN applied_by uuid REFERENCES auth.users(id);

-- Error si la aplicación falló (NULL = éxito o no aplicada aún)
ALTER TABLE sugerencias ADD COLUMN apply_error text;

-- JSON con los cambios reales realizados (audit trail)
ALTER TABLE sugerencias ADD COLUMN applied_changes jsonb;

-- ══════════════════════════════════════════════════════════
-- POSTCHECKS
-- ══════════════════════════════════════════════════════════
-- 1) Verificar columnas agregadas
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'sugerencias'
--   AND column_name IN ('applied_at', 'applied_by', 'apply_error', 'applied_changes');
-- Esperado: 4 filas (applied_at/timestamptz, applied_by/uuid, apply_error/text, applied_changes/jsonb)
--
-- 2) Verificar que sugerencias existentes tienen NULL en las nuevas columnas
-- SELECT count(*) FROM sugerencias WHERE applied_at IS NOT NULL;
-- Esperado: 0
-- ══════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════
-- ROLLBACK (ejecutar solo si se necesita revertir)
-- ══════════════════════════════════════════════════════════
-- ALTER TABLE sugerencias DROP COLUMN IF EXISTS applied_changes;
-- ALTER TABLE sugerencias DROP COLUMN IF EXISTS apply_error;
-- ALTER TABLE sugerencias DROP COLUMN IF EXISTS applied_by;
-- ALTER TABLE sugerencias DROP COLUMN IF EXISTS applied_at;
