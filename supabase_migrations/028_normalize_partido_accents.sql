-- Fix: Normalizar tildes en partido_id para evitar duplicados
-- "Bahía Blanca" → "Bahia Blanca" (canónico sin tildes)
-- MERGE: Si ya existe un inmueble canónico, mover FKs y eliminar el duplicado con tilde

DO $$
DECLARE
    dup RECORD;
    canonical_partido TEXT;
    canonical_id UUID;
BEGIN
    -- Find inmuebles with accented partido_id that have a canonical twin
    FOR dup IN
        SELECT i.id, i.partido_id, i.nro_partida
        FROM inmuebles i
        WHERE i.partido_id ~ '[áéíóúÁÉÍÓÚ]'
    LOOP
        -- Build canonical partido (strip accents, Title Case)
        canonical_partido := initcap(
            replace(replace(replace(replace(replace(
                replace(replace(replace(replace(replace(
                    dup.partido_id,
                'Á','A'),'É','E'),'Í','I'),'Ó','O'),'Ú','U'),
                'á','a'),'é','e'),'í','i'),'ó','o'),'ú','u')
        );

        -- Check if a canonical version already exists
        SELECT id INTO canonical_id
        FROM inmuebles
        WHERE partido_id = canonical_partido
          AND nro_partida = dup.nro_partida
          AND id != dup.id
        LIMIT 1;

        IF canonical_id IS NOT NULL THEN
            -- MERGE: Move FK references from duplicate to canonical
            UPDATE escrituras SET inmueble_princ_id = canonical_id WHERE inmueble_princ_id = dup.id;
            -- Delete the duplicate
            DELETE FROM inmuebles WHERE id = dup.id;
            RAISE NOTICE 'Merged inmueble % (%) → % (%)', dup.partido_id, dup.nro_partida, canonical_partido, canonical_id;
        ELSE
            -- No canonical twin: just rename
            UPDATE inmuebles SET partido_id = canonical_partido WHERE id = dup.id;
            RAISE NOTICE 'Renamed inmueble % → %', dup.partido_id, canonical_partido;
        END IF;
    END LOOP;
END $$;
