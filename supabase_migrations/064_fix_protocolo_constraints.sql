-- Migration 064: Fix constraints blocking protocolo extraction pipeline
--
-- Three constraints prevent the worker from creating escrituras/personas
-- when processing ESCRITURA_EXTRACT jobs from Protocolo (which has no carpeta):
--
-- 1. escrituras.carpeta_id is NOT NULL — protocolo escrituras have no carpeta
-- 2. escrituras_source_check only allows 'INGESTA' — needs 'PROTOCOLO'
-- 3. personas_origen_dato_check only allows 'IA_OCR' — needs 'IA_PROTOCOLO'

-- 1. Make carpeta_id nullable in escrituras
ALTER TABLE escrituras ALTER COLUMN carpeta_id DROP NOT NULL;

-- 2. Update source check constraint to allow 'PROTOCOLO'
ALTER TABLE escrituras DROP CONSTRAINT IF EXISTS escrituras_source_check;
ALTER TABLE escrituras ADD CONSTRAINT escrituras_source_check
  CHECK (source IN ('INGESTA', 'PROTOCOLO', 'MANUAL'));

-- 3. Update origen_dato check constraint to allow 'IA_PROTOCOLO'
ALTER TABLE personas DROP CONSTRAINT IF EXISTS personas_origen_dato_check;
ALTER TABLE personas ADD CONSTRAINT personas_origen_dato_check
  CHECK (origen_dato IN ('IA_OCR', 'IA_PROTOCOLO', 'MANUAL', 'FICHA_WEB', 'RECUPERADO'));

-- 4. Fix audit_logs.record_id to support non-UUID PKs (personas uses dni TEXT)
ALTER TABLE audit_logs ALTER COLUMN record_id TYPE TEXT USING record_id::TEXT;

-- 5. Fix audit trigger to handle personas table (uses dni instead of id)
CREATE OR REPLACE FUNCTION process_audit_log_function()
RETURNS TRIGGER AS $$
DECLARE
    current_user_id UUID;
    v_source TEXT := 'MANUAL';
    v_record_id TEXT;
BEGIN
    BEGIN
        current_user_id := auth.uid();
    EXCEPTION WHEN OTHERS THEN
        current_user_id := NULL;
    END;

    -- Determine record_id: personas uses dni, all others use id
    IF TG_TABLE_NAME = 'personas' THEN
        IF (TG_OP = 'DELETE') THEN v_record_id := OLD.dni;
        ELSE v_record_id := NEW.dni;
        END IF;
    ELSE
        IF (TG_OP = 'DELETE') THEN v_record_id := OLD.id::TEXT;
        ELSE v_record_id := NEW.id::TEXT;
        END IF;
    END IF;

    IF (TG_OP = 'DELETE') THEN
        INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by, source)
        VALUES (TG_TABLE_NAME, v_record_id, 'DELETE', row_to_json(OLD)::JSONB, NULL, current_user_id, NULL);
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        IF row_to_json(NEW)::JSONB ? 'origen_dato' THEN
            v_source := (row_to_json(NEW)::JSONB ->> 'origen_dato');
        END IF;
        INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by, source)
        VALUES (TG_TABLE_NAME, v_record_id, 'UPDATE', row_to_json(OLD)::JSONB, row_to_json(NEW)::JSONB, current_user_id, v_source);
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        IF row_to_json(NEW)::JSONB ? 'origen_dato' THEN
            v_source := (row_to_json(NEW)::JSONB ->> 'origen_dato');
        END IF;
        INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by, source)
        VALUES (TG_TABLE_NAME, v_record_id, 'INSERT', NULL, row_to_json(NEW)::JSONB, current_user_id, v_source);
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
