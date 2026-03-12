-- ============================================================
-- 055: Dedup personas (round 3) + constraints preventivos
-- ============================================================
-- Problemas encontrados:
--   1. Personas jurídicas duplicadas por CUIT (BANCO NACION x4, CODESUR x2, etc.)
--   2. Personas con TEMP-* o SIN-DNI-* como PK que son duplicados de registros reales
--   3. Variaciones de nombre (ñ vs n, tildes) generan registros distintos
-- ============================================================

-- ── PASO 1: Merge jurídicas duplicadas por CUIT ──
-- Mismo patrón que migración 029 pero corre de nuevo para nuevos duplicados

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
        -- Canonical: prefer dni = cuit (standard for JURIDICA), then non-TEMP, oldest
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
            -- Move participantes to canonical (skip if already exists)
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
            RAISE NOTICE 'Merged persona % (cuit %) → canonical %', dup_record.dni, dup_cuit, canonical_dni;
        END LOOP;
    END LOOP;
    RAISE NOTICE 'Total personas merged by CUIT: %', merge_count;
END $$;

-- ── PASO 2: Merge personas con nombre normalizado idéntico (sin CUIT) ──
-- Para entidades sin CUIT que son duplicados por nombre (ej: CLUB VILLA MITRE x2)

DO $$
DECLARE
    norm_name TEXT;
    canonical_dni TEXT;
    dup_record RECORD;
    merge_count INTEGER := 0;
BEGIN
    FOR norm_name IN
        SELECT UPPER(TRANSLATE(nombre_completo, 'áéíóúñÁÉÍÓÚÑ–—', 'aeiounAEIOUN--'))
        FROM personas
        WHERE (cuit IS NULL OR cuit = '')
        GROUP BY UPPER(TRANSLATE(nombre_completo, 'áéíóúñÁÉÍÓÚÑ–—', 'aeiounAEIOUN--'))
        HAVING COUNT(*) > 1
    LOOP
        -- Canonical: prefer non-TEMP, most complete data, oldest
        SELECT dni INTO canonical_dni FROM personas
        WHERE UPPER(TRANSLATE(nombre_completo, 'áéíóúñÁÉÍÓÚÑ–—', 'aeiounAEIOUN--')) = norm_name
          AND (cuit IS NULL OR cuit = '')
        ORDER BY
            CASE WHEN dni LIKE 'TEMP-%' OR dni LIKE 'SIN-DNI-%' OR dni LIKE 'SIN_DNI_%' THEN 1 ELSE 0 END,
            CASE WHEN fecha_nacimiento IS NOT NULL THEN 0 ELSE 1 END,
            created_at ASC
        LIMIT 1;

        FOR dup_record IN
            SELECT dni FROM personas
            WHERE UPPER(TRANSLATE(nombre_completo, 'áéíóúñÁÉÍÓÚÑ–—', 'aeiounAEIOUN--')) = norm_name
              AND (cuit IS NULL OR cuit = '')
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
            RAISE NOTICE 'Merged persona % (name match) → canonical %', dup_record.dni, canonical_dni;
        END LOOP;
    END LOOP;
    RAISE NOTICE 'Total personas merged by name: %', merge_count;
END $$;

-- ── PASO 3: Merge personas con mismo CUIT pero variantes de nombre ──
-- Ej: "COMPANIA DE DESARROLLOS..." vs "COMPAÑIA DE DESARROLLOS..."

DO $$
DECLARE
    dup_cuit TEXT;
    canonical_dni TEXT;
    dup_record RECORD;
    merge_count INTEGER := 0;
BEGIN
    -- Re-run CUIT dedup (paso 1 may have left some if CUIT was empty before)
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
        END LOOP;
    END LOOP;
    RAISE NOTICE 'Total personas merged (pass 2 CUIT): %', merge_count;
END $$;

-- ── PASO 4: Unique index en CUIT (parcial, solo no-null no-empty) ──
-- Previene futuros duplicados de CUIT para personas jurídicas

CREATE UNIQUE INDEX IF NOT EXISTS idx_personas_unique_cuit
  ON personas (cuit)
  WHERE cuit IS NOT NULL AND cuit != '' AND cuit NOT LIKE 'TEMP-%';
