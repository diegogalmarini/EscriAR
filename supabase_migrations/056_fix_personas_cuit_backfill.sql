-- ============================================================
-- 056: Fix personas — backfill CUIT + normalize data
-- ============================================================
-- La migración 055 usó regex demasiado restrictivo (solo dígitos puros).
-- Muchas jurídicas tienen DNIs con guiones (30-71065510-3) o sin tipo_persona.
-- También hay entidades con TEMP-*/SIN-DNI-* que son duplicados.
-- ============================================================

-- ── PASO 1: Backfill CUIT para jurídicas con DNI numérico (con o sin guiones) ──
-- Cubre: "30712345678", "30-71234567-8", "33-12345678-9", etc.

UPDATE personas
SET cuit = REGEXP_REPLACE(dni, '[^0-9]', '', 'g')
WHERE (cuit IS NULL OR cuit = '')
  AND REGEXP_REPLACE(dni, '[^0-9]', '', 'g') ~ '^\d{10,11}$'
  AND LEFT(REGEXP_REPLACE(dni, '[^0-9]', '', 'g'), 2) IN ('20','23','24','27','30','33','34')
  AND dni NOT LIKE 'TEMP-%'
  AND dni NOT LIKE 'SIN-%';

-- ── PASO 2: Para jurídicas detectadas por nombre que aún no tienen CUIT ──
-- Busca en el campo dni cualquier patrón que parezca CUIT

UPDATE personas
SET cuit = REGEXP_REPLACE(dni, '[^0-9]', '', 'g')
WHERE (cuit IS NULL OR cuit = '')
  AND (
    tipo_persona IN ('JURIDICA', 'FIDEICOMISO')
    OR UPPER(nombre_completo) ~ '(BANCO|S\.A\.|S\.R\.L\.|S\.A\.U\.|S\.A\.S\.|SOCIEDAD|FIDEICOMISO|FUNDACION|FUNDACIÓN|ASOCIACION|ASOCIACIÓN|COOPERATIVA|CONSORCIO|MUTUAL|FRIGORIFICO|FRIGORÍFICO)'
  )
  AND LENGTH(REGEXP_REPLACE(dni, '[^0-9]', '', 'g')) >= 10
  AND dni NOT LIKE 'TEMP-%'
  AND dni NOT LIKE 'SIN-%';

-- ── PASO 3: Normalize CUIT format (quitar guiones si los tiene) ──

UPDATE personas
SET cuit = REGEXP_REPLACE(cuit, '[^0-9]', '', 'g')
WHERE cuit IS NOT NULL AND cuit != '' AND cuit ~ '-';

-- ── PASO 4: Merge TEMP-* y SIN-DNI-* que ahora tienen duplicados con CUIT real ──
-- Después del backfill, puede haber conflictos con el unique index

DO $$
DECLARE
    dup_cuit TEXT;
    canonical_dni TEXT;
    dup_record RECORD;
    merge_count INTEGER := 0;
BEGIN
    FOR dup_cuit IN
        SELECT cuit FROM personas
        WHERE cuit IS NOT NULL AND cuit != ''
        GROUP BY cuit HAVING COUNT(*) > 1
    LOOP
        SELECT dni INTO canonical_dni FROM personas
        WHERE cuit = dup_cuit
        ORDER BY
            CASE WHEN dni = cuit THEN 0 ELSE 1 END,
            CASE WHEN dni LIKE 'TEMP-%' OR dni LIKE 'SIN-DNI-%' OR dni LIKE 'SIN_DNI_%' THEN 1 ELSE 0 END,
            created_at ASC
        LIMIT 1;

        FOR dup_record IN
            SELECT dni FROM personas WHERE cuit = dup_cuit AND dni != canonical_dni
        LOOP
            UPDATE participantes_operacion
            SET persona_id = canonical_dni
            WHERE persona_id = dup_record.dni
              AND NOT EXISTS (
                  SELECT 1 FROM participantes_operacion p2
                  WHERE p2.operacion_id = participantes_operacion.operacion_id
                    AND p2.persona_id = canonical_dni
              );

            DELETE FROM participantes_operacion WHERE persona_id = dup_record.dni;
            DELETE FROM personas WHERE dni = dup_record.dni;

            merge_count := merge_count + 1;
            RAISE NOTICE 'Merged persona % (cuit %) → canonical %', dup_record.dni, dup_cuit, canonical_dni;
        END LOOP;
    END LOOP;
    RAISE NOTICE 'Total personas merged: %', merge_count;
END $$;

-- ── PASO 5: Set tipo_persona para jurídicas detectadas por nombre ──

UPDATE personas
SET tipo_persona = 'JURIDICA'
WHERE (tipo_persona IS NULL OR tipo_persona = '' OR tipo_persona = 'FISICA')
  AND UPPER(nombre_completo) ~ '(BANCO|S\.A\.|S\.R\.L\.|S\.A\.U\.|S\.A\.S\.|SOCIEDAD|FIDEICOMISO|FUNDACION|FUNDACIÓN|ASOCIACION|ASOCIACIÓN|COOPERATIVA|CONSORCIO|MUTUAL|FRIGORIFICO|FRIGORÍFICO)';

-- ── PASO 6: Recrear unique index (drop + create por si hubo conflictos) ──

DROP INDEX IF EXISTS idx_personas_unique_cuit;
CREATE UNIQUE INDEX idx_personas_unique_cuit
  ON personas (cuit)
  WHERE cuit IS NOT NULL AND cuit != '' AND cuit NOT LIKE 'TEMP-%';
