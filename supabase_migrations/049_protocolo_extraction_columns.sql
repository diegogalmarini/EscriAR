-- Fase 5: Agregar columnas de extracción IA a protocolo_registros
-- Mismo patrón que certificados (047_etapa_7__cert_extraction.sql)
-- Migration 049

-- 1. Estado de la extracción IA
ALTER TABLE protocolo_registros
ADD COLUMN IF NOT EXISTS extraction_status TEXT;  -- PENDIENTE | PROCESANDO | COMPLETADO | ERROR

-- 2. Datos extraídos por Gemini
ALTER TABLE protocolo_registros
ADD COLUMN IF NOT EXISTS extraction_data JSONB;

-- 3. Evidencia por campo (fragmentos + confianza)
ALTER TABLE protocolo_registros
ADD COLUMN IF NOT EXISTS extraction_evidence JSONB;

-- 4. Error de extracción
ALTER TABLE protocolo_registros
ADD COLUMN IF NOT EXISTS extraction_error TEXT;

-- 5. Confirmación humana (human-in-the-loop)
ALTER TABLE protocolo_registros
ADD COLUMN IF NOT EXISTS confirmed_by UUID;

ALTER TABLE protocolo_registros
ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

-- 6. Índice para polling de extracciones en progreso
CREATE INDEX IF NOT EXISTS idx_protocolo_extraction_status
  ON protocolo_registros(extraction_status)
  WHERE extraction_status IN ('PENDIENTE', 'PROCESANDO');
