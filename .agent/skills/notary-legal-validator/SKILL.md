---
name: notary-legal-validator
description: Valida jurídica y administrativamente una operación notarial (ej. Compraventa, Donación) cruzando los datos extraídos contra las Reglas de Negocio y Requisitos Legales del sistema EscriAR. Detecta faltantes críticos, inconsistencias conyugales (Art. 470 CCyC) y bloqueos registrales.
license: Proprietary
---

# Notary Legal Validator

## Overview

Esta habilidad actúa como el "Oficial Mayor Digital". Su función no es extraer datos, sino **juzgarlos**. Se ejecuta inmediatamente después de la extracción y antes de permitir la redacción de la escritura.

Utiliza esta habilidad para garantizar que una operación (Carpeta) tiene todos los "Semáforos en Verde" antes de proceder a la firma.

## Workflow Logic

### 1. Carga de Reglas (Context Loading)
El sistema debe identificar el `tipo_acto` (ej. 'COMPRAVENTA', 'DONACION') y consultar la Base de Conocimiento (etiqueta `VALIDATION_RULES`) para obtener la lista de requisitos.

### 2. Matriz de Validación (The Checklist)
Ejecutar las siguientes verificaciones secuenciales:

#### A. Identidad y UIF
* ¿Todas las personas tienen DNI y CUIT/CUIL validado?
* ¿Se ha realizado el chequeo de PEP (Persona Expuesta Políticamente)?
* **Regla:** Si el monto > Umbral UIF y no hay "Origen de Fondos", levantar `WARNING`.

#### B. Capacidad y Estado Civil (Critical)
* **Matriz de Asentimiento (Art. 456/470 CCyC):**
    * IF `Vendedor.estado_civil` == 'CASADO':
    * AND `Inmueble.caracter` == 'GANANCIAL' (o 'PROPIO' pero 'SEDE HOGAR CONYUGAL'):
    * THEN `Requisito` = 'ASENTIMIENTO_CONYUGAL'.
    * CHECK: ¿Existe el Cónyuge en la lista de comparecientes o hay un Poder Especial de Asentimiento?

#### C. Inmueble y Registral
* ¿El Inmueble tiene Nomenclatura Catastral completa?
* ¿Están vigentes los Certificados Registrales (Dominio, Inhibición)? (Verificar fecha vs. plazo ley 17.801).

## Implementation Script (Python)

Este script simula el motor de reglas. En producción, `rules_db` vendría de la Base de Conocimiento.

```python
from datetime import datetime, timedelta

def validate_operation(operation_data):
    """
    Valida una operación notarial completa.
    Input: JSON con estructura { "acto": "...", "partes": [...], "inmueble": {...}, "certificados": [...] }
    Output: Lista de errores (bloqueantes) y advertencias.
    """
    
    errors = []
    warnings = []
    
    acto = operation_data.get("acto", "").upper()
    partes = operation_data.get("partes", [])
    inmueble = operation_data.get("inmueble", {})
    
    # --- 1. Validación de Identidad Básica ---
    for p in partes:
        if not p.get("dni") or not p.get("cuit"):
            errors.append(f"Faltan identificadores fiscales/DNI para: {p.get('nombre')}")
        
        # Validación de PEP (UIF)
        if p.get("rol") in ["VENDEDOR", "COMPRADOR", "DONANTE", "DONATARIO"]:
            if "is_pep" not in p:
                warnings.append(f"Falta declaración de PEP para: {p.get('nombre')}")

    # --- 2. Lógica de Asentimiento Conyugal (Art 470 CCyC) ---
    if acto in ["VENTA", "HIPOTECA", "DONACION"]:
        vendedores = [p for p in partes if p.get("rol") in ["VENDEDOR", "HIPOTECANTE", "DONANTE"]]
        
        for v in vendedores:
            if v.get("estado_civil") == "CASADO":
                # Chequear caracter del bien
                caracter_bien = inmueble.get("caracter", "GANANCIAL") # Default preventivo
                es_vivienda = inmueble.get("es_vivienda_familiar", False)
                
                if caracter_bien == "GANANCIAL" or es_vivienda:
                    # Buscar al cónyuge en las partes
                    conyuge_presente = False
                    for c in partes:
                        if c.get("rol") == "CONYUGE" and c.get("vinculo_con") == v.get("id"):
                            conyuge_presente = True
                            break
                    
                    if not conyuge_presente:
                        errors.append(f"FALTA ASENTIMIENTO CONYUGAL: {v.get('nombre')} es Casado y dispone de bien {caracter_bien}.")

    # --- 3. Validación de Certificados (Vencimientos) ---
    certificados = operation_data.get("certificados", [])
    hoy = datetime.now()
    
    for cert in certificados:
        fecha_exp = datetime.strptime(cert["fecha_expedicion"], "%Y-%m-%d")
        # Plazo genérico PBA (puede variar por jurisdicción)
        dias_validez = 30 # Ejemplo
        vencimiento = fecha_exp + timedelta(days=dias_validez)
        
        if hoy > vencimiento:
            errors.append(f"CERTIFICADO VENCIDO: {cert['tipo']} (Venció: {vencimiento.strftime('%d/%m/%Y')})")
        elif hoy > (vencimiento - timedelta(days=5)):
            warnings.append(f"Certificado próximo a vencer: {cert['tipo']}")

    return {
        "status": "BLOCKED" if errors else "OK",
        "errors": errors,
        "warnings": warnings
    }

# --- EJEMPLO DE USO ---
mock_operation = {
    "acto": "VENTA",
    "partes": [
        {"id": 1, "nombre": "JUAN PEREZ", "rol": "VENDEDOR", "estado_civil": "CASADO", "dni": "123", "cuit": "20-123-1"},
        {"id": 2, "nombre": "MARIA LOPEZ", "rol": "COMPRADOR", "estado_civil": "SOLTERA", "dni": "456", "cuit": "27-456-7"}
    ],
    "inmueble": {
        "caracter": "GANANCIAL",
        "nomenclatura": "Circ I Sec A..."
    },
    "certificados": [
        {"tipo": "DOMINIO", "fecha_expedicion": "2023-01-01"} # Vencido intencional
    ]
}

print(validate_operation(mock_operation))