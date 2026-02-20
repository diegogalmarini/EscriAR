-- Add metadata fields for deed card
-- This migration adds missing columns needed for complete deed information display

-- Add registro column to escrituras (número de registro del escribano)
ALTER TABLE public.escrituras
ADD COLUMN IF NOT EXISTS registro TEXT;

-- Add codigo to operaciones table (número del acto registrado)
ALTER TABLE public.operaciones
ADD COLUMN IF NOT EXISTS codigo TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.escrituras.registro IS 'Número de registro del escribano que autorizó el documento';
COMMENT ON COLUMN public.operaciones.codigo IS 'Número del acto registrado';
