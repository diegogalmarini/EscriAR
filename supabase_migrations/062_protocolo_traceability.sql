-- Migration 062: Protocolo Traceability
-- Links escrituras ↔ protocolo_registros bidirectionally
-- Makes sugerencias work without carpeta (for protocolo-sourced suggestions)

-- 1. Vincular escrituras con protocolo_registros (bidireccional)
ALTER TABLE escrituras ADD COLUMN IF NOT EXISTS protocolo_registro_id uuid REFERENCES protocolo_registros(id);
CREATE INDEX IF NOT EXISTS idx_escrituras_protocolo_registro ON escrituras(protocolo_registro_id) WHERE protocolo_registro_id IS NOT NULL;

ALTER TABLE protocolo_registros ADD COLUMN IF NOT EXISTS escritura_id uuid REFERENCES escrituras(id);
CREATE INDEX IF NOT EXISTS idx_protocolo_registros_escritura ON protocolo_registros(escritura_id) WHERE escritura_id IS NOT NULL;

-- 2. Hacer carpeta_id nullable en sugerencias (protocolo no tiene carpeta)
ALTER TABLE sugerencias ALTER COLUMN carpeta_id DROP NOT NULL;

-- 3. Agregar referencia a protocolo_registro en sugerencias
ALTER TABLE sugerencias ADD COLUMN IF NOT EXISTS protocolo_registro_id uuid REFERENCES protocolo_registros(id);
CREATE INDEX IF NOT EXISTS idx_sugerencias_protocolo_registro ON sugerencias(protocolo_registro_id) WHERE protocolo_registro_id IS NOT NULL;
