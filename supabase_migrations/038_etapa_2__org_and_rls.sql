-- =========================================
-- MIGRATION: 038_etapa_2__org_and_rls.sql
-- Fecha: 2026-03-04
-- Etapa: 2 — Seguridad multi-tenant por Organización
-- Descripción:
--   1. Crear tablas organizaciones y organizaciones_users
--   2. Agregar org_id a carpetas
--   3. Bootstrap: org por defecto + Diego como OWNER + backfill carpetas
--   4. Habilitar RLS real en tablas sensibles
--   5. Actualizar RPC search_carpetas para filtrar por org
-- =========================================

-- =====================
-- PRECHECKS
-- =====================
-- Ejecutar estos SELECT para confirmar que el estado es el esperado.
-- Si alguno devuelve resultados inesperados, NO continuar con APPLY.

-- 1) Confirmar que no existe la tabla organizaciones
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'organizaciones'
) AS organizaciones_exists;
-- Esperado: false

-- 2) Confirmar que carpetas NO tiene columna org_id
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'carpetas' AND column_name = 'org_id'
) AS carpetas_org_id_exists;
-- Esperado: false

-- 3) Contar carpetas existentes (para validar backfill después)
SELECT count(*) AS total_carpetas FROM carpetas;

-- 4) Confirmar que Diego existe en auth.users
SELECT id, email FROM auth.users WHERE email = 'diegogalmarini@gmail.com';
-- Esperado: 1 fila

-- 5) Verificar RLS actual en carpetas
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname IN ('carpetas', 'escrituras', 'operaciones', 'participantes_operacion', 'ingestion_jobs')
ORDER BY relname;
-- Esperado: relrowsecurity = false para carpetas, escrituras, operaciones, participantes_operacion

-- =====================
-- APPLY
-- =====================
BEGIN;

-- ── 1. Crear tabla organizaciones ──
CREATE TABLE IF NOT EXISTS organizaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  slug TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── 2. Crear tabla organizaciones_users ──
CREATE TABLE IF NOT EXISTS organizaciones_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('OWNER', 'NOTARIO', 'ADMIN', 'STAFF')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_users_user_id ON organizaciones_users(user_id);
CREATE INDEX IF NOT EXISTS idx_org_users_org_id ON organizaciones_users(org_id);

-- ── 3. Agregar org_id a carpetas (nullable primero para backfill) ──
ALTER TABLE carpetas ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES organizaciones(id);

-- ── 4. Bootstrap anti lock-out ──

-- 4a. Crear organización por defecto
INSERT INTO organizaciones (id, nombre, slug)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Escribanía Galmarini',
  'galmarini'
)
ON CONFLICT (id) DO NOTHING;

-- 4b. Asignar a Diego como OWNER
INSERT INTO organizaciones_users (org_id, user_id, role)
SELECT
  'a0000000-0000-0000-0000-000000000001',
  id,
  'OWNER'
FROM auth.users
WHERE email = 'diegogalmarini@gmail.com'
ON CONFLICT (org_id, user_id) DO NOTHING;

-- 4c. Backfill: todas las carpetas existentes → org por defecto
UPDATE carpetas
SET org_id = 'a0000000-0000-0000-0000-000000000001'
WHERE org_id IS NULL;

-- 4d. Ahora que todo está backfilled, hacer NOT NULL
ALTER TABLE carpetas ALTER COLUMN org_id SET NOT NULL;

-- Índice para RLS performance
CREATE INDEX IF NOT EXISTS idx_carpetas_org_id ON carpetas(org_id);

-- ── 5. Habilitar RLS en tablas sensibles ──

-- 5a. carpetas
ALTER TABLE carpetas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_member_select_carpetas" ON carpetas
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organizaciones_users ou
      WHERE ou.org_id = carpetas.org_id
      AND ou.user_id = auth.uid()
    )
  );

CREATE POLICY "org_member_insert_carpetas" ON carpetas
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM organizaciones_users ou
      WHERE ou.org_id = carpetas.org_id
      AND ou.user_id = auth.uid()
    )
  );

CREATE POLICY "org_member_update_carpetas" ON carpetas
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM organizaciones_users ou
      WHERE ou.org_id = carpetas.org_id
      AND ou.user_id = auth.uid()
    )
  );

