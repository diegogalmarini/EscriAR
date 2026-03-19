-- Migration 066: Fix foreign keys blocking protocolo_registros deletion
--
-- The FKs from migration 062 have no ON DELETE action (defaults to RESTRICT),
-- so deleting a protocolo_registro fails if escrituras or sugerencias reference it.
-- Fix: SET NULL on delete — the child records survive but lose their link.

-- 1. escrituras.protocolo_registro_id → SET NULL on delete
ALTER TABLE escrituras DROP CONSTRAINT IF EXISTS escrituras_protocolo_registro_id_fkey;
ALTER TABLE escrituras ADD CONSTRAINT escrituras_protocolo_registro_id_fkey
  FOREIGN KEY (protocolo_registro_id) REFERENCES protocolo_registros(id) ON DELETE SET NULL;

-- 2. sugerencias.protocolo_registro_id → SET NULL on delete
ALTER TABLE sugerencias DROP CONSTRAINT IF EXISTS sugerencias_protocolo_registro_id_fkey;
ALTER TABLE sugerencias ADD CONSTRAINT sugerencias_protocolo_registro_id_fkey
  FOREIGN KEY (protocolo_registro_id) REFERENCES protocolo_registros(id) ON DELETE SET NULL;

-- 3. protocolo_registros.escritura_id → SET NULL on delete of escritura
ALTER TABLE protocolo_registros DROP CONSTRAINT IF EXISTS protocolo_registros_escritura_id_fkey;
ALTER TABLE protocolo_registros ADD CONSTRAINT protocolo_registros_escritura_id_fkey
  FOREIGN KEY (escritura_id) REFERENCES escrituras(id) ON DELETE SET NULL;
