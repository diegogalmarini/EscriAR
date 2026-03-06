-- Fase 2.2: Agregar columnas pdf_storage_path y carpeta_id + Flexibilizar errose
-- Migration 048

-- 1. Agregar columna para path del PDF en Storage
ALTER TABLE protocolo_registros
ADD COLUMN IF NOT EXISTS pdf_storage_path TEXT;

-- 2. Agregar columna para vincular con carpeta (futura Fase 3)
ALTER TABLE protocolo_registros
ADD COLUMN IF NOT EXISTS carpeta_id UUID REFERENCES carpetas(id) ON DELETE SET NULL;

-- 3. Flexibilizar nro_escritura para errose (no tienen número real)
-- Eliminar constraint NOT NULL del nro_escritura
ALTER TABLE protocolo_registros ALTER COLUMN nro_escritura DROP NOT NULL;

-- 4. Eliminar la vieja UNIQUE constraint y reemplazarla con una parcial
-- (solo escrituras con número participan del UNIQUE)
ALTER TABLE protocolo_registros DROP CONSTRAINT IF EXISTS uq_protocolo_nro_anio;
CREATE UNIQUE INDEX IF NOT EXISTS uq_protocolo_nro_anio
  ON protocolo_registros(nro_escritura, anio)
  WHERE nro_escritura IS NOT NULL;

-- 5. Índice para buscar por PDF
CREATE INDEX IF NOT EXISTS idx_protocolo_pdf ON protocolo_registros(pdf_storage_path)
  WHERE pdf_storage_path IS NOT NULL;

-- 6. Índice para buscar por carpeta
CREATE INDEX IF NOT EXISTS idx_protocolo_carpeta ON protocolo_registros(carpeta_id)
  WHERE carpeta_id IS NOT NULL;
