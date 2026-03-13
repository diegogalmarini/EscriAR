-- Migration 063: Cleanup orphan carpetas from batch re-ingest
-- These carpetas were auto-created by /api/ingest during the 56-PDF re-ingest
-- and have no logical value (caratula = PDF filename, no real case/trámite).
--
-- IMPORTANT: Run the SELECT first to verify count before running the DELETE.

-- Step 1: Verify (run this first)
SELECT COUNT(*) as carpetas_huerfanas
FROM carpetas
WHERE caratula LIKE '%.pdf'
  AND ingesta_estado = 'COMPLETADO';

-- Step 2: Delete (run manually after verifying count)
-- DELETE FROM carpetas
-- WHERE caratula LIKE '%.pdf'
--   AND ingesta_estado = 'COMPLETADO';
