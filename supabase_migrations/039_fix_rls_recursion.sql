-- ============================================================
-- MIGRACIÓN 039: Fix recursión infinita en RLS
-- ============================================================
-- PROBLEMA: Las policies de carpetas/escrituras/etc hacen
--   SELECT FROM organizaciones_users, que a su vez tiene RLS
--   con policy owner_manage_memberships que hace SELECT FROM
--   organizaciones_users → recursión infinita.
--
-- SOLUCIÓN: Crear función SECURITY DEFINER (bypasea RLS)
--   para la lookup de membresía, y reescribir todas las policies.
-- ============================================================

-- ── 1. Función auxiliar SECURITY DEFINER ──
-- Esta función corre con los permisos del OWNER (postgres),
-- por lo que NO se ve afectada por las policies RLS.
CREATE OR REPLACE FUNCTION public.user_has_org_access(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organizaciones_users
    WHERE org_id = p_org_id
    AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.user_has_org_role(p_org_id uuid, p_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organizaciones_users
    WHERE org_id = p_org_id
    AND user_id = auth.uid()
    AND role = ANY(p_roles)
  );
$$;

-- Función para obtener los org_ids del usuario actual (para RPC search)
CREATE OR REPLACE FUNCTION public.user_org_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id FROM organizaciones_users
  WHERE user_id = auth.uid();
$$;

-- ── 2. Fix organizaciones_users: quitar policy recursiva ──
DROP POLICY IF EXISTS "owner_manage_memberships" ON organizaciones_users;

-- Reemplazar con policy que usa la función SECURITY DEFINER
CREATE POLICY "owner_manage_memberships" ON organizaciones_users
  FOR ALL USING (
    public.user_has_org_role(org_id, ARRAY['OWNER', 'ADMIN'])
  );

-- ── 3. Fix carpetas: reescribir policies ──
DROP POLICY IF EXISTS "org_member_select_carpetas" ON carpetas;
DROP POLICY IF EXISTS "org_member_insert_carpetas" ON carpetas;
DROP POLICY IF EXISTS "org_member_update_carpetas" ON carpetas;
DROP POLICY IF EXISTS "org_member_delete_carpetas" ON carpetas;

CREATE POLICY "org_member_select_carpetas" ON carpetas
  FOR SELECT USING (public.user_has_org_access(org_id));

CREATE POLICY "org_member_insert_carpetas" ON carpetas
  FOR INSERT WITH CHECK (public.user_has_org_access(org_id));

CREATE POLICY "org_member_update_carpetas" ON carpetas
  FOR UPDATE USING (public.user_has_org_access(org_id));

CREATE POLICY "org_member_delete_carpetas" ON carpetas
  FOR DELETE USING (public.user_has_org_role(org_id, ARRAY['OWNER', 'ADMIN']));

-- ── 4. Fix escrituras: reescribir policies ──
DROP POLICY IF EXISTS "org_member_select_escrituras" ON escrituras;
DROP POLICY IF EXISTS "org_member_insert_escrituras" ON escrituras;
DROP POLICY IF EXISTS "org_member_update_escrituras" ON escrituras;
DROP POLICY IF EXISTS "org_member_delete_escrituras" ON escrituras;

CREATE POLICY "org_member_select_escrituras" ON escrituras
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM carpetas c WHERE c.id = escrituras.carpeta_id AND public.user_has_org_access(c.org_id))
  );

CREATE POLICY "org_member_insert_escrituras" ON escrituras
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM carpetas c WHERE c.id = escrituras.carpeta_id AND public.user_has_org_access(c.org_id))
  );

CREATE POLICY "org_member_update_escrituras" ON escrituras
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM carpetas c WHERE c.id = escrituras.carpeta_id AND public.user_has_org_access(c.org_id))
  );

CREATE POLICY "org_member_delete_escrituras" ON escrituras
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM carpetas c WHERE c.id = escrituras.carpeta_id AND public.user_has_org_role(c.org_id, ARRAY['OWNER', 'ADMIN']))
  );

