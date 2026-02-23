-- Hito 1.3: Ficha Completa del Comprador / Requirente
-- Agrega campos faltantes para cubrir todo lo que necesita una escritura notarial estándar.

-- Profesión u ocupación de la persona (requerida en escrituras Art. 305 CCyC)
ALTER TABLE personas ADD COLUMN IF NOT EXISTS profesion TEXT;

-- Régimen patrimonial del matrimonio (Art. 446 CCyC: COMUNIDAD o SEPARACION_BIENES)
ALTER TABLE personas ADD COLUMN IF NOT EXISTS regimen_patrimonial TEXT
  CHECK (regimen_patrimonial IS NULL OR regimen_patrimonial IN ('COMUNIDAD', 'SEPARACION_BIENES'));

-- Número de documento del cónyuge (necesario para asentimiento conyugal Art. 470 CCyC)
ALTER TABLE personas ADD COLUMN IF NOT EXISTS nro_documento_conyugal TEXT;
