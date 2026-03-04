-- ============================================================
-- MIGRACIÓN 040: ETAPA 3 — Apuntes + Sugerencias
-- ============================================================
-- Base AI-First sin IA: tablas apuntes y sugerencias con RLS
-- por organización, índices para queries frecuentes.
-- ============================================================

-- ══════════════════════════════════════════════════════════
-- PRECHECKS
-- ══════════════════════════════════════════════════════════
-- Ejecutar antes para validar pre-condiciones:
--
-- 1) Verificar que existen las tablas requeridas
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
--   AND table_name IN ('organizaciones', 'carpetas', 'organizaciones_users');
-- Esperado: 3 filas
--
-- 2) Verificar que las funciones SECURITY DEFINER existen (migración 039)
-- SELECT proname FROM pg_proc
-- WHERE proname IN ('user_has_org_access', 'user_has_org_role', 'user_org_ids');
-- Esperado: 3 filas
--
-- 3) Verificar que apuntes y sugerencias NO existen aún
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
--   AND table_name IN ('apuntes', 'sugerencias');
-- Esperado: 0 filas
-- ══════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════
-- APPLY
-- ══════════════════════════════════════════════════════════

-- ── 1. Tabla apuntes ──
CREATE TABLE apuntes (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      uuid NOT NULL REFERENCES organizaciones(id),
    carpeta_id  uuid NOT NULL REFERENCES carpetas(id) ON DELETE CASCADE,
    contenido   text NOT NULL,
    origen      text NOT NULL DEFAULT 'texto',
    autor_id    uuid REFERENCES auth.users(id),
    ia_status   text NOT NULL DEFAULT 'PENDIENTE'
                CHECK (ia_status IN ('PENDIENTE', 'PROCESANDO', 'COMPLETADO', 'ERROR')),
    ia_last_error text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_apuntes_carpeta_created ON apuntes(carpeta_id, created_at DESC);
CREATE INDEX idx_apuntes_org ON apuntes(org_id);

-- ── 2. Tabla sugerencias ──
CREATE TABLE sugerencias (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          uuid NOT NULL REFERENCES organizaciones(id),
    carpeta_id      uuid NOT NULL REFERENCES carpetas(id) ON DELETE CASCADE,
    apunte_id       uuid REFERENCES apuntes(id) ON DELETE CASCADE,
    tipo            text NOT NULL,
    payload         jsonb NOT NULL DEFAULT '{}',
    evidencia_texto text,
    evidencia_ref   jsonb,
    confianza       text CHECK (confianza IN ('HIGH', 'MED', 'LOW')),
    estado          text NOT NULL DEFAULT 'PROPOSED'
                    CHECK (estado IN ('PROPOSED', 'ACCEPTED', 'REJECTED')),
    decided_by      uuid REFERENCES auth.users(id),
    decided_at      timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sugerencias_carpeta_created ON sugerencias(carpeta_id, created_at DESC);
CREATE INDEX idx_sugerencias_apunte ON sugerencias(apunte_id);
CREATE INDEX idx_sugerencias_org ON sugerencias(org_id);
CREATE INDEX idx_sugerencias_estado ON sugerencias(estado);

-- ── 3. Trigger updated_at ──
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_apuntes_updated_at
    BEFORE UPDATE ON apuntes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_sugerencias_updated_at
    BEFORE UPDATE ON sugerencias
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── 4. RLS en apuntes ──
ALTER TABLE apuntes ENABLE ROW LEVEL SECURITY;

-- Miembros de la org pueden SELECT
CREATE POLICY "org_member_select_apuntes" ON apuntes
    FOR SELECT USING (public.user_has_org_access(org_id));

-- Miembros de la org pueden INSERT
CREATE POLICY "org_member_insert_apuntes" ON apuntes
    FOR INSERT WITH CHECK (public.user_has_org_access(org_id));

-- Miembros de la org pueden UPDATE (cualquier miembro, no solo autor)
-- Decisión: permitir a cualquier miembro editar apuntes de la org
CREATE POLICY "org_member_update_apuntes" ON apuntes
    FOR UPDATE USING (public.user_has_org_access(org_id));

-- DELETE solo OWNER/ADMIN
CREATE POLICY "org_member_delete_apuntes" ON apuntes
    FOR DELETE USING (public.user_has_org_role(org_id, ARRAY['OWNER', 'ADMIN']));

-- service_role bypass
CREATE POLICY "service_role_all_apuntes" ON apuntes
    FOR ALL USING (auth.role() = 'service_role');

-- ── 5. RLS en sugerencias ──
ALTER TABLE sugerencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_member_select_sugerencias" ON sugerencias
    FOR SELECT USING (public.user_has_org_access(org_id));

CREATE POLICY "org_member_insert_sugerencias" ON sugerencias
    FOR INSERT WITH CHECK (public.user_has_org_access(org_id));

-- Miembros pueden UPDATE (aceptar/rechazar sugerencias)
CREATE POLICY "org_member_update_sugerencias" ON sugerencias
    FOR UPDATE USING (public.user_has_org_access(org_id));

-- DELETE solo OWNER/ADMIN
CREATE POLICY "org_member_delete_sugerencias" ON sugerencias
    FOR DELETE USING (public.user_has_org_role(org_id, ARRAY['OWNER', 'ADMIN']));

-- service_role bypass
CREATE POLICY "service_role_all_sugerencias" ON sugerencias
    FOR ALL USING (auth.role() = 'service_role');

-- ══════════════════════════════════════════════════════════
-- POSTCHECKS
-- ══════════════════════════════════════════════════════════
-- Ejecutar después de aplicar:
--
-- 1) Verificar tablas creadas
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
--   AND table_name IN ('apuntes', 'sugerencias');
-- Esperado: 2 filas
--
-- 2) Verificar RLS está habilitado
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public' AND tablename IN ('apuntes', 'sugerencias');
-- Esperado: ambas con rowsecurity = true
--
-- 3) Verificar políticas
-- SELECT tablename, policyname FROM pg_policies
-- WHERE schemaname = 'public' AND tablename IN ('apuntes', 'sugerencias')
-- ORDER BY tablename, policyname;
-- Esperado: 5 policies por tabla (select, insert, update, delete, service_role)
--
-- 4) Verificar índices
-- SELECT indexname FROM pg_indexes
-- WHERE schemaname = 'public' AND tablename IN ('apuntes', 'sugerencias');
-- Esperado: idx_apuntes_carpeta_created, idx_apuntes_org,
--           idx_sugerencias_carpeta_created, idx_sugerencias_apunte,
--           idx_sugerencias_org, idx_sugerencias_estado + PKs
--
-- 5) Test funcional: insertar y leer un apunte (como service_role)
-- INSERT INTO apuntes (org_id, carpeta_id, contenido, autor_id)
-- VALUES (
--   'a0000000-0000-0000-0000-000000000001',
--   (SELECT id FROM carpetas LIMIT 1),
--   'Test apunte ETAPA 3',
--   (SELECT id FROM auth.users LIMIT 1)
-- ) RETURNING id;
-- DELETE FROM apuntes WHERE contenido = 'Test apunte ETAPA 3';
-- ══════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════
-- ROLLBACK (ejecutar solo si se necesita revertir)
-- ══════════════════════════════════════════════════════════
-- DROP POLICY IF EXISTS "service_role_all_sugerencias" ON sugerencias;
-- DROP POLICY IF EXISTS "org_member_delete_sugerencias" ON sugerencias;
-- DROP POLICY IF EXISTS "org_member_update_sugerencias" ON sugerencias;
-- DROP POLICY IF EXISTS "org_member_insert_sugerencias" ON sugerencias;
-- DROP POLICY IF EXISTS "org_member_select_sugerencias" ON sugerencias;
-- DROP POLICY IF EXISTS "service_role_all_apuntes" ON apuntes;
-- DROP POLICY IF EXISTS "org_member_delete_apuntes" ON apuntes;
-- DROP POLICY IF EXISTS "org_member_update_apuntes" ON apuntes;
-- DROP POLICY IF EXISTS "org_member_insert_apuntes" ON apuntes;
-- DROP POLICY IF EXISTS "org_member_select_apuntes" ON apuntes;
-- DROP TRIGGER IF EXISTS trg_sugerencias_updated_at ON sugerencias;
-- DROP TRIGGER IF EXISTS trg_apuntes_updated_at ON apuntes;
-- DROP TABLE IF EXISTS sugerencias;
-- DROP TABLE IF EXISTS apuntes;
