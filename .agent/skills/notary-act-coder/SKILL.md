---
name: notary-act-coder
description: Codificador automático de actos notariales para declaraciones ARBA. Transforma descripciones de escrituras en códigos alfanuméricos de la Tabla CESBA 2026, devolviendo tasas e impuestos aplicables.
---

# Notary Act Coder (Codificador de Actos Notariales)

## Overview

Los escribanos deben declarar cada acto notarial en ARBA usando códigos numéricos de la "Tabla de Actos" oficial. Este proceso manual es engorroso y propenso a errores.

Esta habilidad automatiza la búsqueda del código correcto, extrayendo la intención del texto de la escritura y mapeándola a la taxonomía oficial vigente (2026).

---

## Arquitectura Híbrida

```
┌─────────────────────┐     ┌──────────────────────┐     ┌────────────────────┐
│  Texto de Escritura │ ───▶│  Extracción Semántica│ ───▶│  TaxonomyService   │
│  (Input Natural)    │     │  (Gemini 2.0 Flash)  │     │  (Lookup JSON)     │
└─────────────────────┘     └──────────────────────┘     └────────────────────┘
                                    │                              │
                                    ▼                              ▼
                            Intent Object                   Código + Tasas
```

### Capa 1: Extracción Semántica (AI)
El LLM analiza el texto y extrae un **Intent Object** estructurado.

### Capa 2: Lookup Determinístico
El servicio busca en `acts_taxonomy_2026.json` (822 actos) el código exacto.

---

## Intent Object Schema

Cuando proceses una escritura, debes extraer:

```typescript
interface ActIntent {
  // Tipo de operación principal
  operation_type: 
    | "COMPRAVENTA"
    | "HIPOTECA" 
    | "DONACION"
    | "CESION"
    | "PODER"
    | "ACTA"
    | "DIVISION_CONDOMINIO"
    | "AFECTACION_BIEN_FAMILIA"
    | "USUFRUCTO"
    | "FIDEICOMISO"
    | "CONSTITUCION_SOCIEDAD"
    | "OTRO";
  
  // Tipo de bien (si aplica)
  property_type?: "VIVIENDA" | "TERRENO" | "COMERCIAL" | "RURAL" | "PH";
  
  // ¿Es vivienda única familiar? (para exenciones)
  is_family_home: boolean;
  
  // Monto de la operación (para determinar exenciones)
  transaction_amount?: number;
  
  // ¿Hay partes exentas de sellos/aportes?
  exemption_flags: {
    seller_exempt_sellos: boolean;
    buyer_exempt_sellos: boolean;
    seller_exempt_aportes: boolean;
    buyer_exempt_aportes: boolean;
  };
  
  // Características especiales
  special_flags: {
    is_nuda_propiedad: boolean;
    is_plan_social_vivienda: boolean;
    is_regularizacion_dominial: boolean;
  };
}
```

## Matriz de Reglas de Negocio y Cálculo Algorítmico (CESBA 2026)

Esta tabla no es un simple directorio, es una **matriz relacional**. A continuación, las instrucciones exactas para procesarla:

### 1. Estructura de Datos (Mapeo de Columnas del PDF)
El Agente debe comprender que los datos provienen del arreglo `raw_row` mapeado exactamente a las 10 columnas del PDF oficial:
- **`raw_row[1]`**: CÓDIGO (Ej: `100-00`)
- **`raw_row[2]`**: TIPO DE ACTO (Descripción legal)
- **`raw_row[3]`**: BASE IMPONIBLE (Qué valor se usa para calcular Sellos)
- **`raw_row[4]`**: Impuesto o Tasa (Alícuota de ARBA, ej: `2%`, `1,2%`, `EXENTO`)
- **`raw_row[5]`**: Artículo Número (Referencia a la Ley Impositiva)
- **`raw_row[6]`**: BASE DE CÁLCULO (Arancel Ley 6925)
- **`raw_row[7]`**: Honorario Mínimo (Valor piso del Arancel en pesos)
- **`raw_row[8]`**: BASE DE CÁLCULO (Aporte Notarial Ley 6983)
- **`raw_row[10]`**: Coeficiente (Para multiplicar por la Base y obtener el Aporte, ej: `0,004`)
- **`raw_row[11]`**: Aporte Mínimo (Valor piso del Aporte en pesos)