CREATE POLICY "org_member_delete_carpetas" ON carpetas
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM organizaciones_users ou
      WHERE ou.org_id = carpetas.org_id
      AND ou.user_id = auth.uid()
      AND ou.role IN ('OWNER', 'ADMIN')
    )
  );

-- service_role bypass (para worker Railway, API routes con service key)
CREATE POLICY "service_role_all_carpetas" ON carpetas
  FOR ALL USING (auth.role() = 'service_role');

-- 5b. escrituras (acceso derivado vía carpeta)
ALTER TABLE escrituras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_member_select_escrituras" ON escrituras
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM carpetas c
      JOIN organizaciones_users ou ON ou.org_id = c.org_id
      WHERE c.id = escrituras.carpeta_id
      AND ou.user_id = auth.uid()
    )
  );

CREATE POLICY "org_member_insert_escrituras" ON escrituras
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM carpetas c
      JOIN organizaciones_users ou ON ou.org_id = c.org_id
      WHERE c.id = escrituras.carpeta_id
      AND ou.user_id = auth.uid()
    )
  );

CREATE POLICY "org_member_update_escrituras" ON escrituras
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM carpetas c
      JOIN organizaciones_users ou ON ou.org_id = c.org_id
      WHERE c.id = escrituras.carpeta_id
      AND ou.user_id = auth.uid()
    )
  );

CREATE POLICY "org_member_delete_escrituras" ON escrituras
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM carpetas c
      JOIN organizaciones_users ou ON ou.org_id = c.org_id
      WHERE c.id = escrituras.carpeta_id
      AND ou.user_id = auth.uid()
      AND ou.role IN ('OWNER', 'ADMIN')
    )
  );

CREATE POLICY "service_role_all_escrituras" ON escrituras
  FOR ALL USING (auth.role() = 'service_role');

-- 5c. operaciones (acceso derivado vía escritura → carpeta)
ALTER TABLE operaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_member_select_operaciones" ON operaciones
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM escrituras e
      JOIN carpetas c ON c.id = e.carpeta_id
      JOIN organizaciones_users ou ON ou.org_id = c.org_id
      WHERE e.id = operaciones.escritura_id
      AND ou.user_id = auth.uid()
    )
  );

CREATE POLICY "org_member_insert_operaciones" ON operaciones
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM escrituras e
      JOIN carpetas c ON c.id = e.carpeta_id
      JOIN organizaciones_users ou ON ou.org_id = c.org_id
      WHERE e.id = operaciones.escritura_id
      AND ou.user_id = auth.uid()
    )
  );

CREATE POLICY "org_member_update_operaciones" ON operaciones
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM escrituras e
      JOIN carpetas c ON c.id = e.carpeta_id
      JOIN organizaciones_users ou ON ou.org_id = c.org_id
      WHERE e.id = operaciones.escritura_id
      AND ou.user_id = auth.uid()
    )
  );

CREATE POLICY "org_member_delete_operaciones" ON operaciones
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM escrituras e
      JOIN carpetas c ON c.id = e.carpeta_id
      JOIN organizaciones_users ou ON ou.org_id = c.org_id
      WHERE e.id = operaciones.escritura_id
      AND ou.user_id = auth.uid()
      AND ou.role IN ('OWNER', 'ADMIN')
    )
  );

CREATE POLICY "service_role_all_operaciones" ON operaciones
  FOR ALL USING (auth.role() = 'service_role');

-- 5d. participantes_operacion (acceso derivado vía operacion → escritura → carpeta)
ALTER TABLE participantes_operacion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_member_select_participantes" ON participantes_operacion
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM operaciones o
      JOIN escrituras e ON e.id = o.escritura_id
      JOIN carpetas c ON c.id = e.carpeta_id
      JOIN organizaciones_users ou ON ou.org_id = c.org_id
      WHERE o.id = participantes_operacion.operacion_id
      AND ou.user_id = auth.uid()
    )
  );

CREATE POLICY "org_member_insert_participantes" ON participantes_operacion
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM operaciones o
      JOIN escrituras e ON e.id = o.escritura_id
      JOIN carpetas c ON c.id = e.carpeta_id
      JOIN organizaciones_users ou ON ou.org_id = c.org_id
      WHERE o.id = participantes_operacion.operacion_id
      AND ou.user_id = auth.uid()
    )
  );

