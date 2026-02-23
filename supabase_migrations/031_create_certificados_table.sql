-- 031_create_certificados_table.sql

-- Drop existing table if it exists (for debugging/development, although in production it shouldn't be re-run)
-- DROP TABLE IF EXISTS certificados;

CREATE TABLE IF NOT EXISTS certificados (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  carpeta_id UUID NOT NULL REFERENCES carpetas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (
    tipo IN (
      'DOMINIO', 
      'INHIBICION', 
      'CATASTRAL', 
      'DEUDA_MUNICIPAL', 
      'DEUDA_ARBA', 
      'RENTAS', 
      'AFIP', 
      'ANOTACIONES_PERSONALES',
      'OTRO'
    )
  ),
  estado TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK (
    estado IN (
      'PENDIENTE', 
      'SOLICITADO', 
      'RECIBIDO', 
      'VENCIDO'
    )
  ),
  fecha_solicitud DATE,
  fecha_recepcion DATE,
  fecha_vencimiento DATE,
  nro_certificado TEXT,
  organismo TEXT,
  observaciones TEXT,
  pdf_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient lookups by carpeta_id
CREATE INDEX IF NOT EXISTS idx_certificados_carpeta_id ON certificados(carpeta_id);

-- Enable RLS
ALTER TABLE certificados ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Usuarios autenticados pueden ver certificados" 
ON certificados FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Usuarios autenticados pueden crear certificados" 
ON certificados FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar sus certificados" 
ON certificados FOR UPDATE 
TO authenticated 
USING (true)
WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden eliminar certificados" 
ON certificados FOR DELETE 
TO authenticated 
USING (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_certificados_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_certificados_updated_at ON certificados;
CREATE TRIGGER trg_certificados_updated_at
BEFORE UPDATE ON certificados
FOR EACH ROW
EXECUTE FUNCTION update_certificados_updated_at();

-- Add 'CERTIFICADO' storage bucket if it doesn't exist?
-- We can reuse the 'escrituras' bucket, or create a new one. The roadmap doesn't specify,
-- but usually they can just go to the 'escrituras' bucket or we just store an external URL. 
-- We'll assume the client uploads to 'escrituras' or a new 'certificados' bucket.
