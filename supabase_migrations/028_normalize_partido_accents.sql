-- Fix: Normalizar tildes en partido_id para evitar duplicados
-- "Bahía Blanca" → "Bahia Blanca" (canónico sin tildes)

UPDATE inmuebles SET partido_id = 'Bahia Blanca' WHERE partido_id = 'Bahía Blanca';
UPDATE inmuebles SET partido_id = 'Monte Hermoso' WHERE partido_id IN ('MONTE HERMOSO', 'monte hermoso');
UPDATE inmuebles SET partido_id = 'San Cayetano' WHERE partido_id IN ('SAN CAYETANO', 'san cayetano');

-- Generic: strip all accents and re-Title Case
UPDATE inmuebles SET partido_id = initcap(
    replace(replace(replace(replace(replace(
        partido_id, 'á', 'a'), 'é', 'e'), 'í', 'i'), 'ó', 'o'), 'ú', 'u')
)
WHERE partido_id ~ '[áéíóú]';