-- ── 5. Fix operaciones: reescribir policies ──
DROP POLICY IF EXISTS "org_member_select_operaciones" ON operaciones;
DROP POLICY IF EXISTS "org_member_insert_operaciones" ON operaciones;
DROP POLICY IF EXISTS "org_member_update_operaciones" ON operaciones;
DROP POLICY IF EXISTS "org_member_delete_operaciones" ON operaciones;

CREATE POLICY "org_member_select_operaciones" ON operaciones
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM escrituras e
      JOIN carpetas c ON c.id = e.carpeta_id
      WHERE e.id = operaciones.escritura_id
      AND public.user_has_org_access(c.org_id)
    )
  );

CREATE POLICY "org_member_insert_operaciones" ON operaciones
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM escrituras e
      JOIN carpetas c ON c.id = e.carpeta_id
      WHERE e.id = operaciones.escritura_id
      AND public.user_has_org_access(c.org_id)
    )
  );

CREATE POLICY "org_member_update_operaciones" ON operaciones
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM escrituras e
      JOIN carpetas c ON c.id = e.carpeta_id
      WHERE e.id = operaciones.escritura_id
      AND public.user_has_org_access(c.org_id)
    )
  );

CREATE POLICY "org_member_delete_operaciones" ON operaciones
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM escrituras e
      JOIN carpetas c ON c.id = e.carpeta_id
      WHERE e.id = operaciones.escritura_id
      AND public.user_has_org_role(c.org_id, ARRAY['OWNER', 'ADMIN'])
    )
  );

-- ── 6. Fix participantes_operacion: reescribir policies ──
DROP POLICY IF EXISTS "org_member_select_participantes" ON participantes_operacion;
DROP POLICY IF EXISTS "org_member_insert_participantes" ON participantes_operacion;
DROP POLICY IF EXISTS "org_member_update_participantes" ON participantes_operacion;
DROP POLICY IF EXISTS "org_member_delete_participantes" ON participantes_operacion;

CREATE POLICY "org_member_select_participantes" ON participantes_operacion
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM operaciones o
      JOIN escrituras e ON e.id = o.escritura_id
      JOIN carpetas c ON c.id = e.carpeta_id
      WHERE o.id = participantes_operacion.operacion_id
      AND public.user_has_org_access(c.org_id)
    )
  );

CREATE POLICY "org_member_insert_participantes" ON participantes_operacion
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM operaciones o
      JOIN escrituras e ON e.id = o.escritura_id
      JOIN carpetas c ON c.id = e.carpeta_id
      WHERE o.id = participantes_operacion.operacion_id
      AND public.user_has_org_access(c.org_id)
    )
  );

CREATE POLICY "org_member_update_participantes" ON participantes_operacion
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM operaciones o
      JOIN escrituras e ON e.id = o.escritura_id
      JOIN carpetas c ON c.id = e.carpeta_id
      WHERE o.id = participantes_operacion.operacion_id
      AND public.user_has_org_access(c.org_id)
    )
  );

CREATE POLICY "org_member_delete_participantes" ON participantes_operacion
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM operaciones o
      JOIN escrituras e ON e.id = o.escritura_id
      JOIN carpetas c ON c.id = e.carpeta_id
      WHERE o.id = participantes_operacion.operacion_id
      AND public.user_has_org_role(c.org_id, ARRAY['OWNER', 'ADMIN'])
    )
  );

-- ── 7. Fix certificados: reescribir policies ──
DROP POLICY IF EXISTS "org_member_select_certificados" ON certificados;
DROP POLICY IF EXISTS "org_member_insert_certificados" ON certificados;
DROP POLICY IF EXISTS "org_member_update_certificados" ON certificados;
DROP POLICY IF EXISTS "org_member_delete_certificados" ON certificados;

CREATE POLICY "org_member_select_certificados" ON certificados
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM carpetas c WHERE c.id = certificados.carpeta_id AND public.user_has_org_access(c.org_id)
    )
  );

