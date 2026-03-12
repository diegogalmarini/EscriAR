---
name: notary-tax-calculator
description: Motor de cálculo fiscal y arancelario automatizado para operaciones inmobiliarias en Argentina. Determina bases imponibles, selecciona la alícuota correcta (ITI vs Ganancias), calcula el Impuesto de Sellos (con exenciones de Vivienda Única) y estima honorarios y aportes notariales.
license: Proprietary
---

# Notary Tax & Fee Calculator

## Overview

Los escribanos son Agentes de Retención y Percepción. Un error en el cálculo de una retención genera responsabilidad solidaria y multas. Esta habilidad elimina la dependencia de hojas de cálculo manuales ("Excel") y automatiza la liquidación de la operación (La "Proforma de Gastos").

Utiliza esta habilidad para generar el presupuesto inicial para el cliente y para calcular las retenciones finales al momento de la firma.

## Workflow Logic

### 1. Determinación de la Base Imponible
El sistema debe comparar valores para determinar sobre qué monto se tributa:
* **Input:** `Precio de Venta` (USD/ARS) y `Valuación Fiscal` (ARS).
* **Lógica:**
    1. Si `Precio` es en USD, convertir a ARS usando la cotización "Vendedor Banco Nación" del día anterior (o del día, según norma local).
    2. `Base_Imponible` = MAX(`Precio_ARS`, `Valuación_Fiscal`).

### 2. Lógica de Impuestos Nacionales a la Transferencia (Vendedor)
El ITI (1.5%) fue **derogado en su totalidad a partir del 8 de julio de 2024** mediante la Ley 27.743. Por lo tanto:
* **Adquisiciones antes del 1° de enero de 2018 (Personas Humanas):** Ya no están alcanzadas por ningún impuesto nacional a la transferencia. El escribano no retiene ni se precisa certificado de no retención.
* **Adquisiciones desde el 1° de enero de 2018 (Personas Humanas):** Aplica **Impuesto a las Ganancias Cedular (15%)**. El escribano **NO** es agente de retención; el tributo es responsabilidad del contribuyente.
* **Sujetos colectivos, empresas o habitualistas:** Mantiene vigencia el **Impuesto a las Ganancias Global (3%)** con retención obligatoria a cargo del escribano.

### 3. Impuesto de Sellos (Provincia de Buenos Aires)
* **Tasa General:** 2.0% (Dividido 50/50 partes o según pacto).
* **Exención (Vivienda Única):** Si el Comprador declara que será su "Vivienda Única, Familiar y de Ocupación Permanente" Y la Valuación Fiscal < Tope Ley Impositiva:
    * El monto hasta el tope está exento. Se tributa solo por el excedente.

### 4. Honorarios y Aportes
* **Honorarios:** Porcentaje sugerido por el Colegio de Escribanos (ej. 2% + IVA).
* **Aportes:** Caja Notarial y Colegio (generalmente un % sobre los honorarios o sobre el monto del acto).

## Implementation Script (Python)

Este script implementa la lógica tributaria argentina estándar (caso PBA).

```python
def calculate_notary_expenses(data):
    """
    Calcula impuestos y gastos de una operación de VENTA.
    
    Args:
        data (dict): {
            "precio": float,
            "moneda": "USD" | "ARS",
            "cotizacion_usd": float,
            "valuacion_fiscal": float,
            "fecha_escritura_origen": "YYYY-MM-DD",
            "es_vivienda_unica": bool,
            "tope_exencion_sellos": float  # Valor de Ley Impositiva vigente
        }
    """
    
    precio = data.get("precio", 0)
    cotizacion = data.get("cotizacion_usd", 1) if data.get("moneda") == "USD" else 1
    precio_pesos = precio * cotizacion
    valuacion = data.get("valuacion_fiscal", 0)
    
    # 1. Base Imponible Sellos (Mayor valor)
    base_sellos = max(precio_pesos, valuacion)
    
    # 2. Cálculo Impuesto de Sellos (PBA - Ejemplo 2%)
    tasa_sellos = 0.02
    monto_sellos = 0
    
    if data.get("es_vivienda_unica", False):
        tope = data.get("tope_exencion_sellos", 0)
        if base_sellos > tope:
            # Tributa solo sobre el excedente
            monto_sellos = (base_sellos - tope) * tasa_sellos
        else:
            monto_sellos = 0 # Totalmente exento
    else:
        monto_sellos = base_sellos * tasa_sellos

    # 3. Cálculo ITI (Nacional - 1.5%)
    # Simplificación: Asumimos que aplica ITI si la fecha es antigua
    monto_iti = 0
    fecha_origen = data.get("fecha_escritura_origen")
    if fecha_origen and fecha_origen < "2018-01-01":
        monto_iti = precio_pesos * 0.015
    
    # 4. Honorarios Sugeridos (Ej. 2%)
    honorarios = precio_pesos * 0.02
    iva_honorarios = honorarios * 0.21
    
    # 5. Aportes (Ej. Caja Notarial 15% de Honorarios - Simulado)
    aportes = honorarios * 0.15

    total_gastos = monto_sellos + monto_iti + honorarios + iva_honorarios + aportes

    return {
        "base_calculo_ars": base_sellos,
        "detalle": {
            "sellos_pba": round(monto_sellos, 2),
            "iti_afip": round(monto_iti, 2),
            "honorarios": round(honorarios, 2),
            "iva_21": round(iva_honorarios, 2),
            "aportes_notariales": round(aportes, 2)
        },
        "total_estimado": round(total_gastos, 2),
        "total_estimado_usd": round(total_gastos / cotizacion, 2) if data.get("moneda") == "USD" else 0
    }

# --- TEST CASE ---
mock_operation = {
    "precio": 100000,          # 100k USD
    "moneda": "USD",
    "cotizacion_usd": 1100,    # Cotización BNA
    "valuacion_fiscal": 50000000, # 50M ARS
    "fecha_escritura_origen": "2010-05-20", # Aplica ITI
    "es_vivienda_unica": True,
    "tope_exencion_sellos": 90000000 # Supongamos tope alto
}

# Resultado esperado: Sellos paga sobre excedente (110M vs 50M -> Base 110M. 110M > 90M. Excedente 20M. 2% de 20M = 400k)
# ITI: 1.5% de 110M = 1.65M
print(calculate_notary_expenses(mock_operation))