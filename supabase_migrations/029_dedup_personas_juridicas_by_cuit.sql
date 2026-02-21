-- Fix: Fusionar personas jurídicas duplicadas que tienen el mismo CUIT
-- Caso: BANCO DE LA NACION ARGENTINA aparece 3 veces con CUIT 30500010912
-- pero con diferentes DNI (30500010912, SIN_DNI_xxx, etc.)
-- El registro canónico es el que tiene CUIT como DNI (sin SIN_DNI)

DO $$
DECLARE
    dup_cuit TEXT;
    canonical_dni TEXT;
    dup_record RECORD;
BEGIN
    -- Find CUITs that appear in multiple persona records
    FOR dup_cuit IN
        SELECT cuit FROM personas
        WHERE cuit IS NOT NULL AND cuit != ''
        GROUP BY cuit HAVING COUNT(*) > 1
    LOOP
        -- Pick canonical record: prefer one where dni = cuit (JURIDICA standard),
        -- else prefer one without SIN_DNI/TEMP prefix
        SELECT dni INTO canonical_dni FROM personas
        WHERE cuit = dup_cuit
        ORDER BY
            CASE WHEN dni = dup_cuit THEN 0 ELSE 1 END,
            CASE WHEN dni LIKE 'SIN_DNI_%' OR dni LIKE 'TEMP-%' THEN 1 ELSE 0 END,
            created_at ASC
        LIMIT 1;

        -- Move all participantes from duplicates to canonical
        FOR dup_record IN
            SELECT dni FROM personas WHERE cuit = dup_cuit AND dni != canonical_dni
        LOOP
            -- Update participantes to point to canonical (ignore if already exists)
            UPDATE participantes_operacion
            SET persona_id = canonical_dni
            WHERE persona_id = dup_record.dni
              AND NOT EXISTS (
                  SELECT 1 FROM participantes_operacion p2
                  WHERE p2.operacion_id = participantes_operacion.operacion_id
                    AND p2.persona_id = canonical_dni
              );

            -- Delete orphaned participantes (where canonical already exists)
            DELETE FROM participantes_operacion WHERE persona_id = dup_record.dni;

            -- Delete the duplicate persona
            DELETE FROM personas WHERE dni = dup_record.dni;

            RAISE NOTICE 'Merged persona % (cuit %) → canonical %', dup_record.dni, dup_cuit, canonical_dni;
        END LOOP;
    END LOOP;
END $$;
