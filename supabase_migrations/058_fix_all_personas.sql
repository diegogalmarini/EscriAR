-- ============================================================
-- 058: Fix ALL personas — drop index, dedup, backfill, recreate
-- ============================================================
-- Ejecutar este script resuelve todo de una vez.
-- Primero quita el unique index que bloquea, luego limpia, luego recrea.
-- ============================================================

-- ── PASO 0: Drop unique index para que no bloquee operaciones ──
DROP INDEX IF EXISTS idx_personas_unique_cuit;

-- ── PASO 1: Normalize todos los CUIT existentes (quitar guiones) ──
UPDATE personas
SET cuit = REGEXP_REPLACE(cuit, '[^0-9]', '', 'g')
WHERE cuit IS NOT NULL AND cuit != '' AND cuit ~ '\D';

-- ── PASO 2: Backfill CUIT desde DNI donde DNI parece un CUIT válido ──
UPDATE personas
SET cuit = REGEXP_REPLACE(dni, '[^0-9]', '', 'g')
WHERE (cuit IS NULL OR cuit = '')
  AND LENGTH(REGEXP_REPLACE(dni, '[^0-9]', '', 'g')) BETWEEN 10 AND 11
  AND LEFT(REGEXP_REPLACE(dni, '[^0-9]', '', 'g'), 2) IN ('20','23','24','27','30','33','34')
  AND dni NOT LIKE 'TEMP-%'
  AND dni NOT LIKE 'SIN-%';

-- ── PASO 3: Set tipo_persona para jurídicas detectadas por nombre ──
UPDATE personas
SET tipo_persona = 'JURIDICA'
WHERE (tipo_persona IS NULL OR tipo_persona = '' OR tipo_persona = 'FISICA')
  AND UPPER(nombre_completo) ~ '(BANCO|S\.A\.|S\.R\.L\.|S\.A\.U\.|S\.A\.S\.|SOCIEDAD|FIDEICOMISO|FUNDACION|FUNDACIÓN|ASOCIACION|ASOCIACIÓN|COOPERATIVA|CONSORCIO|MUTUAL|FRIGORIFICO|FRIGORÍFICO)';

-- ── PASO 4: Merge jurídicas duplicadas por CUIT ──
DO $$
DECLARE
    dup_cuit TEXT;
    canonical_dni TEXT;
    dup_record RECORD;
    merge_count INTEGER := 0;
BEGIN
    FOR dup_cuit IN
        SELECT cuit FROM personas
        WHERE cuit IS NOT NULL AND cuit != '' AND cuit !~ '(TEMP|SIN)'
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
        END LOOP;
    END LOOP;
    RAISE NOTICE 'Merged by CUIT: %', merge_count;
END $$;

-- ── PASO 5: Merge jurídicas duplicadas por nombre normalizado ──
DO $$
DECLARE
    norm_name TEXT;
    canonical_dni TEXT;
    dup_record RECORD;
    merge_count INTEGER := 0;
BEGIN
    FOR norm_name IN
        SELECT UPPER(
            REGEXP_REPLACE(
                TRANSLATE(nombre_completo, 'áéíóúñÁÉÍÓÚÑ–—"""''', 'aeiounAEIOUN------'),
                '[^A-Z0-9 ]', '', 'g'
            )
        )
        FROM personas
        WHERE tipo_persona IN ('JURIDICA', 'FIDEICOMISO')
           OR UPPER(nombre_completo) ~ '(BANCO|S\.A\.|S\.R\.L\.|S\.A\.U\.|SOCIEDAD|FIDEICOMISO|FUNDACION|ASOCIACION|COOPERATIVA|CONSORCIO|MUTUAL|FRIGORIFICO)'
        GROUP BY UPPER(
            REGEXP_REPLACE(
                TRANSLATE(nombre_completo, 'áéíóúñÁÉÍÓÚÑ–—"""''', 'aeiounAEIOUN------'),
                '[^A-Z0-9 ]', '', 'g'
            )
        )
        HAVING COUNT(*) > 1
    LOOP
        SELECT dni INTO canonical_dni FROM personas
        WHERE UPPER(
            REGEXP_REPLACE(
                TRANSLATE(nombre_completo, 'áéíóúñÁÉÍÓÚÑ–—"""''', 'aeiounAEIOUN------'),
                '[^A-Z0-9 ]', '', 'g'
            )
        ) = norm_name
        ORDER BY
            CASE WHEN cuit IS NOT NULL AND cuit != '' AND cuit !~ '(TEMP|SIN)' AND LENGTH(REGEXP_REPLACE(cuit, '[^0-9]', '', 'g')) >= 10 THEN 0 ELSE 1 END,
            CASE WHEN dni = cuit THEN 0 ELSE 1 END,
            CASE WHEN dni LIKE 'TEMP-%' OR dni LIKE 'SIN-DNI-%' OR dni LIKE 'SIN_DNI_%' THEN 1 ELSE 0 END,
            created_at ASC
        LIMIT 1;

        FOR dup_record IN
            SELECT dni, cuit, nombre_completo FROM personas
            WHERE UPPER(
                REGEXP_REPLACE(
                    TRANSLATE(nombre_completo, 'áéíóúñÁÉÍÓÚÑ–—"""''', 'aeiounAEIOUN------'),
                    '[^A-Z0-9 ]', '', 'g'
                )
            ) = norm_name
            AND dni != canonical_dni
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
            RAISE NOTICE 'Merged "%" → %', dup_record.nombre_completo, canonical_dni;
        END LOOP;
    END LOOP;
    RAISE NOTICE 'Merged by name: %', merge_count;
