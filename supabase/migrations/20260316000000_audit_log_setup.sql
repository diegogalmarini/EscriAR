-- 00_audit_log_setup.sql

-- 1. Create the Audit Logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data JSONB,
    new_data JSONB,
    changed_by UUID, -- References auth.users(id), can be null if internal service
    source TEXT, -- 'IA_OCR', 'MANUAL', etc. extracted from payload
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster querying per record or table
CREATE INDEX IF NOT EXISTS audit_logs_record_id_idx ON public.audit_logs(record_id);
CREATE INDEX IF NOT EXISTS audit_logs_table_name_idx ON public.audit_logs(table_name);

-- 2. Create the Trigger Function
CREATE OR REPLACE FUNCTION public.process_audit_log_function()
RETURNS TRIGGER AS $$
DECLARE
    current_user_id UUID;
    v_source TEXT := 'MANUAL';
BEGIN
    -- Intentamos obtener el usuario actual desde el JWT de Supabase
    BEGIN
        current_user_id := auth.uid();
    EXCEPTION WHEN OTHERS THEN
        current_user_id := NULL;
    END;

    IF (TG_OP = 'DELETE') THEN
        INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by, source)
        VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', row_to_json(OLD)::JSONB, NULL, current_user_id, NULL);
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Intentar extraer 'origen_dato' si existe en NEW_DATA
        IF row_to_json(NEW)::JSONB ? 'origen_dato' THEN
            v_source := (row_to_json(NEW)::JSONB ->> 'origen_dato');
        END IF;

        INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by, source)
        VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', row_to_json(OLD)::JSONB, row_to_json(NEW)::JSONB, current_user_id, v_source);
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
         -- Intentar extraer 'origen_dato' si existe en NEW_DATA
        IF row_to_json(NEW)::JSONB ? 'origen_dato' THEN
            v_source := (row_to_json(NEW)::JSONB ->> 'origen_dato');
        END IF;

        INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by, source)
        VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', NULL, row_to_json(NEW)::JSONB, current_user_id, v_source);
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attach Triggers to Tables (IF NOT EXISTS pattern is tricky in vanilla PG but we recreate them)

-- PERONAS
DROP TRIGGER IF EXISTS trg_audit_personas ON public.personas;
CREATE TRIGGER trg_audit_personas
AFTER INSERT OR UPDATE OR DELETE ON public.personas
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log_function();

-- INMUEBLES
DROP TRIGGER IF EXISTS trg_audit_inmuebles ON public.inmuebles;
CREATE TRIGGER trg_audit_inmuebles
AFTER INSERT OR UPDATE OR DELETE ON public.inmuebles
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log_function();

-- OPERACIONES
DROP TRIGGER IF EXISTS trg_audit_operaciones ON public.operaciones;
CREATE TRIGGER trg_audit_operaciones
AFTER INSERT OR UPDATE OR DELETE ON public.operaciones
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log_function();

-- CARPETAS
DROP TRIGGER IF EXISTS trg_audit_carpetas ON public.carpetas;
CREATE TRIGGER trg_audit_carpetas
AFTER INSERT OR UPDATE OR DELETE ON public.carpetas
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log_function();

-- ESCRITURAS
DROP TRIGGER IF EXISTS trg_audit_escrituras ON public.escrituras;
CREATE TRIGGER trg_audit_escrituras
AFTER INSERT OR UPDATE OR DELETE ON public.escrituras
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log_function();

-- PROTOCOLO_REGISTROS
DROP TRIGGER IF EXISTS trg_audit_protocolo_registros ON public.protocolo_registros;
CREATE TRIGGER trg_audit_protocolo_registros
AFTER INSERT OR UPDATE OR DELETE ON public.protocolo_registros
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log_function();

-- DOCUMENTOS
DROP TRIGGER IF EXISTS trg_audit_documentos ON public.documentos;
CREATE TRIGGER trg_audit_documentos
AFTER INSERT OR UPDATE OR DELETE ON public.documentos
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log_function();

-- PRESUPUESTOS
DROP TRIGGER IF EXISTS trg_audit_presupuestos ON public.presupuestos;
CREATE TRIGGER trg_audit_presupuestos
AFTER INSERT OR UPDATE OR DELETE ON public.presupuestos
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log_function();

-- BORRADORES
DROP TRIGGER IF EXISTS trg_audit_borradores ON public.borradores;
CREATE TRIGGER trg_audit_borradores
AFTER INSERT OR UPDATE OR DELETE ON public.borradores
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log_function();

-- Enable RLS and setup policies for audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can SELECT their logs, or service role can select all
-- In this case we can allow SELECT for authenticated but maybe restrict
DROP POLICY IF EXISTS "Enable read access for authenticated users to audit_logs" ON public.audit_logs;
CREATE POLICY "Enable read access for authenticated users to audit_logs" 
ON public.audit_logs FOR SELECT 
TO authenticated 
USING (true);

-- No explicit INSERT/UPDATE/DELETE access allowed from the API Client directly, 
-- ONLY the triggers running as SECURITY DEFINER can insert into audit_logs.
