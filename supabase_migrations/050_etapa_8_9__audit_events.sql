-- ============================================================
-- Migración 050 — ET8+ET9: Tabla audit_events
-- Registro auditable de acciones sobre carpetas y entidades.
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    org_id      UUID NOT NULL REFERENCES organizaciones(id) ON DELETE CASCADE,
    actor_id    UUID NOT NULL,                                  -- auth.users.id
    actor_email TEXT,                                           -- snapshot del email al momento
    action      TEXT NOT NULL,                                  -- ej: FOLDER_CREATED, NOTE_CREATED, CERT_CONFIRMED, etc.
    entity_type TEXT NOT NULL,                                  -- carpeta, apunte, certificado, actuacion, protocolo, etc.
    entity_id   TEXT,                                           -- UUID de la entidad afectada
    carpeta_id  UUID REFERENCES carpetas(id) ON DELETE SET NULL,-- carpeta relacionada (null si es acción global)
    summary     TEXT,                                           -- línea descriptiva legible
    metadata    JSONB DEFAULT '{}'::jsonb,                      -- datos extra (before/after, evidencia, etc.)
    result      TEXT DEFAULT 'OK' CHECK (result IN ('OK', 'ERROR'))
);

-- Índices para queries frecuentes
CREATE INDEX IF NOT EXISTS idx_audit_events_carpeta ON audit_events(carpeta_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_org     ON audit_events(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor   ON audit_events(actor_id, created_at DESC);

-- RLS: solo miembros de la org pueden leer sus propios eventos
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_events_org_read" ON audit_events
    FOR SELECT
    USING (
        org_id IN (
            SELECT ou.org_id FROM organizaciones_users ou
            WHERE ou.user_id = auth.uid()
        )
    );

-- Solo service_role inserta (desde Server Actions via supabaseAdmin)
CREATE POLICY "audit_events_service_insert" ON audit_events
    FOR INSERT
    WITH CHECK (true);

-- Nota: las inserciones se hacen con supabaseAdmin (service_role),
-- que bypassa RLS. La policy de INSERT es permisiva como fallback.
