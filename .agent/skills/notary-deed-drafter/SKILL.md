---
name: notary-deed-drafter
description: Genera el texto jurídico de escrituras públicas (Compraventas, Donaciones, Poderes) ensamblando cláusulas dinámicas basadas en el 'Tipo de Acto' y las 'Condiciones de las Partes'. Maneja la conversión de números a letras, la inyección de variables y la lógica condicional (ej. agregar cláusula de usufructo o asentimiento).
license: Proprietary
---

# Notary Deed Drafter

## Overview

Esta habilidad es el "Redactor" del sistema. Convierte los datos estructurados y validados (JSON) en un documento jurídico legalmente válido. No utiliza plantillas estáticas simples; utiliza **Composición Dinámica de Documentos**.

Utiliza esta habilidad cuando el usuario solicite "Redactar", "Generar Borrador" o "Crear Escritura".

## Workflow Logic

### 1. Lectura del Modelo de Acto (Plantilla)
Antes de redactar la escritura, DEBES siempre buscar el archivo base correspondiente al tipo de acto en el directorio `.agent/resources/modelos_actos/`. 
Las plantillas pueden estar en formato Markdown (`.md`) o estructuradas en Word (`.docx`).

**Si el modelo es `.docx` (Mantenimiento de Formato Estricto):**
No intentes convertir el `.docx` a `.md` para procesarlo, ya que esto destruiría el formato original (interlineado, tabulaciones, negritas) exigido por el escribano.
En su lugar, la asamblea del documento debe realizarse mediante **Motor de Plantillas DOCX**.
Los archivos DOCX deben contener etiquetas reconocibles (ej. `{{vendedor_nombre}}`, `{{precio_letras}}`).
Tú (el agente) te encargarás de:
1. Extraer o generar los datos completos (JSON).
2. Generar el script o llamada a librería (ej. `docxtemplater` en Node.js o `docxtpl` en Python) que tomará la plantilla `.docx` original y le inyectará el JSON de datos generando un `.docx` final perfecto.

### 2. Inyección de Variables y Lógica Condicional
Dependiendo del motor utilizado, la lógica condicional se debe estructurar:
- En `.md`: Resolución condicional en base a reglas de ensamblaje (texto dinámico).
- En `.docx`: Las etiquetas del documento soportan condicionales (ej. `{% if moneda == 'USD' %} ... {% endif %}` en Jinja2/docxtpl) o tú construirás el bloque de texto completo y lo inyectarás en una sola variable `{{clausula_precio}}`.
* **Condición:** `precio_moneda == 'USD'`
    * **Acción:** Inyectar cláusula de "Tipo de Cambio / Operación de Cambio" y "Renuncia a invocar imprevisión".
* **Condición:** `vendedor.estado_civil == 'CASADO'` AND `inmueble.ganancial == true`
    * **Acción:** Inyectar cláusula de "Asentimiento Conyugal (Art. 470)".
* **Condición:** `acto_subtipo == 'CON_RESERVA_USUFRUCTO'`
    * **Acción:** Inyectar cláusula de "Desmembramiento del Dominio: Reserva de Usufructo Vitalicio".

### 3. Reglas de Estilo Notarial (Style Enforcement)
* **Números:** Todos los montos, fechas y medidas deben expresarse en **LETRAS** y luego en (números) entre paréntesis.
* **Nombres:** Apellidos en Mayúsculas.
* **Espacios:** No dejar espacios en blanco (rellenar con guiones si es necesario al final de línea, aunque esto suele ser post-procesamiento de impresión).

## Implementation Script (Python)

Este script demuestra la lógica de ensamblaje usando un motor de plantillas simple (simil Jinja2) adaptado a reglas notariales.

