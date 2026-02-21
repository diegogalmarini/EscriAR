-- Agregar columna JSONB para datos de representación en participantes
-- Estructura: { representa_a: string, caracter: string, poder_detalle: string }
-- Ejemplo: { "representa_a": "BANCO DE LA NACION ARGENTINA", "caracter": "Apoderado",
--            "poder_detalle": "poder general amplio conferido por escritura Nº 100..." }

ALTER TABLE participantes_operacion
ADD COLUMN IF NOT EXISTS datos_representacion JSONB DEFAULT NULL;

COMMENT ON COLUMN participantes_operacion.datos_representacion IS
'Datos de representación para apoderados: {representa_a, caracter, poder_detalle}';