CREATE POLICY "org_member_insert_certificados" ON certificados
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM carpetas c WHERE c.id = certificados.carpeta_id AND public.user_has_org_access(c.org_id)
    )
  );

CREATE POLICY "org_member_update_certificados" ON certificados
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM carpetas c WHERE c.id = certificados.carpeta_id AND public.user_has_org_access(c.org_id)
    )
  );

CREATE POLICY "org_member_delete_certificados" ON certificados
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM carpetas c WHERE c.id = certificados.carpeta_id AND public.user_has_org_role(c.org_id, ARRAY['OWNER', 'ADMIN']))
  );

-- ── 8. Fix gravamenes: reescribir policies ──
DROP POLICY IF EXISTS "org_member_select_gravamenes" ON gravamenes;
DROP POLICY IF EXISTS "org_member_insert_gravamenes" ON gravamenes;
DROP POLICY IF EXISTS "org_member_update_gravamenes" ON gravamenes;
DROP POLICY IF EXISTS "org_member_delete_gravamenes" ON gravamenes;

CREATE POLICY "org_member_select_gravamenes" ON gravamenes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM certificados cert
      JOIN carpetas c ON c.id = cert.carpeta_id
      WHERE cert.id = gravamenes.certificado_id
      AND public.user_has_org_access(c.org_id)
    )
  );

CREATE POLICY "org_member_insert_gravamenes" ON gravamenes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM certificados cert
      JOIN carpetas c ON c.id = cert.carpeta_id
      WHERE cert.id = gravamenes.certificado_id
      AND public.user_has_org_access(c.org_id)
    )
  );

CREATE POLICY "org_member_update_gravamenes" ON gravamenes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM certificados cert
      JOIN carpetas c ON c.id = cert.carpeta_id
      WHERE cert.id = gravamenes.certificado_id
      AND public.user_has_org_access(c.org_id)
    )
  );

CREATE POLICY "org_member_delete_gravamenes" ON gravamenes
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM certificados cert
      JOIN carpetas c ON c.id = cert.carpeta_id
      WHERE cert.id = gravamenes.certificado_id
      AND public.user_has_org_role(c.org_id, ARRAY['OWNER', 'ADMIN'])
    )
  );

-- ── 9. Fix ingestion_jobs: reescribir policies ──
DROP POLICY IF EXISTS "org_member_select_ingestion_jobs" ON ingestion_jobs;
DROP POLICY IF EXISTS "org_member_insert_ingestion_jobs" ON ingestion_jobs;
DROP POLICY IF EXISTS "org_member_update_ingestion_jobs" ON ingestion_jobs;

CREATE POLICY "org_member_select_ingestion_jobs" ON ingestion_jobs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM carpetas c WHERE c.id = ingestion_jobs.carpeta_id AND public.user_has_org_access(c.org_id)
    )
  );

CREATE POLICY "org_member_insert_ingestion_jobs" ON ingestion_jobs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM carpetas c WHERE c.id = ingestion_jobs.carpeta_id AND public.user_has_org_access(c.org_id)
    )
  );

CREATE POLICY "org_member_update_ingestion_jobs" ON ingestion_jobs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM carpetas c WHERE c.id = ingestion_jobs.carpeta_id AND public.user_has_org_access(c.org_id)
    )
  );

-- ── 10. Fix organizaciones: reescribir policy ──
DROP POLICY IF EXISTS "org_member_select_org" ON organizaciones;

CREATE POLICY "org_member_select_org" ON organizaciones
  FOR SELECT USING (public.user_has_org_access(id));

-- ── 11. search_carpetas ──
-- NO se reescribe: la versión de 038 ya tiene el filtro por org correcto.
-- La RPC es SECURITY DEFINER así que no se ve afectada por las policies.

-- ── POSTCHECKS ──
-- Ejecutar después de aplicar:
-- SELECT public.user_has_org_access('a0000000-0000-0000-0000-000000000001');
-- SELECT * FROM carpetas LIMIT 1;  -- No debe dar recursion error
-- SELECT * FROM search_carpetas('', 5, 0);