```python
from datetime import datetime

def number_to_text_es(number):
    # (Placeholder) En producción, usar una librería robusta como 'num2words'
    # Esta función debe convertir 10000 -> "DIEZ MIL"
    return "CANTIDAD EN LETRAS (MOCK)"

def draft_deed(data):
    """
    Ensambla una escritura de COMPRAVENTA basada en datos JSON.
    """
    
    # 1. Variables Base
    fecha_escritura = datetime.now().strftime("%d de %B de %Y")
    escribano = data.get("escribano", "ALEJANDRO ATILIO GALMARINI")
    registro = data.get("registro", "SETENTA")
    
    # 2. Construcción del Encabezado (Proemio)
    text = []
    header = f"""ESCRITURA NUMERO {data.get('numero_escritura', '___')}.- {data.get('acto_titulo', 'VENTA')}.- 
    En la ciudad de Bahía Blanca, provincia de Buenos Aires, a los {fecha_escritura}, 
    ante mí, {escribano}, Notario Titular del Registro {registro}, COMPARECEN:"""
    text.append(header)
    
    # 3. Comparecencia (Iterar partes)
    # Nota: Aquí se usaría la Skill 'notary-entity-extractor' para formatear roles
    vendedores = [p for p in data['partes'] if p['rol'] == 'VENDEDOR']
    compradores = [p for p in data['partes'] if p['rol'] == 'COMPRADOR']
    
    comparecientes_txt = ""
    # Lógica simplificada de listado
    for p in vendedores + compradores:
        comparecientes_txt += f"\n    - {p['apellido'].upper()}, {p['nombre']}, {p['nacionalidad']}, DNI {p['dni']}..."
        
    text.append(comparecientes_txt)
    
    # 4. El Acto (Disposición)
    text.append(f"\n    Y los vendedores DICEN: Que VENDEN a favor de {compradores[0]['apellido'].upper()}...")
    
    # 5. El Inmueble (Usar extracción literal previa)
    inmueble_desc = data.get('inmueble', {}).get('transcripcion_literal', '[ERROR: FALTA DESCRIPCION]')
    text.append(f"\n    EL INMUEBLE: {inmueble_desc}")
    
    # 6. Precio y Forma de Pago (Condicional)
    precio = data.get('precio', 0)
    moneda = data.get('moneda', 'ARS')
    precio_letras = number_to_text_es(precio).upper()
    
    clause_precio = f"\n    PRECIO: La operación se realiza por la suma de {moneda} {precio_letras} ({precio})."
    
    if moneda == 'USD':
        clause_precio += " El comprador entrega en este acto la cantidad de billetes estadounidenses..."
        clause_precio += "\n    RENUNCIA: Las partes renuncian a invocar la teoría de la imprevisión..."
        
    text.append(clause_precio)
    
    # 7. Asentimiento (Lógica Condicional)
    if data.get('requiere_asentimiento', False):
        conyuge = data.get('conyuge_asentimiento', {})
        text.append(f"\n    ASENTIMIENTO: Presente en este acto {conyuge.get('nombre', '___')}, presta su asentimiento conforme art. 470 CCyC...")
    else:
        text.append("\n    ASENTIMIENTO: No se requiere por tratarse de bien propio y no ser sede del hogar conyugal.")

    # 8. Cierre
    text.append("\n    LEO a los comparecientes, ratifican y firman ante mí, doy fe.-")
    
    return "\n".join(text)

# --- DATOS DE PRUEBA ---
mock_data = {
    "numero_escritura": "CIENTO CUATRO",
    "acto_titulo": "VENTA",
    "precio": 50000,
    "moneda": "USD",
    "requiere_asentimiento": True,
    "conyuge_asentimiento": {"nombre": "Maria GARCIA", "dni": "11.222.333"},
    "partes": [
        {"rol": "VENDEDOR", "nombre": "Juan", "apellido": "PEREZ", "dni": "20.123.456", "nacionalidad": "argentino"},
        {"rol": "COMPRADOR", "nombre": "Roberto", "apellido": "LOPEZ", "dni": "30.987.654", "nacionalidad": "argentino"}
    ],
    "inmueble": {
        "transcripcion_literal": "UN LOTE DE TERRENO ubicado en..."
    }
}

print(draft_deed(mock_data))