CREATE POLICY "org_member_update_participantes" ON participantes_operacion
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM operaciones o
      JOIN escrituras e ON e.id = o.escritura_id
      JOIN carpetas c ON c.id = e.carpeta_id
      JOIN organizaciones_users ou ON ou.org_id = c.org_id
      WHERE o.id = participantes_operacion.operacion_id
      AND ou.user_id = auth.uid()
    )
  );

CREATE POLICY "org_member_delete_participantes" ON participantes_operacion
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM operaciones o
      JOIN escrituras e ON e.id = o.escritura_id
      JOIN carpetas c ON c.id = e.carpeta_id
      JOIN organizaciones_users ou ON ou.org_id = c.org_id
      WHERE o.id = participantes_operacion.operacion_id
      AND ou.user_id = auth.uid()
      AND ou.role IN ('OWNER', 'ADMIN')
    )
  );

CREATE POLICY "service_role_all_participantes" ON participantes_operacion
  FOR ALL USING (auth.role() = 'service_role');

-- 5e. certificados — reemplazar políticas permisivas actuales
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver certificados" ON certificados;
DROP POLICY IF EXISTS "Usuarios autenticados pueden insertar certificados" ON certificados;
DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar certificados" ON certificados;
DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar certificados" ON certificados;

CREATE POLICY "org_member_select_certificados" ON certificados
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM carpetas c
      JOIN organizaciones_users ou ON ou.org_id = c.org_id
      WHERE c.id = certificados.carpeta_id
      AND ou.user_id = auth.uid()
    )
  );

CREATE POLICY "org_member_insert_certificados" ON certificados
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM carpetas c
      JOIN organizaciones_users ou ON ou.org_id = c.org_id
      WHERE c.id = certificados.carpeta_id
      AND ou.user_id = auth.uid()
    )
  );

CREATE POLICY "org_member_update_certificados" ON certificados
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM carpetas c
      JOIN organizaciones_users ou ON ou.org_id = c.org_id
      WHERE c.id = certificados.carpeta_id
      AND ou.user_id = auth.uid()
    )
  );

CREATE POLICY "org_member_delete_certificados" ON certificados
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM carpetas c
      JOIN organizaciones_users ou ON ou.org_id = c.org_id
      WHERE c.id = certificados.carpeta_id
      AND ou.user_id = auth.uid()
      AND ou.role IN ('OWNER', 'ADMIN')
    )
  );

CREATE POLICY "service_role_all_certificados" ON certificados
  FOR ALL USING (auth.role() = 'service_role');

-- 5f. gravamenes — reemplazar políticas permisivas actuales
DROP POLICY IF EXISTS "Usuarios autenticados pueden ver gravamenes" ON gravamenes;
DROP POLICY IF EXISTS "Usuarios autenticados pueden insertar gravamenes" ON gravamenes;
DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar gravamenes" ON gravamenes;
DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar gravamenes" ON gravamenes;

CREATE POLICY "org_member_select_gravamenes" ON gravamenes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM carpetas c
      JOIN organizaciones_users ou ON ou.org_id = c.org_id
      WHERE c.id = gravamenes.carpeta_id
      AND ou.user_id = auth.uid()
    )
  );

CREATE POLICY "org_member_insert_gravamenes" ON gravamenes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM carpetas c
      JOIN organizaciones_users ou ON ou.org_id = c.org_id
      WHERE c.id = gravamenes.carpeta_id
      AND ou.user_id = auth.uid()
    )
  );

CREATE POLICY "org_member_update_gravamenes" ON gravamenes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM carpetas c
      JOIN organizaciones_users ou ON ou.org_id = c.org_id
      WHERE c.id = gravamenes.carpeta_id
      AND ou.user_id = auth.uid()
    )
  );

CREATE POLICY "org_member_delete_gravamenes" ON gravamenes
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM carpetas c
      JOIN organizaciones_users ou ON ou.org_id = c.org_id
      WHERE c.id = gravamenes.carpeta_id
      AND ou.user_id = auth.uid()
      AND ou.role IN ('OWNER', 'ADMIN')
    )
  );

