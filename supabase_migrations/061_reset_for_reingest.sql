-- ============================================================
-- 061: Reset completo para re-ingest desde PDFs originales
-- ============================================================
-- Las migraciones 055-059 destruyeron datos de personas.
-- Este reset limpia TODAS las tablas de datos para re-ingestar
-- los 56 PDFs del protocolo 2026 desde cero.
--
-- NO TOCA: organizaciones, user_profiles, auth.users,
--          modelos_actos, jurisdicciones, borradores, tabla_actos
-- ============================================================

-- Tablas dependientes
TRUNCATE audit_events CASCADE;
TRUNCATE sugerencias CASCADE;
TRUNCATE apuntes CASCADE;
TRUNCATE actuaciones CASCADE;
TRUNCATE presupuestos CASCADE;
TRUNCATE certificados CASCADE;
TRUNCATE gravamenes CASCADE;
TRUNCATE participantes_operacion CASCADE;
TRUNCATE operaciones CASCADE;
TRUNCATE ingestion_jobs CASCADE;
TRUNCATE escrituras CASCADE;
TRUNCATE inmuebles CASCADE;
TRUNCATE personas CASCADE;
TRUNCATE carpetas CASCADE;

-- Limpiar índices de migraciones anteriores que pueden causar problemas
DROP INDEX IF EXISTS idx_personas_unique_cuit;
