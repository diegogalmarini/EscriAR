-- 052: Limpiar partido_id con códigos entre paréntesis + re-extraer protocolo
-- Fecha: 2026-03-10

-- 1. Limpiar partido_id que contengan "(XXX)"
-- Ej: "Bahia Blanca (007)" → "Bahia Blanca"
UPDATE inmuebles
SET partido_id = TRIM(regexp_replace(partido_id, '\s*\(\d+\)\s*', '', 'g'))
WHERE partido_id ~ '\(\d+\)';

-- 2. Resetear extraction_status de TODOS los registros del protocolo para re-extraer
-- Esto triggerea el worker a re-procesar cada escritura con el prompt mejorado
-- SOLO resetea los campos auto-rellenados, preserva los editados manualmente
UPDATE protocolo_registros
SET
    extraction_status = 'PENDIENTE',
    extraction_data = NULL,
    extraction_evidence = NULL,
    extraction_error = NULL,
    tipo_acto = NULL,
    codigo_acto = NULL,
    vendedor_acreedor = NULL,
    comprador_deudor = NULL,
    monto_ars = NULL,
    monto_usd = NULL
WHERE extraction_status = 'COMPLETADO'
  AND pdf_storage_path IS NOT NULL;

-- 3. Crear jobs de re-extracción para cada registro que tiene PDF
INSERT INTO ingestion_jobs (job_type, status, file_path, entity_ref, original_filename)
SELECT
    'ESCRITURA_EXTRACT',
    'pending',
    pr.pdf_storage_path,
    jsonb_build_object('registro_id', pr.id),
    pr.pdf_storage_path
FROM protocolo_registros pr
WHERE pr.pdf_storage_path IS NOT NULL
  AND pr.extraction_status = 'PENDIENTE'
  AND NOT EXISTS (
    SELECT 1 FROM ingestion_jobs ij
    WHERE ij.entity_ref->>'registro_id' = pr.id::text
    AND ij.status IN ('pending', 'processing')
  );