### 2. Lógica Relacional de Códigos y Subcódigos
El código matriz siempre termina en `-00` (Ej: `100-00` Compraventa). Los sufijos indican distribuciones de cargas fiscales entre las partes (Comprador/Vendedor, Mutuante/Mutuario):
*   **`-00`**: Acto general (Ambas partes tributan sin exenciones).
*   **`-01`**: Acto gravado con Sellos, pero una parte está exenta de Aportes.
*   **`-10`**: Una parte exenta de Sellos, tributan Aportes.
*   **`-11`**: Una parte exenta de Sellos Y exenta de Aportes.
*   **`-20`**: Acto totalmente Exento de Sellos.
*   **`-21`**: Acto Exento de Sellos, y una parte exenta de Aportes.
*   **`-22`**: Acto Exento de Sellos Y exento de Aportes.
*   **`-51`**: **Vivienda Única** (Exención total de Sellos por fin social).

**Regla de Oro:** El Agente debe analizar las condiciones de las partes en la descripción del acto para inferir el subcódigo correcto.

### 3. Fórmulas de Cálculo
Cuando el Agente deba proyectar costos (Liquidación), aplicará estas fórmulas utilizando el JSON:
1.  **Impuesto de Sellos (ARBA):** 
    *   Fórmula: `Base Imponible` × `Impuesto o Tasa`.
    *   *Si la Tasa es "EXENTO" o "NO GRAV.", el resultado es $0.*
2.  **Honorario (Arancel Ley 6925):**
    *   Fórmula teórica: Extraer cálculo ad/hoc, pero en la tabla se expresa el **Honorario Mínimo** (`raw_row[7]`).
3.  **Aporte Notarial de Terceros (Ley 6983):**
    *   Fórmula: `MAX( Aporte Mínimo (raw_row[11]), Base de Cálculo × Coeficiente (raw_row[10]) )`.

### 4. Reglas Especiales de Suspensión de Tasas (2026)
Durante 2026, la Provincia de Buenos Aires tiene ciertas tasas suspendidas.
*   En el JSON, estos actos están marcados con el flag booleano `suspended_rate_2026: true`.
*   El Agente debe comunicar al usuario que este rubro se encuentra **"Exento por Suspensión 2026"** y no sumarlo al total general de gastos.

---

## Flujo de Trabajo

### Paso 1: Recibir Descripción
El usuario proporciona el texto de la escritura o una descripción del acto, detallando los roles, el tipo de inmueble y el destino.

### Paso 2: Extraer Intent e Inferir Subcódigo
Analiza el texto y genera el `ActIntent` object verificando si encuadra en Vivienda Única (`-51`) o exenciones cruzadas.

### Paso 3: Buscar Código Exacto
Usa el `TaxonomyService` para encontrar el código exacto en `acts_taxonomy_2026.json`.

### Paso 4: Devolver Resultado y Liquidación
Responde con:
- **Código Encontrado**: `100-51`
- **Descripción Exacta**: COMPRAVENTA VIVIENDA ÚNICA...
- **Impuesto de Sellos**: EXENTO (o cálculo si aplica)
- **Honorario Mínimo**: Extraído de `raw_row[7]`
- **Aporte Terceros**: Calculado con la fórmula `MAX(Aporte Min, Base * Coeficiente)` o extraído del mínimo `raw_row[11]`.

---

## Datos de Referencia

**Ubicación del JSON**: `.agent/skills/notary-act-coder/data/acts_taxonomy_2026.json`

Contiene 822 códigos extraídos del PDF oficial:
`.agent/skills/notary-act-coder/source/2026_01_07_Tabla_de_Actos_Notariales_General_Ext_Jur_01012026.pdf`

---

## Ejemplo de Uso

**Input del Usuario:**
> "Necesito el código para una compraventa de un departamento que será vivienda única del comprador. El precio es de $180.000.000"

**Extracción del Agente:**
```json
{
  "operation_type": "COMPRAVENTA",
  "property_type": "PH",
  "is_family_home": true,
  "transaction_amount": 180000000,
  "exemption_flags": {
    "seller_exempt_sellos": false,
    "buyer_exempt_sellos": true
  }
}
```

**Resultado:**
| Campo | Valor |
|-------|-------|
| **Código ARBA** | `100-51` |
| **Descripción** | COMPRAVENTA VIVIENDA ÚNICA - EXENCIÓN TOTAL SELLOS |
| **Sellos** | EXENTO |
| **Honorario Mínimo** | $ 891.000 |
| **Aporte 3ros** | $ 25.000 |
