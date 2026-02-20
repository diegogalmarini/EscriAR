-- Fix: códigos 200-00 incorrectamente asignados a hipotecas y otros actos
-- El código 200-00 NO existe en la taxonomía CESBA. Los 200-xx son para DONACIONES (empiezan en 200-30).
-- Las hipotecas/préstamos deben ser 300-00, cancelaciones 311-00, etc.

-- Primero, diagnosticar qué hay (ejecutar este SELECT antes del UPDATE para verificar):
-- SELECT id, tipo_acto, codigo FROM operaciones WHERE codigo = '200-00';

-- Fix hipotecas/préstamos: 200-00 → 300-00
UPDATE operaciones
SET codigo = '300-00'
WHERE codigo = '200-00'
  AND (
    tipo_acto ILIKE '%HIPOTEC%'
    OR tipo_acto ILIKE '%PRESTAMO%'
    OR tipo_acto ILIKE '%MUTUO%'
    OR tipo_acto ILIKE '%CREDITO%'
  );

-- Fix compraventas que pudieron quedar mal: 200-00 → 100-00
UPDATE operaciones
SET codigo = '100-00'
WHERE codigo = '200-00'
  AND (
    tipo_acto ILIKE '%COMPRAVENTA%'
    OR tipo_acto ILIKE '%VENTA%'
  );

-- Fix cualquier 200-00 restante que sea donación → 200-30 (el primer código válido de donaciones)
UPDATE operaciones
SET codigo = '200-30'
WHERE codigo = '200-00'
  AND tipo_acto ILIKE '%DONACION%';

-- Para cualquier 200-00 que quede sin mapear, poner NULL (mejor que un código inválido)
UPDATE operaciones
SET codigo = NULL
WHERE codigo = '200-00';

-- Fix: Reglamento de PH y División de Condominio sin código → 512-30
UPDATE operaciones
SET codigo = '512-30'
WHERE codigo IS NULL
  AND (
    tipo_acto ILIKE '%REGLAMENTO DE PROPIEDAD HORIZONTAL%'
    OR tipo_acto ILIKE '%DIVISION DE CONDOMINIO%'
    OR tipo_acto ILIKE '%AFECTACION%PROPIEDAD HORIZONTAL%'
  );
