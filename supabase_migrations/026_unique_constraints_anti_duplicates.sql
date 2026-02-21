-- CRITICAL: Constraints anti-duplicados para sistema notarial
-- Previene duplicación de inmuebles, participantes y escrituras

-- 1. PARTICIPANTES: misma persona no puede estar dos veces en la misma operación
ALTER TABLE participantes_operacion
DROP CONSTRAINT IF EXISTS unique_participant_per_operation;

ALTER TABLE participantes_operacion
ADD CONSTRAINT unique_participant_per_operation
UNIQUE (operacion_id, persona_id);

-- 2. INMUEBLES: misma partida en el mismo partido no puede existir dos veces
-- Usamos partial unique (solo cuando nro_partida no es null/vacío)
CREATE UNIQUE INDEX IF NOT EXISTS unique_inmueble_partida
ON inmuebles (partido_id, nro_partida)
WHERE nro_partida IS NOT NULL AND nro_partida != '' AND nro_partida != '000000';

-- 3. ESCRITURAS: mismo protocolo + registro no puede existir dos veces
CREATE UNIQUE INDEX IF NOT EXISTS unique_escritura_protocolo
ON escrituras (nro_protocolo, registro)
WHERE nro_protocolo IS NOT NULL AND registro IS NOT NULL;