CREATE POLICY "service_role_all_gravamenes" ON gravamenes
  FOR ALL USING (auth.role() = 'service_role');

-- 5g. ingestion_jobs — reemplazar políticas basadas en user_id con org-based
DROP POLICY IF EXISTS "Users can insert their own jobs" ON ingestion_jobs;
DROP POLICY IF EXISTS "Users can view their own jobs" ON ingestion_jobs;

CREATE POLICY "org_member_select_ingestion_jobs" ON ingestion_jobs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM carpetas c
      JOIN organizaciones_users ou ON ou.org_id = c.org_id
      WHERE c.id = ingestion_jobs.carpeta_id
      AND ou.user_id = auth.uid()
    )
  );

CREATE POLICY "org_member_insert_ingestion_jobs" ON ingestion_jobs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM carpetas c
      JOIN organizaciones_users ou ON ou.org_id = c.org_id
      WHERE c.id = ingestion_jobs.carpeta_id
      AND ou.user_id = auth.uid()
    )
  );

CREATE POLICY "org_member_update_ingestion_jobs" ON ingestion_jobs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM carpetas c
      JOIN organizaciones_users ou ON ou.org_id = c.org_id
      WHERE c.id = ingestion_jobs.carpeta_id
      AND ou.user_id = auth.uid()
    )
  );

CREATE POLICY "service_role_all_ingestion_jobs" ON ingestion_jobs
  FOR ALL USING (auth.role() = 'service_role');

-- 5h. RLS en organizaciones y organizaciones_users
ALTER TABLE organizaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_member_select_org" ON organizaciones
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organizaciones_users ou
      WHERE ou.org_id = organizaciones.id
      AND ou.user_id = auth.uid()
    )
  );

CREATE POLICY "service_role_all_org" ON organizaciones
  FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE organizaciones_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_select_own_memberships" ON organizaciones_users
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "owner_manage_memberships" ON organizaciones_users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM organizaciones_users ou2
      WHERE ou2.org_id = organizaciones_users.org_id
      AND ou2.user_id = auth.uid()
      AND ou2.role = 'OWNER'
    )
  );

CREATE POLICY "service_role_all_org_users" ON organizaciones_users
  FOR ALL USING (auth.role() = 'service_role');

-- ── 6. Actualizar RPC search_carpetas para filtrar por org ──
CREATE OR REPLACE FUNCTION public.search_carpetas(
  search_term text,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  "number" integer,
  internal_id text,
  title text,
  status text,
  tags text[],
  created_at timestamp with time zone,
  total_count bigint,
  parties jsonb,
  escrituras jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  clean_term text;
  calling_user_id uuid;
BEGIN
  clean_term := btrim(search_term);
  calling_user_id := auth.uid();

  RETURN QUERY
  WITH user_orgs AS (
    SELECT ou.org_id FROM organizaciones_users ou WHERE ou.user_id = calling_user_id
  ),
  matching_carpetas AS (
    SELECT DISTINCT c.id
    FROM carpetas c
    LEFT JOIN escrituras e ON c.id = e.carpeta_id
    LEFT JOIN operaciones o ON e.id = o.escritura_id
    LEFT JOIN participantes_operacion po ON o.id = po.operacion_id
    LEFT JOIN personas p ON po.persona_id = p.dni
    WHERE
      c.org_id IN (SELECT org_id FROM user_orgs)
      AND (
        (clean_term IS NULL OR clean_term = '')
        OR (
          c.nro_carpeta_interna::text ILIKE '%' || clean_term || '%'
          OR c.caratula ILIKE '%' || clean_term || '%'
          OR p.nombre_completo ILIKE '%' || clean_term || '%'
          OR p.dni ILIKE '%' || clean_term || '%'
          OR p.cuit ILIKE '%' || clean_term || '%'
          OR o.codigo ILIKE '%' || clean_term || '%'
        )
      )
  ),
  counted AS (
    SELECT count(*) AS total FROM matching_carpetas
  )
  SELECT
    c.id,
    c.nro_carpeta_interna AS "number",
    c.nro_carpeta_interna::text AS internal_id,
    c.caratula AS title,
    c.estado AS status,
    ARRAY[]::text[] AS tags,
    c.created_at,
    (SELECT total FROM counted) AS total_count,
    COALESCE(
      (
        SELECT jsonb_agg(
          DISTINCT jsonb_build_object(
            'id', p2.dni,
            'full_name', p2.nombre_completo,
            'role', po2.rol,
            'tipo_persona', p2.tipo_persona,
            'cuit', p2.cuit
          )
        )
        FROM escrituras e2
        JOIN operaciones o2 ON e2.id = o2.escritura_id
        JOIN participantes_operacion po2 ON o2.id = po2.operacion_id
        JOIN personas p2 ON po2.persona_id = p2.dni
        WHERE e2.carpeta_id = c.id
      ),
      '[]'::jsonb
    ) AS parties,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', e2.id,
            'operaciones', COALESCE(
              (
                SELECT jsonb_agg(
                  jsonb_build_object(
                    'id', o2.id,
                    'codigo', o2.codigo,
                    'tipo_acto', o2.tipo_acto
                  )
                )
                FROM operaciones o2
                WHERE o2.escritura_id = e2.id
              ),
              '[]'::jsonb
            )
          )
        )
        FROM escrituras e2
        WHERE e2.carpeta_id = c.id
      ),
      '[]'::jsonb
    ) AS escrituras
  FROM matching_carpetas mc
  JOIN carpetas c ON c.id = mc.id
  ORDER BY c.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_carpetas(text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_carpetas(text, integer, integer) TO service_role;
-- Revoke anon access (RPC should only be for authenticated users)
REVOKE EXECUTE ON FUNCTION public.search_carpetas(text, integer, integer) FROM anon;

COMMIT;

-- =====================
-- POSTCHECKS
-- =====================
-- Ejecutar DESPUÉS del APPLY para confirmar que todo se aplicó correctamente.

-- 1) Confirmar que las tablas existen
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('organizaciones', 'organizaciones_users')
ORDER BY table_name;
-- Esperado: 2 filas