END $$;

-- ── PASO 6: Merge físicas duplicadas por nombre+fecha_nacimiento ──
DO $$
DECLARE
    norm_key TEXT;
    canonical_dni TEXT;
    dup_record RECORD;
    merge_count INTEGER := 0;
BEGIN
    FOR norm_key IN
        SELECT UPPER(
            REGEXP_REPLACE(
                TRANSLATE(nombre_completo, 'áéíóúñÁÉÍÓÚÑ', 'aeiounAEIOUN'),
                '[^A-Z ]', '', 'g'
            )
        ) || '|' || fecha_nacimiento::text
        FROM personas
        WHERE tipo_persona IS DISTINCT FROM 'JURIDICA'
          AND tipo_persona IS DISTINCT FROM 'FIDEICOMISO'
          AND fecha_nacimiento IS NOT NULL
        GROUP BY UPPER(
            REGEXP_REPLACE(
                TRANSLATE(nombre_completo, 'áéíóúñÁÉÍÓÚÑ', 'aeiounAEIOUN'),
                '[^A-Z ]', '', 'g'
            )
        ) || '|' || fecha_nacimiento::text
        HAVING COUNT(*) > 1
    LOOP
        SELECT dni INTO canonical_dni FROM personas
        WHERE UPPER(
            REGEXP_REPLACE(
                TRANSLATE(nombre_completo, 'áéíóúñÁÉÍÓÚÑ', 'aeiounAEIOUN'),
                '[^A-Z ]', '', 'g'
            )
        ) || '|' || fecha_nacimiento::text = norm_key
        ORDER BY
            CASE WHEN dni LIKE 'TEMP-%' OR dni LIKE 'SIN-DNI-%' OR dni LIKE 'SIN_DNI_%' THEN 1 ELSE 0 END,
            CASE WHEN cuit IS NOT NULL AND cuit != '' THEN 0 ELSE 1 END,
            created_at ASC
        LIMIT 1;

        FOR dup_record IN
            SELECT dni, nombre_completo FROM personas
            WHERE UPPER(
                REGEXP_REPLACE(
                    TRANSLATE(nombre_completo, 'áéíóúñÁÉÍÓÚÑ', 'aeiounAEIOUN'),
                    '[^A-Z ]', '', 'g'
                )
            ) || '|' || fecha_nacimiento::text = norm_key
            AND dni != canonical_dni
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
        END LOOP;
    END LOOP;
    RAISE NOTICE 'Merged físicas by name+DOB: %', merge_count;
END $$;

-- ── PASO 7: Eliminar huérfanos TEMP/SIN_DNI sin participaciones ──
DELETE FROM personas
WHERE (dni LIKE 'TEMP-%' OR dni LIKE 'SIN_DNI_%' OR dni LIKE 'SIN-DNI-%')
  AND NOT EXISTS (
      SELECT 1 FROM participantes_operacion WHERE persona_id = personas.dni
  );

-- ── PASO 8: Recrear unique index ──
CREATE UNIQUE INDEX idx_personas_unique_cuit
  ON personas (cuit)
  WHERE cuit IS NOT NULL AND cuit != '' AND cuit NOT LIKE 'TEMP-%' AND cuit NOT LIKE 'SIN_%';
