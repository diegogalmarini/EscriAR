-- ============================================================
-- 054: Tabla borradores — Documentos y presupuestos borrador
-- ============================================================
-- Borradores creados desde el dashboard sin carpeta asociada.
-- Pueden ser documentos (basados en templates) o presupuestos.
-- Luego se pueden vincular a una carpeta nueva o existente.
-- ============================================================

CREATE TABLE IF NOT EXISTS borradores (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Tipo: DOCUMENTO o PRESUPUESTO
  tipo              VARCHAR(20) NOT NULL CHECK (tipo IN ('DOCUMENTO', 'PRESUPUESTO')),

  -- Nombre descriptivo del borrador
  nombre            VARCHAR(250) NOT NULL DEFAULT 'Sin título',

  -- Categoría del instrumento (solo para tipo=DOCUMENTO)
  instrument_category VARCHAR(50),   -- ESCRITURA_PUBLICA, INSTRUMENTO_PRIVADO, null para hoja en blanco

  -- Tipo de acto (compraventa, hipoteca, etc.)
  act_type          VARCHAR(80),

  -- Contenido del documento (HTML/texto enriquecido para documentos, JSON para presupuestos)
  contenido         TEXT,

  -- Metadata adicional (variables del template, datos del presupuesto, etc.)
  metadata          JSONB DEFAULT '{}',

  -- Referencia al modelo usado como base (null si hoja en blanco)
  modelo_id         UUID REFERENCES modelos_actos(id) ON DELETE SET NULL,

  -- Carpeta asociada (null hasta que se vincule)
  carpeta_id        UUID REFERENCES carpetas(id) ON DELETE SET NULL,

  -- Autor
  author_id         UUID NOT NULL REFERENCES auth.users(id),
  org_id            UUID NOT NULL,

  -- Auditoría
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_borradores_org ON borradores (org_id);
CREATE INDEX IF NOT EXISTS idx_borradores_tipo ON borradores (tipo);
CREATE INDEX IF NOT EXISTS idx_borradores_author ON borradores (author_id);
CREATE INDEX IF NOT EXISTS idx_borradores_carpeta ON borradores (carpeta_id) WHERE carpeta_id IS NOT NULL;

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_borradores_modtime()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_borradores_updated_at
  BEFORE UPDATE ON borradores
  FOR EACH ROW EXECUTE FUNCTION update_borradores_modtime();

-- RLS
ALTER TABLE borradores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios leen borradores de su org"
  ON borradores FOR SELECT
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Usuarios gestionan borradores de su org"
  ON borradores FOR ALL
  TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM user_profiles WHERE id = auth.uid()
    )
  );

COMMENT ON TABLE borradores IS 'Documentos y presupuestos borrador creados desde el dashboard, sin carpeta asociada inicialmente';
