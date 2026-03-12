-- ============================================================
-- 060: Restore personas from participantes_operacion references
-- ============================================================
-- La migración 059 borró personas que no tenían participantes_operacion.
-- PERO las personas que SÍ tenían participantes siguen referenciadas.
-- Este script verifica el estado y crea registros stub para cualquier
-- persona_id referenciada en participantes_operacion que no exista en personas.
-- ============================================================

-- ── PASO 1: Ver cuántas referencias rotas hay ──
DO $$
DECLARE
    broken_count INTEGER;
    existing_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO existing_count FROM personas;
    RAISE NOTICE 'Personas existentes: %', existing_count;

    SELECT COUNT(DISTINCT persona_id) INTO broken_count
    FROM participantes_operacion po
    WHERE NOT EXISTS (SELECT 1 FROM personas p WHERE p.dni = po.persona_id);
    RAISE NOTICE 'Referencias rotas (persona_id sin persona): %', broken_count;
END $$;

-- ── PASO 2: Recrear stubs para personas referenciadas que faltan ──
-- Usa la info disponible en participantes_operacion (solo persona_id y rol)
INSERT INTO personas (dni, nombre_completo, tipo_persona, origen_dato, created_at, updated_at)
SELECT DISTINCT
    po.persona_id,
    po.persona_id,  -- nombre_completo temporal = el ID
    'FISICA',
    'RECUPERADO',
    NOW(),
    NOW()
FROM participantes_operacion po
WHERE NOT EXISTS (SELECT 1 FROM personas p WHERE p.dni = po.persona_id)
ON CONFLICT (dni) DO NOTHING;

-- ── PASO 3: Intentar enriquecer stubs con datos de escrituras/operaciones ──
-- Las operaciones tienen datos que pueden ayudar a identificar personas

-- Ver resultado
DO $$
DECLARE
    restored_count INTEGER;
    total_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO restored_count FROM personas WHERE origen_dato = 'RECUPERADO';
    SELECT COUNT(*) INTO total_count FROM personas;
    RAISE NOTICE 'Personas restauradas (stubs): %', restored_count;
    RAISE NOTICE 'Total personas ahora: %', total_count;
END $$;
