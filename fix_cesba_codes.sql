-- ============================================================
-- FIX: Corrección de códigos CESBA en modelos_actos (Supabase)
-- ============================================================
-- Fecha: 2026-03-12
-- Motivo: El notario detectó que actas, poderes, testamentos,
--         certificaciones, etc. tenían código 800-02
--         ("ACTO CON OBJETOS VARIOS", 1.2% sellos) en vez de
--         800-32 ("NO GRAVADA", 0% sellos).
--
-- ANTES de ejecutar: hacer un SELECT para ver qué se va a cambiar.
-- ============================================================

-- 1. Preview: ver registros afectados
SELECT id, act_type, act_code, label, version, is_active
FROM modelos_actos
WHERE act_code = '800-02'
ORDER BY act_type, version;

-- 2. Corregir todos los actos que deberían ser 800-32 (NO GRAVADA)
--    Incluye: actas, poderes, testamento, autoprotección,
--    certificaciones, testimonios, gestiones, declaraciones, etc.
UPDATE modelos_actos
SET act_code = '800-32',
    updated_at = now()
WHERE act_code = '800-02'
  AND act_type IN (
    -- Actas notariales
    'acta_constatacion',
    'acta_manifestacion',
    'acta_notificacion',
    'acta_asamblea',
    'acta_correspondencia',
    'acta_deposito',
    'acta_testamento_cerrado',
    'acta_subsanacion',
    'acta_digital',
    'acta_comprobacion',
    'acta_comprobacion_terminal',
    'acta_manifestacion_firma',
    -- Poderes
    'poder',
    'poder_especial_compra',
    'poder_especial_donacion',
    'poder_especial_escrituracion',
    'poder_especial_juicio',
    'poder_especial_venta',
    'poder_general_administracion',
    'poder_general_bancario',
    'poder_general_juicios',
    'revocacion_poder',
    -- Testamento / autoprotección
    'testamento',
    'autoproteccion',
    -- Certificaciones
    'certificacion_firmas',
    'legalizacion',
    'apostilla',
    'certificacion_digital',
    'autenticacion_copias',
    'certificado_existencia',
    'certificado_libros',
    'certificado_vigencia',
    -- Testimonios
    'testimonio',
    'testimonio_digital',
    -- Digital / gestión
    'gestion_telematica',
    'gestion_interna',
    'folio_digital',
    'actuacion_pand',
    -- Otros sin valor económico
    'formulario_estatal',
    'declaracion_jurada',
    'autorizacion_simple',
    'acuerdo_laboral',
    'convenio_desvinculacion'
  );

-- 3. Corregir títulos valores: 800-02 → 805-30
--    (INTERVENCIÓN NOTARIAL EN TÍTULOS VALORES)
UPDATE modelos_actos
SET act_code = '805-30',
    updated_at = now()
WHERE act_code = '800-02'
  AND act_type IN (
    'pagare',
    'letra_cambio',
    'cheque',
    'vale_aval',
    'factura_conformada'
  );

-- 4. Corregir escritura complementaria: 800-02 → 702-20
UPDATE modelos_actos
SET act_code = '702-20',
    updated_at = now()
WHERE act_code = '800-02'
  AND act_type = 'escritura_complementaria';

-- 5. Verificar: no debería quedar ningún 800-02 no intencionado
SELECT id, act_type, act_code, label
FROM modelos_actos
WHERE act_code = '800-02'
ORDER BY act_type;

-- 6. También actualizar el act_code dentro del campo metadata (JSONB)
--    para que el metadata embebido sea consistente
UPDATE modelos_actos
SET metadata = jsonb_set(metadata::jsonb, '{act_code}', to_jsonb(act_code))
WHERE metadata IS NOT NULL
  AND metadata::jsonb ? 'act_code'
  AND (metadata::jsonb->>'act_code') != act_code;
