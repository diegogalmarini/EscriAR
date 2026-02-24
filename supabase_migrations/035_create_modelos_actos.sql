-- ============================================================
-- 035: Tabla modelos_actos — Templates DOCX para actos notariales
-- ============================================================
-- Almacena templates generados por el Template Builder (ZIP = .docx + metadata.json).
-- Cada registro representa una plantilla Jinja2 lista para renderizar con docxtpl.
-- ============================================================

CREATE TABLE IF NOT EXISTS modelos_actos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificación del acto
  act_type          VARCHAR(80) NOT NULL,           -- "compraventa", "hipoteca", "donacion", etc.
  template_name     VARCHAR(150) NOT NULL,          -- "compraventa_inmueble_sanisidro_template"
  label             VARCHAR(150),                   -- Nombre legible: "Compraventa de Inmueble"
  description       TEXT,                           -- Descripción libre

  -- Categoría del instrumento (ESCRITURA_PUBLICA, ACTA_NOTARIAL, CERTIFICACION, etc.)
  instrument_category VARCHAR(50) DEFAULT 'ESCRITURA_PUBLICA',

  -- Versionado
  version           INTEGER DEFAULT 1,
  is_active         BOOLEAN DEFAULT true,           -- solo 1 activo por act_type+version

  -- Archivos en Storage (bucket: escrituras)
  docx_path         VARCHAR(500) NOT NULL,          -- ruta al .docx en storage, ej: "modelos_actos/compraventa/template.docx"

  -- Metadata del template (el metadata.json completo del Template Builder)
  metadata          JSONB NOT NULL,                 -- schema con required_variables[], categories_used, etc.

  -- Estadísticas derivadas del metadata
  total_variables   INTEGER NOT NULL DEFAULT 0,
  categories        TEXT[] NOT NULL DEFAULT '{}',   -- ["escritura","vendedores","compradores",...]

  -- Auditoría
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_modelos_actos_act_type ON modelos_actos (act_type);
CREATE INDEX IF NOT EXISTS idx_modelos_actos_active ON modelos_actos (act_type, is_active) WHERE is_active = true;

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_modelos_actos_modtime()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_modelos_actos_updated_at
  BEFORE UPDATE ON modelos_actos
  FOR EACH ROW EXECUTE FUNCTION update_modelos_actos_modtime();

-- RLS: Usuarios autenticados pueden leer, solo admins insertan/actualizan
ALTER TABLE modelos_actos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados leen modelos"
  ON modelos_actos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins gestionan modelos"
  ON modelos_actos FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.approval_status = 'approved'
    )
  );

-- Comentarios
COMMENT ON TABLE modelos_actos IS 'Templates DOCX Jinja2 para actos notariales, generados por el Template Builder';
COMMENT ON COLUMN modelos_actos.metadata IS 'Contenido completo del metadata.json: required_variables[], categories_used, schema_version, etc.';
COMMENT ON COLUMN modelos_actos.docx_path IS 'Ruta relativa en bucket "escrituras", ej: modelos_actos/compraventa/v1/template.docx';
