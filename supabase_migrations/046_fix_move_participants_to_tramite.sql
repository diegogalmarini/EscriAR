-- ============================================================
-- 046 — Mover participantes huérfanos de INGESTA a TRAMITE
--
-- Bug: applySuggestion insertaba participantes en la operación
-- de la escritura INGESTA en vez de TRAMITE.
-- Este script mueve esos participantes a la operación TRAMITE.
-- ============================================================

-- PRECHECKS: ver qué hay que mover
-- SELECT
--   po.id as participante_id,
--   po.persona_id,
--   po.rol,
--   e.source,
--   e.carpeta_id
-- FROM participantes_operacion po
-- JOIN operaciones o ON po.operacion_id = o.id
-- JOIN escrituras e ON o.escritura_id = e.id
-- WHERE e.source = 'INGESTA'
--   AND po.persona_id NOT IN (
--     -- Personas que fueron extraídas por el ingest (tienen origen_dato = 'IA_OCR')
--     SELECT dni FROM personas WHERE origen_dato = 'IA_OCR'
--   );

-- APPLY
BEGIN;

-- Para cada participante en operación INGESTA que NO sea de origen IA_OCR,
-- moverlo a la operación TRAMITE de la misma carpeta
WITH participants_to_move AS (
  SELECT
    po.id as participante_id,
    po.persona_id,
    po.rol,
    po.porcentaje_titularidad,
    po.datos_representacion,
    e.carpeta_id,
    o.id as old_operacion_id
  FROM participantes_operacion po
  JOIN operaciones o ON po.operacion_id = o.id
  JOIN escrituras e ON o.escritura_id = e.id
  WHERE e.source = 'INGESTA'
    AND NOT EXISTS (
      -- Solo mover si la persona NO fue extraída por IA
      SELECT 1 FROM personas p
      WHERE p.dni = po.persona_id
        AND p.origen_dato = 'IA_OCR'
    )
),
tramite_ops AS (
  SELECT DISTINCT ON (e.carpeta_id)
    e.carpeta_id,
    o.id as tramite_operacion_id
  FROM escrituras e
  JOIN operaciones o ON o.escritura_id = e.id
  WHERE e.source = 'TRAMITE'
  ORDER BY e.carpeta_id, o.created_at ASC
)
-- Insertar en TRAMITE (ignorar si ya existe)
INSERT INTO participantes_operacion (operacion_id, persona_id, rol, porcentaje_titularidad, datos_representacion)
SELECT
  t.tramite_operacion_id,
  p.persona_id,
  p.rol,
  p.porcentaje_titularidad,
  p.datos_representacion
FROM participants_to_move p
JOIN tramite_ops t ON t.carpeta_id = p.carpeta_id
ON CONFLICT (operacion_id, persona_id) DO NOTHING;

-- Eliminar los participantes movidos de INGESTA
DELETE FROM participantes_operacion
WHERE id IN (
  SELECT po.id
  FROM participantes_operacion po
  JOIN operaciones o ON po.operacion_id = o.id
  JOIN escrituras e ON o.escritura_id = e.id
  WHERE e.source = 'INGESTA'
    AND NOT EXISTS (
      SELECT 1 FROM personas p
      WHERE p.dni = po.persona_id
        AND p.origen_dato = 'IA_OCR'
    )
);

COMMIT;

-- POSTCHECKS
-- Verificar que no quedan participantes manuales en INGESTA:
-- SELECT po.*, e.source, p.origen_dato
-- FROM participantes_operacion po
-- JOIN operaciones o ON po.operacion_id = o.id
-- JOIN escrituras e ON o.escritura_id = e.id
-- LEFT JOIN personas p ON p.dni = po.persona_id
-- WHERE e.source = 'INGESTA' AND (p.origen_dato IS NULL OR p.origen_dato != 'IA_OCR');
-- Debe devolver 0 filas.
