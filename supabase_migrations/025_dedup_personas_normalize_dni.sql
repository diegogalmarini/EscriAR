-- Fix: Deduplicar personas con DNI formateado diferente (ej: "31.670.469" vs "31670469")
-- El DNI normalizado (solo dígitos) es el canónico.
-- Paso 1: Mover participantes del duplicado al registro limpio
-- Paso 2: Eliminar el registro duplicado

-- Identificar duplicados: personas cuyo DNI contiene puntos/guiones
-- y ya existe otra persona con el mismo DNI limpio (solo dígitos)
DO $$
DECLARE
    dup RECORD;
    clean_dni TEXT;
    existing_id TEXT;
BEGIN
    FOR dup IN
        SELECT dni, nombre_completo
        FROM personas
        WHERE dni ~ '[^a-zA-Z0-9]'  -- DNI con caracteres no alfanuméricos
          AND dni NOT LIKE 'SIN-DNI-%'  -- Excluir temporales (no son duplicados)
          AND dni NOT LIKE 'TEMP-%'     -- Excluir fallbacks del ingest
    LOOP
        clean_dni := regexp_replace(dup.dni, '[^a-zA-Z0-9]', '', 'g');

        -- Check if clean version exists
        SELECT dni INTO existing_id FROM personas WHERE dni = clean_dni LIMIT 1;

        IF existing_id IS NOT NULL THEN
            -- Move participantes from dirty to clean
            UPDATE participantes_operacion
            SET persona_id = clean_dni
            WHERE persona_id = dup.dni;

            -- Delete the dirty duplicate
            DELETE FROM personas WHERE dni = dup.dni;

            RAISE NOTICE 'Deduped: % (%) -> %', dup.nombre_completo, dup.dni, clean_dni;
        ELSE
            -- No clean version exists, just rename the dirty one
            UPDATE participantes_operacion
            SET persona_id = clean_dni
            WHERE persona_id = dup.dni;

            UPDATE personas SET dni = clean_dni WHERE dni = dup.dni;

            RAISE NOTICE 'Normalized: % (%) -> %', dup.nombre_completo, dup.dni, clean_dni;
        END IF;
    END LOOP;
END $$;
