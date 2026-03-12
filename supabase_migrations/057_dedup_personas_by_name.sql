-- ============================================================
-- 057: Dedup personas por nombre normalizado (jurídicas)
-- ============================================================
-- Problema: BANCO DE LA NACION ARGENTINA aparece 4 veces con CUITs
-- distintos (errores de OCR). La dedup por CUIT no los atrapa.
-- Solución: para jurídicas, merge por nombre normalizado, conservando
-- el registro con el CUIT más confiable.
-- ============================================================

-- ── PASO 1: Merge jurídicas duplicadas por nombre normalizado ──

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
        -- Canonical: prefer record with real CUIT (not SIN_DNI/TEMP), then most data, oldest
        SELECT dni INTO canonical_dni FROM personas
        WHERE UPPER(
            REGEXP_REPLACE(
                TRANSLATE(nombre_completo, 'áéíóúñÁÉÍÓÚÑ–—"""''', 'aeiounAEIOUN------'),
                '[^A-Z0-9 ]', '', 'g'
            )
        ) = norm_name
        ORDER BY
            -- Prefer records with a valid numeric CUIT
            CASE WHEN cuit IS NOT NULL AND cuit != '' AND cuit !~ '(TEMP|SIN)' AND LENGTH(REGEXP_REPLACE(cuit, '[^0-9]', '', 'g')) >= 10 THEN 0 ELSE 1 END,
            -- Prefer records where dni = cuit (standard for JURIDICA)
            CASE WHEN dni = cuit THEN 0 ELSE 1 END,
            -- Prefer non-TEMP/SIN DNI
            CASE WHEN dni LIKE 'TEMP-%' OR dni LIKE 'SIN-DNI-%' OR dni LIKE 'SIN_DNI_%' THEN 1 ELSE 0 END,
            -- Prefer records with more data
            CASE WHEN fecha_nacimiento IS NOT NULL THEN 0 ELSE 1 END,
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
            -- Move participantes to canonical
            UPDATE participantes_operacion
            SET persona_id = canonical_dni
            WHERE persona_id = dup_record.dni
              AND NOT EXISTS (
                  SELECT 1 FROM participantes_operacion p2
                  WHERE p2.operacion_id = participantes_operacion.operacion_id
                    AND p2.persona_id = canonical_dni
              );

            -- Delete orphaned participantes
            DELETE FROM participantes_operacion WHERE persona_id = dup_record.dni;

            -- Delete duplicate persona
            DELETE FROM personas WHERE dni = dup_record.dni;

            merge_count := merge_count + 1;
            RAISE NOTICE 'Merged "%"  (dni=%, cuit=%) → canonical %', dup_record.nombre_completo, dup_record.dni, dup_record.cuit, canonical_dni;
        END LOOP;
    END LOOP;
    RAISE NOTICE 'Total jurídicas merged by name: %', merge_count;
END $$;

-- ── PASO 2: Merge personas FÍSICAS duplicadas por nombre+fecha_nacimiento ──
-- Ej: misma persona con variaciones menores de nombre

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
            RAISE NOTICE 'Merged física "%" (dni=%) → canonical %', dup_record.nombre_completo, dup_record.dni, canonical_dni;
        END LOOP;
    END LOOP;
    RAISE NOTICE 'Total físicas merged by name+DOB: %', merge_count;
END $$;

-- ── PASO 3: Limpiar registros SIN_DNI_ y TEMP- sin participantes ──
-- Entidades huérfanas que no están vinculadas a ninguna operación

DELETE FROM personas
WHERE (dni LIKE 'TEMP-%' OR dni LIKE 'SIN_DNI_%' OR dni LIKE 'SIN-DNI-%')
  AND NOT EXISTS (
      SELECT 1 FROM participantes_operacion WHERE persona_id = personas.dni
  );

-- ── PASO 4: Recrear unique index ──

DROP INDEX IF EXISTS idx_personas_unique_cuit;
CREATE UNIQUE INDEX idx_personas_unique_cuit
  ON personas (cuit)
  WHERE cuit IS NOT NULL AND cuit != '' AND cuit NOT LIKE 'TEMP-%' AND cuit NOT LIKE 'SIN_%';
