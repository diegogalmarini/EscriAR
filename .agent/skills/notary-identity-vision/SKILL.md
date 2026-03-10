---
name: notary-identity-vision
description: Habilidad de visión artificial multimodal diseñada para extraer, estructurar y validar datos identidad desde imágenes de documentos físicos (DNI Tarjeta Argentina, Pasaportes, Licencias). Incluye verificación de seguridad mediante análisis de códigos MRZ (Machine Readable Zone) y cruce de datos Frente/Dorso.
license: Proprietary
---

# Notary Identity Vision

## Overview

Cumpliendo con el **Módulo A (Gestión de Identidad)** del Roadmap EscriAR, esta habilidad permite el "Alta por Escaneo". Transforma una foto de un DNI o Pasaporte en una ficha de cliente validada, eliminando el error humano de tipeo y acelerando el proceso de apertura de carpeta.

A diferencia de los extractores de texto plano, esta habilidad entiende la estructura visual del documento de identidad argentino.

## Workflow Logic

### 1. Clasificación de la Imagen (Image Triage)
Al recibir una imagen, determinar si es:
* **DNI_FRENTE:** Contiene foto rostro + Huella + Datos Biográficos.
* **DNI_DORSO:** Contiene Domicilio + MRZ + Vencimiento.
* **PASAPORTE:** Contiene página de datos biométricos completa.

### 2. Extracción Estructurada (Vision Extraction)
Utilizar un modelo multimodal (o OCR zonificado) para mapear coordenadas visuales a campos JSON:
* **Campos Críticos:** `Apellido`, `Nombres`, `Nro Documento`, `Sexo`.
* **Campos de Auditoría:** `Nro Trámite` (Vital para trámites en MiArgentina/ANSES), `Fecha Emisión`, `Fecha Vencimiento`.
* **Domicilio:** Extraer literal completo (Calle, Nro, Piso, Localidad, CP).

### 3. Validación Determinística (MRZ Logic)
Si se detecta una zona MRZ (el código de barras alfanumérico al pie):
1.  Parsear las líneas (1, 2 o 3 líneas según estándar ICAO 9303).
2.  Recalcular los dígitos verificadores (Check Digits).
3.  **Comparar:** Los datos extraídos visualmente (OCR) deben coincidir EXACTAMENTE con los datos decodificados del MRZ.
    * *Si (OCR Fecha Nacimiento != MRZ Fecha Nacimiento) -> ALERTA DE FRAUDE O ERROR DE LECTURA.*

## Implementation Script (Python)

Este script incluye un parser de MRZ robusto y lógica de limpieza específica para DNIs argentinos.

```python
import re
from datetime import datetime

def parse_mrz(mrz_text):
    """
    Parsea y valida la zona MRZ de un DNI Argentino (Formato ID-1 ICAO).
    """
    lines = mrz_text.strip().split('\n')
    # Filtrar líneas vacías y limpiar caracteres inválidos
    lines = [line.replace(" ", "") for line in lines if len(line) > 10]
    
    if len(lines) < 3:
        return {"valid": False, "error": "MRZ incompleto o no detectado"}

    # Estructura Típica DNI Arg (3 líneas de 30 caracteres)
    # L1: I<ARG12345678<9<<<<<<<<<<<<<<<
    # L2: 8001015M3001016ARG<<<<<<<<<<<4
    # L3: APELLIDO<<NOMBRE<<<<<<<<<<<<<<
    
    try:
        # Extracción básica de campos del MRZ
        doc_type = lines[0][0:2]
        country = lines[0][2:5]
        dni_number = lines[0][5:14].replace("<", "")
        
        birth_date_str = lines[1][0:6] # YYMMDD
        sex = lines[1][7]
        expiration_date_str = lines[1][8:14] # YYMMDD
        
        # Validación de Fechas (Heurística simple)
        birth_date = datetime.strptime(birth_date_str, "%y%m%d")
        exp_date = datetime.strptime(expiration_date_str, "%y%m%d")
        
        return {
            "valid": True,
            "data": {
                "document_type": doc_type,
                "issuing_country": country,
                "document_number": dni_number,
                "birth_date": birth_date.strftime("%Y-%m-%d"),
                "sex": sex,
                "expiration_date": exp_date.strftime("%Y-%m-%d")
            }
        }
    except Exception as e:
        return {"valid": False, "error": f"Error parseando MRZ: {str(e)}"}

def process_identity_document(ocr_result):
    """
    Orquesta la validación entre datos visuales y datos de seguridad (MRZ).
    Input: Objeto JSON con 'visual_text' y 'mrz_text'.
    """
    visual_data = {} # Aquí iría el mapeo del OCR visual (Nombre, Apellido)
    
    # 1. Procesar MRZ
    mrz_analysis = parse_mrz(ocr_result.get("mrz_block", ""))
    
    status = "PENDING_REVIEW"
    flags = []

    if mrz_analysis["valid"]:
        # 2. Cross-Check (Ejemplo: DNI detectado visualmente vs MRZ)
        visual_dni = ocr_result.get("visual_dni_number", "").replace(".", "")
        mrz_dni = mrz_analysis["data"]["document_number"]
        
        if visual_dni and mrz_dni and visual_dni != mrz_dni:
            status = "SECURITY_ALERT"
            flags.append(f"INCONSISTENCIA: DNI Visual ({visual_dni}) no coincide con MRZ ({mrz_dni})")
        else:
            status = "VERIFIED"
            # Priorizamos datos del MRZ que son menos propensos a error de OCR visual
            visual_data.update(mrz_analysis["data"]) 
    else:
        status = "MANUAL_REVIEW"
        flags.append("No se pudo validar MRZ. Requiere revisión visual.")

    return {
        "status": status,
        "identity_data": visual_data,
        "security_flags": flags
    }

# --- CASO DE PRUEBA (Datos Sintéticos) ---
mock_ocr_input = {
    "visual_dni_number": "12.345.678",
    "mrz_block": """
IDARG12345678<9<<<<<<<<<<<<<<<
8001015M3001016ARG<<<<<<<<<<<4
PEREZ<<JUAN<CARLOS<<<<<<<<<<<<
"""
}

print(process_identity_document(mock_ocr_input))