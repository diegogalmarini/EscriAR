-- HITO 1.2: LECTURA DE CERTIFICADOS RPI
-- Tabla para registrar gravámenes, embargos, inhibiciones y medidas precautorias.

CREATE TABLE IF NOT EXISTS gravamenes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  carpeta_id UUID NOT NULL REFERENCES carpetas(id) ON DELETE CASCADE,
  inmueble_id UUID REFERENCES inmuebles(id) ON DELETE CASCADE,
  persona_id TEXT REFERENCES personas(dni) ON DELETE SET NULL,
  certificado_id UUID REFERENCES certificados(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (
    tipo IN (
      'EMBARGO',
      'HIPOTECA',
      'INHIBICION_GENERAL',
      'BIEN_DE_FAMILIA',
      'USUFRUCTO',
      'LITIS',
      'OTRO'
    )
  ),
  monto NUMERIC,
  moneda TEXT,
  autos TEXT,
  juzgado TEXT,
  fecha_inscripcion DATE,
  estado TEXT NOT NULL DEFAULT 'VIGENTE' CHECK (
    estado IN (
      'VIGENTE',
      'LEVANTADO',
      'CADUCO'
    )
  ),
  observaciones TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger para updated_at (reutilizando la función moddatetime si existe, o manualmente)
CREATE OR REPLACE FUNCTION update_modified_column() 
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_gravamenes_modtime ON gravamenes;
CREATE TRIGGER update_gravamenes_modtime
BEFORE UPDATE ON gravamenes FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_gravamenes_carpeta_id ON gravamenes(carpeta_id);
CREATE INDEX IF NOT EXISTS idx_gravamenes_inmueble_id ON gravamenes(inmueble_id);
CREATE INDEX IF NOT EXISTS idx_gravamenes_persona_id ON gravamenes(persona_id);
CREATE INDEX IF NOT EXISTS idx_gravamenes_certificado_id ON gravamenes(certificado_id);
CREATE INDEX IF NOT EXISTS idx_gravamenes_estado ON gravamenes(estado);

-- RLS (Row Level Security)
ALTER TABLE gravamenes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados pueden ver gravamenes" 
ON gravamenes FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Usuarios autenticados pueden insertar gravamenes" 
ON gravamenes FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar gravamenes" 
ON gravamenes FOR UPDATE
TO authenticated 
USING (true)
WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden eliminar gravamenes" 
ON gravamenes FOR DELETE 
TO authenticated 
USING (true);
