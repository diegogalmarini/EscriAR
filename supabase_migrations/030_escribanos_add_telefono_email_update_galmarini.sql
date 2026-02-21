-- Agregar valor 'A_CARGO' al enum escribano_caracter
ALTER TYPE escribano_caracter ADD VALUE IF NOT EXISTS 'A_CARGO';

-- Agregar campos telefono y email a tabla escribanos
ALTER TABLE escribanos
ADD COLUMN IF NOT EXISTS telefono TEXT,
ADD COLUMN IF NOT EXISTS email TEXT;

-- Actualizar datos del Escribano Alejandro Atilio Galmarini con datos oficiales
-- Fuente: Colegio de Escribanos PBA (colescba.org.ar) + Boletín Oficial PBA
UPDATE escribanos
SET
    nombre_completo = 'Alejandro Atilio Galmarini',
    caracter = 'A_CARGO',
    genero_titulo = 'ESCRIBANO',
    numero_registro = '70',
    distrito_notarial = 'Bahía Blanca',
    matricula = '5317',
    domicilio_legal = 'Avenida Leandro N. Alem 176, Piso 1, Bahía Blanca (CP B8000)',
    telefono = '(0291) 453-3094 / (0291) 454-6361',
    is_default = true
WHERE nombre_completo ILIKE '%Galmarini%';
