---
name: notary-property-extractor
description: Extrae la transcripción técnica literal y completa de inmuebles en escrituras argentinas, asegurando que no se corten linderos, medidas ni superficies, y gestionando saltos de página y múltiples inmuebles.
license: Proprietary
---

# Notary Property Extractor

## Overview

Esta habilidad es crítica para la redacción de nuevas escrituras. Su función es extraer el bloque de texto que describe el inmueble (Medidas, Linderos, Superficie) de manera **verbatim** (palabra por palabra), sin resumir y sin detenerse prematuramente. Resuelve el problema común de cortes de texto cuando la descripción abarca varias páginas del PDF.

## Workflow Logic

### 1. Identificación del Bloque de Inicio (Start Triggers)
El sistema debe buscar frases que denotan el inicio de una descripción técnica. Prioridad:
1.  **"UN LOTE DE TERRENO"** (o "UNA FRACCIÓN DE TERRENO").
2.  **"LA UNIDAD FUNCIONAL"** (Para Propiedad Horizontal).
3.  **"UN INMUEBLE"** / **"UNA FINCA"**.

### 2. Identificación del Bloque de Cierre (Stop Triggers)
El sistema debe capturar **TODA** la descripción técnica, incluyendo datos catastrales.
El corte debe realizarse **DESPUÉS** de:
1.  **"NOMENCLATURA CATASTRAL"** (Incluir su contenido).
2.  **"PARTIDA"** o **"MATRICULA"** (Incluir sus números).
3.  **"VALUACIÓN FISCAL"** (Incluir el monto).

El bloque termina SOLO cuando empieza una nueva cláusula legal (ej: "SEGUNDO: PRECIO", "TERCERO: DEUDAS").

**REGLA DE ORO:** NUNCA cortes en "Nomenclatura". El Escribano necesita ver la Nomenclatura dentro del bloque de transcripción.

### 3. Reglas de Limpieza (Sanitization)
* **Saltos de Línea:** Mantener los saltos de párrafo originales para la legibilidad en el UI, pero eliminar saltos de línea duros que corten oraciones a la mitad.
* **Headers/Footers:** Si el texto proviene de un PDF, intentar ignorar números de folio o encabezados de escribanos que aparezcan en medio de la descripción (ej. "--- PAGE 2 ---").

## Implementation Script (Python)

Utiliza este script para realizar la extracción robusta basada en expresiones regulares avanzadas.

```python
import re

def extract_property_description(full_text):
    """
    Extrae la descripción técnica del inmueble buscando patrones de inicio y fin.
    Soporta múltiples inmuebles si se detectan varios bloques.
    """
    
    # 1. Normalización previa (unificar espacios, mantener newlines clave)
    # Reemplazamos múltiples espacios por uno solo, pero dejamos los saltos de línea para análisis
    clean_text = re.sub(r'[ \t]+', ' ', full_text)

    # 2. Definición de Triggers
    # Inicio: Captura desde variantes narrativas o técnicas
    # Incluye preambles como "una unidad...que es parte del edificio ubicado en..."
    start_pattern = r"(?:(?:UNA|LA)\s+UNIDAD\s+FUNCIONAL|(?:UN|EL)\s+(?:LOTE|DEPARTAMENTO|INMUEBLE)|(?:UNA|LA)\s+(?:FRACCI[ÓO]N|FINCA)|QUE\s+(?:ES\s+PARTE\s+DEL|SE\s+DESIGNA|FORMA\s+PARTE)|UBICAD[OA]\s+EN)"
    
    # Fin: Busca el inicio de cláusulas administrativas NO catastrales o el final del bloque
    # Ahora somos más permisivos: Queremos que incluya Nomenclatura y Partida.
    # Detenerse ante cláusulas típicas de cierre como "SEGUNDO", "TERCERO" o firmas.
    end_pattern = r"(?=\s*(?:SEGUNDO|TERCERO|BAJO TALES CONCEPTOS|LEIDA|TITULO|ANTECEDENTES))"

    # 3. Regex Compuesta
    # Flags: re.IGNORECASE (mayúsculas/minúsculas), re.DOTALL (el punto matchea saltos de línea)
    regex = rf"({start_pattern}.*?){end_pattern}"
    
    matches = re.finditer(regex, clean_text, re.IGNORECASE | re.DOTALL)
    
    properties = []
    
    for match in matches:
        raw_desc = match.group(1).strip()
        
        # 4. Post-Procesamiento del Bloque
        # Eliminar guiones de silabeo al final de línea (ej: "propie- dad")
        processed_desc = re.sub(r'(\w+)-\s+(\w+)', r'\1\2', raw_desc)
        
        # Opcional: Eliminar artefactos de paginación si existen patrones conocidos
        # processed_desc = re.sub(r'--- PAGE \d+ ---', '', processed_desc)

        properties.append({
            "type": "TECHNICAL_DESCRIPTION",
            "content": processed_desc,
            "length": len(processed_desc)
        })

    if not properties:
        return {"error": "No property description block found using standard triggers."}

    return {
        "count": len(properties),
        "properties": properties
    }

# --- CASOS DE PRUEBA ---

# Caso 1: Escritura estándar
test_case_1 = """
...comparecen y dicen: Que VENDEN a la parte compradora UN LOTE DE TERRENO ubicado en la ciudad de Bahía Blanca,
designado como Lote Uno de la Manzana Veinte, que mide diez metros de frente por treinta de fondo,
lindando: al Norte con calle X, al Sur con Lote Dos... 
NOMENCLATURA CATASTRAL: Circunscripción I...
"""

# Caso 2: Texto con salto de página y ruido
test_case_2 = """
...objeto de este acto LA UNIDAD FUNCIONAL número DOS, ubicada en planta baja,
que consta de una superficie cubierta de cuarenta metros cuadrados,
--- PAGE 4 ---
y semicubierta de dos metros. Linda al frente con la Unidad Uno...
VALUACIÓN FISCAL: Pesos dos millones...
"""

print("--- Test 1 ---")
print(extract_property_description(test_case_1))
print("\n--- Test 2 ---")
print(extract_property_description(test_case_2))