-- 2) Confirmar que org_id es NOT NULL en carpetas
SELECT column_name, is_nullable FROM information_schema.columns
WHERE table_name = 'carpetas' AND column_name = 'org_id';
-- Esperado: is_nullable = 'NO'

-- 3) Confirmar la org por defecto
SELECT id, nombre, slug FROM organizaciones;
-- Esperado: 1 fila (Escribanía Galmarini)

-- 4) Confirmar que Diego es OWNER
SELECT ou.role, u.email, o.nombre
FROM organizaciones_users ou
JOIN auth.users u ON u.id = ou.user_id
JOIN organizaciones o ON o.id = ou.org_id;
-- Esperado: Diego como OWNER de Escribanía Galmarini

-- 5) Confirmar que todas las carpetas tienen org_id
SELECT count(*) AS carpetas_sin_org FROM carpetas WHERE org_id IS NULL;
-- Esperado: 0

-- 6) Confirmar RLS habilitado
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname IN ('carpetas', 'escrituras', 'operaciones', 'participantes_operacion',
                   'certificados', 'gravamenes', 'ingestion_jobs',
                   'organizaciones', 'organizaciones_users')
ORDER BY relname;
-- Esperado: relrowsecurity = true para todas

-- 7) Confirmar policies creadas (contar por tabla)
SELECT schemaname, tablename, count(*) as policy_count
FROM pg_policies
WHERE tablename IN ('carpetas', 'escrituras', 'operaciones', 'participantes_operacion',
                     'certificados', 'gravamenes', 'ingestion_jobs',
                     'organizaciones', 'organizaciones_users')
GROUP BY schemaname, tablename
ORDER BY tablename;
-- Esperado: carpetas=5, escrituras=5, operaciones=5, participantes=5,
--           certificados=5, gravamenes=5, ingestion_jobs=4,
--           organizaciones=2, organizaciones_users=3

-- 8) TEST DE ACCESO: Diego (autorizado) puede leer carpetas
-- (Ejecutar como Diego — login en Supabase con su cuenta)
-- SELECT count(*) FROM carpetas;
-- Esperado: mismo total que antes de la migración

-- 9) TEST DE BLOQUEO: usuario no miembro no puede leer
-- (Crear un usuario de prueba sin membresía y ejecutar)
-- SELECT count(*) FROM carpetas;
-- Esperado: 0


