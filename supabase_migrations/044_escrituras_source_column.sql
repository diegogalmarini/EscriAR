-- ============================================================
-- 044 — Agregar columna source a escrituras
-- Separa escrituras-antecedente (INGESTA) de escrituras-trámite (TRAMITE)
-- ============================================================

-- PRECHECKS
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'escrituras' AND column_name = 'source';
-- Debe devolver 0 filas.

-- APPLY
BEGIN;

-- 1. Agregar columna con default TRAMITE (las escrituras vacías de createFolder son TRAMITE)
ALTER TABLE escrituras
  ADD COLUMN source VARCHAR(20) NOT NULL DEFAULT 'TRAMITE'
  CHECK (source IN ('INGESTA', 'TRAMITE'));

-- 2. Marcar como INGESTA las escrituras que tienen datos de antecedente
--    (tienen pdf_url o analysis_metadata → vinieron del pipeline de ingest)
UPDATE escrituras
  SET source = 'INGESTA'
  WHERE pdf_url IS NOT NULL
     OR analysis_metadata IS NOT NULL;

-- 3. Para carpetas que NO tienen escritura TRAMITE, crear una vacía
--    (carpetas donde la única escritura es INGESTA)
INSERT INTO escrituras (carpeta_id, source)
SELECT c.id, 'TRAMITE'
FROM carpetas c
WHERE NOT EXISTS (
  SELECT 1 FROM escrituras e
  WHERE e.carpeta_id = c.id AND e.source = 'TRAMITE'
);

-- 4. Para cada nueva escritura TRAMITE sin operacion, crear operacion vacía
INSERT INTO operaciones (escritura_id, tipo_acto)
SELECT e.id, 'POR_DEFINIR'
FROM escrituras e
WHERE e.source = 'TRAMITE'
  AND NOT EXISTS (
    SELECT 1 FROM operaciones o WHERE o.escritura_id = e.id
  );

-- 5. Índice para búsqueda rápida por carpeta + source
CREATE INDEX idx_escrituras_carpeta_source ON escrituras(carpeta_id, source);

COMMIT;

-- POSTCHECKS
-- SELECT source, count(*) FROM escrituras GROUP BY source;
-- Debe mostrar filas para INGESTA y TRAMITE.
--
-- SELECT c.id FROM carpetas c
-- WHERE NOT EXISTS (SELECT 1 FROM escrituras e WHERE e.carpeta_id = c.id AND e.source = 'TRAMITE');
-- Debe devolver 0 filas (toda carpeta tiene TRAMITE).

-- ROLLBACK (si necesario)
-- ALTER TABLE escrituras DROP COLUMN source;
-- DELETE FROM escrituras WHERE ... (las creadas en paso 3);
