-- Migration 065: Fix RLS for PROTOCOLO escrituras (carpeta_id IS NULL)
--
-- Problem: RLS policies on escrituras require carpeta_id to match a carpeta,
-- but PROTOCOLO escrituras have carpeta_id = NULL (they come from historical
-- protocol extraction, not from carpetas). This makes them invisible to the
-- regular supabase client, breaking the Inmuebles tab and other queries.
--
-- Fix: Add OR condition for escrituras where source = 'PROTOCOLO' and the
-- user belongs to any org (protocolo data is org-wide).

-- Drop existing select policy
DROP POLICY IF EXISTS "org_member_select_escrituras" ON escrituras;

-- Recreate: allow carpeta-based access OR protocolo source for org members
CREATE POLICY "org_member_select_escrituras" ON escrituras
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM carpetas c WHERE c.id = escrituras.carpeta_id AND public.user_has_org_access(c.org_id))
    OR (escrituras.source = 'PROTOCOLO' AND escrituras.carpeta_id IS NULL)
  );

-- Also fix update policy (needed for confirming extractions)
DROP POLICY IF EXISTS "org_member_update_escrituras" ON escrituras;

CREATE POLICY "org_member_update_escrituras" ON escrituras
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM carpetas c WHERE c.id = escrituras.carpeta_id AND public.user_has_org_access(c.org_id))
    OR (escrituras.source = 'PROTOCOLO' AND escrituras.carpeta_id IS NULL)
  );

-- Also fix insert policy for creating protocolo escrituras from frontend
DROP POLICY IF EXISTS "org_member_insert_escrituras" ON escrituras;

CREATE POLICY "org_member_insert_escrituras" ON escrituras
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM carpetas c WHERE c.id = escrituras.carpeta_id AND public.user_has_org_access(c.org_id))
    OR (escrituras.source = 'PROTOCOLO' AND escrituras.carpeta_id IS NULL)
  );

-- Fix operaciones RLS too — operaciones linked to protocolo escrituras
-- also need to be visible
DROP POLICY IF EXISTS "org_member_select_operaciones" ON operaciones;

CREATE POLICY "org_member_select_operaciones" ON operaciones
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM escrituras e
      JOIN carpetas c ON c.id = e.carpeta_id
      WHERE e.id = operaciones.escritura_id
      AND public.user_has_org_access(c.org_id)
    )
    OR EXISTS (
      SELECT 1 FROM escrituras e
      WHERE e.id = operaciones.escritura_id
      AND e.source = 'PROTOCOLO'
      AND e.carpeta_id IS NULL
    )
  );

-- Fix participantes_operacion RLS — same issue
DROP POLICY IF EXISTS "org_member_select_participantes" ON participantes_operacion;

CREATE POLICY "org_member_select_participantes" ON participantes_operacion
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM operaciones o
      JOIN escrituras e ON e.id = o.escritura_id
      JOIN carpetas c ON c.id = e.carpeta_id
      WHERE o.id = participantes_operacion.operacion_id
      AND public.user_has_org_access(c.org_id)
    )
    OR EXISTS (
      SELECT 1 FROM operaciones o
      JOIN escrituras e ON e.id = o.escritura_id
      WHERE o.id = participantes_operacion.operacion_id
      AND e.source = 'PROTOCOLO'
      AND e.carpeta_id IS NULL
    )
  );
