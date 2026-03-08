-- ============================================================
-- Migración 052: Sistema de Presupuestos Notariales
-- Etapa 13: Presupuesto automático basado en acto + operación
-- ============================================================

-- Tabla principal de presupuestos (1 por carpeta, versiones)
CREATE TABLE IF NOT EXISTS presupuestos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  carpeta_id    UUID NOT NULL REFERENCES carpetas(id) ON DELETE CASCADE,
  org_id        UUID NOT NULL REFERENCES organizations(id),
  version       INT NOT NULL DEFAULT 1,

  -- Metadata del cálculo
  codigo_acto   TEXT,                    -- "100-00"
  tipo_acto     TEXT,                    -- "COMPRAVENTA"
  monto_operacion DECIMAL(15,2) NOT NULL DEFAULT 0,
  moneda        VARCHAR(5) NOT NULL DEFAULT 'ARS',
  cotizacion_usd DECIMAL(12,4),
  valuacion_fiscal DECIMAL(15,2) NOT NULL DEFAULT 0,
  base_imponible DECIMAL(15,2) NOT NULL DEFAULT 0,

  -- Flags usados en el cálculo
  es_vivienda_unica  BOOLEAN NOT NULL DEFAULT FALSE,
  tipo_inmueble      VARCHAR(20) DEFAULT 'EDIFICADO',  -- EDIFICADO | BALDIO | RURAL
  es_banco_provincia BOOLEAN DEFAULT FALSE,
  fecha_adquisicion  DATE,
  partido            TEXT,
  urgencia_rpi       VARCHAR(15) DEFAULT 'simple',

  -- Totales
  total_ars     DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_usd     DECIMAL(15,2),

  -- Workflow
  estado        VARCHAR(20) NOT NULL DEFAULT 'BORRADOR',
  -- BORRADOR → ENVIADO → ACEPTADO → VENCIDO
  fecha_envio   TIMESTAMPTZ,
  fecha_aceptacion TIMESTAMPTZ,
  valido_hasta  TIMESTAMPTZ,            -- TTL del presupuesto
  notas         TEXT,
  alertas       JSONB DEFAULT '[]'::JSONB,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by    UUID REFERENCES auth.users(id)
);

-- Líneas de detalle del presupuesto
CREATE TABLE IF NOT EXISTS presupuesto_lineas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  presupuesto_id  UUID NOT NULL REFERENCES presupuestos(id) ON DELETE CASCADE,

  rubro           VARCHAR(60) NOT NULL,    -- "SELLOS_PBA", "ITI", "HONORARIOS", etc.
  concepto        TEXT NOT NULL,            -- Texto descriptivo
  categoria       VARCHAR(20) NOT NULL,    -- IMPUESTO | TASA | HONORARIO | APORTE | CERTIFICADO | GASTO_ADMIN

  base_calculo    DECIMAL(15,2) DEFAULT 0,
  alicuota        DECIMAL(8,6),            -- NULL = monto fijo
  monto           DECIMAL(15,2) NOT NULL DEFAULT 0,

  pagador         VARCHAR(20) NOT NULL DEFAULT 'COMUN',
  -- COMPRADOR | VENDEDOR | DEUDOR | ACREEDOR | NOTARIO | COMUN | ESCRIBANIA
  notas           TEXT,

  orden           INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_presupuestos_carpeta ON presupuestos(carpeta_id);
CREATE INDEX IF NOT EXISTS idx_presupuestos_org     ON presupuestos(org_id);
CREATE INDEX IF NOT EXISTS idx_presupuestos_estado  ON presupuestos(estado);
CREATE INDEX IF NOT EXISTS idx_presupuesto_lineas_presupuesto ON presupuesto_lineas(presupuesto_id);

-- RLS
ALTER TABLE presupuestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE presupuesto_lineas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "presupuestos_org_access" ON presupuestos
  FOR ALL USING (
    org_id IN (
      SELECT org_id FROM user_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "presupuesto_lineas_access" ON presupuesto_lineas
  FOR ALL USING (
    presupuesto_id IN (
      SELECT id FROM presupuestos
      WHERE org_id IN (SELECT org_id FROM user_profiles WHERE user_id = auth.uid())
    )
  );

-- Trigger updated_at
CREATE TRIGGER set_presupuestos_updated_at
  BEFORE UPDATE ON presupuestos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