-- =====================
-- ROLLBACK (copiar/pegar SOLO si hace falta)
-- =====================
-- BEGIN;
--
-- -- Revertir RPC a versión sin filtro org
-- -- (copiar/pegar la versión original de 022_search_carpetas_add_tipo_acto.sql)
--
-- -- Eliminar policies
-- DROP POLICY IF EXISTS "org_member_select_carpetas" ON carpetas;
-- DROP POLICY IF EXISTS "org_member_insert_carpetas" ON carpetas;
-- DROP POLICY IF EXISTS "org_member_update_carpetas" ON carpetas;
-- DROP POLICY IF EXISTS "org_member_delete_carpetas" ON carpetas;
-- DROP POLICY IF EXISTS "service_role_all_carpetas" ON carpetas;
-- ALTER TABLE carpetas DISABLE ROW LEVEL SECURITY;
--
-- DROP POLICY IF EXISTS "org_member_select_escrituras" ON escrituras;
-- DROP POLICY IF EXISTS "org_member_insert_escrituras" ON escrituras;
-- DROP POLICY IF EXISTS "org_member_update_escrituras" ON escrituras;
-- DROP POLICY IF EXISTS "org_member_delete_escrituras" ON escrituras;
-- DROP POLICY IF EXISTS "service_role_all_escrituras" ON escrituras;
-- ALTER TABLE escrituras DISABLE ROW LEVEL SECURITY;
--
-- DROP POLICY IF EXISTS "org_member_select_operaciones" ON operaciones;
-- DROP POLICY IF EXISTS "org_member_insert_operaciones" ON operaciones;
-- DROP POLICY IF EXISTS "org_member_update_operaciones" ON operaciones;
-- DROP POLICY IF EXISTS "org_member_delete_operaciones" ON operaciones;
-- DROP POLICY IF EXISTS "service_role_all_operaciones" ON operaciones;
-- ALTER TABLE operaciones DISABLE ROW LEVEL SECURITY;
--
-- DROP POLICY IF EXISTS "org_member_select_participantes" ON participantes_operacion;
-- DROP POLICY IF EXISTS "org_member_insert_participantes" ON participantes_operacion;
-- DROP POLICY IF EXISTS "org_member_update_participantes" ON participantes_operacion;
-- DROP POLICY IF EXISTS "org_member_delete_participantes" ON participantes_operacion;
-- DROP POLICY IF EXISTS "service_role_all_participantes" ON participantes_operacion;
-- ALTER TABLE participantes_operacion DISABLE ROW LEVEL SECURITY;
--
-- DROP POLICY IF EXISTS "org_member_select_certificados" ON certificados;
-- DROP POLICY IF EXISTS "org_member_insert_certificados" ON certificados;
-- DROP POLICY IF EXISTS "org_member_update_certificados" ON certificados;
-- DROP POLICY IF EXISTS "org_member_delete_certificados" ON certificados;
-- DROP POLICY IF EXISTS "service_role_all_certificados" ON certificados;
-- (Re-crear las políticas permisivas originales si se desea)
--
-- DROP POLICY IF EXISTS "org_member_select_gravamenes" ON gravamenes;
-- DROP POLICY IF EXISTS "org_member_insert_gravamenes" ON gravamenes;
-- DROP POLICY IF EXISTS "org_member_update_gravamenes" ON gravamenes;
-- DROP POLICY IF EXISTS "org_member_delete_gravamenes" ON gravamenes;
-- DROP POLICY IF EXISTS "service_role_all_gravamenes" ON gravamenes;
--
-- DROP POLICY IF EXISTS "org_member_select_ingestion_jobs" ON ingestion_jobs;
-- DROP POLICY IF EXISTS "org_member_insert_ingestion_jobs" ON ingestion_jobs;
-- DROP POLICY IF EXISTS "org_member_update_ingestion_jobs" ON ingestion_jobs;
-- DROP POLICY IF EXISTS "service_role_all_ingestion_jobs" ON ingestion_jobs;
--
-- -- Eliminar org_id de carpetas
-- ALTER TABLE carpetas DROP COLUMN IF EXISTS org_id;
--
-- -- Eliminar tablas de org
-- DROP TABLE IF EXISTS organizaciones_users;
-- DROP TABLE IF EXISTS organizaciones;
--
-- COMMIT;
