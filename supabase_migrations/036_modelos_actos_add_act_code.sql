-- ============================================================
-- 036: Agregar campo act_code a modelos_actos
-- ============================================================
-- El Template Builder ahora incluye el código CESBA 2026 (e.g. "100-00")
-- en el metadata.json. Lo extraemos y guardamos como columna indexada
-- para consultas rápidas y visualización en la UI.
-- ============================================================

ALTER TABLE modelos_actos
  ADD COLUMN IF NOT EXISTS act_code VARCHAR(10);

COMMENT ON COLUMN modelos_actos.act_code IS 'Código CESBA 2026 del acto, e.g. "100-00" (compraventa), "200-30" (donación). Extraído del metadata.json del Template Builder.';

-- Índice para búsquedas por código
CREATE INDEX IF NOT EXISTS idx_modelos_actos_act_code ON modelos_actos (act_code);
