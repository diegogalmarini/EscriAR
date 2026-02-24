-- Tabla para el Seguimiento de Escrituras del Protocolo
-- Registra cada escritura autorizada durante el año (Libro de Registro)

CREATE TABLE IF NOT EXISTS protocolo_registros (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  escribania_id UUID, -- Para multi-notaría futuro
  
  -- Datos de la escritura
  nro_escritura INTEGER NOT NULL,
  folios TEXT, -- Rango como "001/005", "006/010"
  dia INTEGER,
  mes INTEGER,
  anio INTEGER DEFAULT 2026,
  
  -- Tipo de acto
  tipo_acto TEXT, -- "venta", "errose", "cont.cred. c/hip", "donacion", etc.
  es_errose BOOLEAN DEFAULT FALSE, -- Flag para folios inutilizados
  
  -- Partes
  vendedor_acreedor TEXT, -- Vendedor / Acreedor / Poderdante
  comprador_deudor TEXT, -- Comprador / Deudor / Apoderado
  
  -- Montos
  monto_usd DECIMAL(15,2),
  monto_ars DECIMAL(15,2),
  
  -- Código CESBA
  codigo_acto TEXT,
  
  -- Metadata
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índice para búsqueda rápida por año y número
CREATE INDEX IF NOT EXISTS idx_protocolo_anio_nro ON protocolo_registros(anio, nro_escritura);

-- Constraint: número de escritura único por año
ALTER TABLE protocolo_registros 
ADD CONSTRAINT uq_protocolo_nro_anio UNIQUE (nro_escritura, anio);

-- RLS: habilitar
ALTER TABLE protocolo_registros ENABLE ROW LEVEL SECURITY;

-- Política: todos los usuarios autenticados pueden CRUD
CREATE POLICY "Authenticated users can manage protocolo" ON protocolo_registros
  FOR ALL USING (auth.role() = 'authenticated');
