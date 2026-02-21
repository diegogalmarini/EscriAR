-- Normalizar partido_id a Title Case y nro_partida quitando puntos decorativos
-- Previene duplicados como "Monte Hermoso" vs "MONTE HERMOSO"

-- 1. Normalizar partido_id a Title Case (initcap en PostgreSQL)
UPDATE inmuebles
SET partido_id = initcap(partido_id)
WHERE partido_id IS NOT NULL
  AND partido_id != initcap(partido_id);

-- 2. Normalizar nro_partida: quitar puntos decorativos (miles separators)
-- "126.559" → "126559", "7.205.976" → "7205976"
UPDATE inmuebles
SET nro_partida = replace(nro_partida, '.', '')
WHERE nro_partida IS NOT NULL
  AND nro_partida LIKE '%.%'
  AND nro_partida != '000000';
