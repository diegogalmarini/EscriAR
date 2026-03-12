-- ============================================================
-- 059: Cleanup orphan personas sin vinculación a operaciones
-- ============================================================
-- Registros que existen en 'personas' pero no tienen ningún
-- participantes_operacion. Son restos de merges o extracciones fallidas.
-- ============================================================

-- Primero ver cuántos hay (para el log)
DO $$
DECLARE
    orphan_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO orphan_count
    FROM personas p
    WHERE NOT EXISTS (
        SELECT 1 FROM participantes_operacion po WHERE po.persona_id = p.dni
    );
    RAISE NOTICE 'Orphan personas found: %', orphan_count;
END $$;

-- Eliminar personas sin ningún vínculo a operaciones
-- (estas personas no sirven porque no están conectadas a ningún acto)
DELETE FROM personas
WHERE NOT EXISTS (
    SELECT 1 FROM participantes_operacion WHERE persona_id = personas.dni
);
