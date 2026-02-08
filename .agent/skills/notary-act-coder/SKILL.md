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

---

## Reglas de Negocio 2026

### 1. Códigos de Vivienda Única
Si `is_family_home = true` Y la valuación fiscal está bajo el tope de exención (~$251M):
- Usar código `-51` (Exención total de Sellos)
- Ejemplo: `100-00` → `100-51`

### 2. Partes Exentas (Subcódigos)
| Subcódigo | Significado |
|-----------|-------------|
| `-00` | Ambas partes pagan todo |
| `-01` | Paga sellos, 1 parte exenta aportes |
| `-10` | 1 parte exenta sellos |
| `-11` | 1 parte exenta sellos Y aportes |
| `-20` | Exenta de sellos |
| `-21` | Exenta sellos, 1 parte exenta aportes |
| `-22` | Exenta sellos Y aportes |
| `-32` | No gravada sellos, exenta aportes |
| `-51` | Vivienda única - exención total |

### 3. Tasas Suspendidas 2026
Algunos actos tienen la "Tasa Retributiva de Servicios" (4‰) suspendida.
El JSON marca estos con `suspended_rate_2026: true`.

---

## Flujo de Trabajo

### Paso 1: Recibir Descripción
El usuario proporciona el texto de la escritura o una descripción del acto.

### Paso 2: Extraer Intent
Analiza el texto y genera el `ActIntent` object.

### Paso 3: Buscar Código
Usa el `TaxonomyService` para encontrar el código correcto:

```typescript
const intent: ActIntent = {
  operation_type: "COMPRAVENTA",
  is_family_home: true,
  exemption_flags: { ... }
};

const result = taxonomyService.findActByIntent(intent);
// Returns: { code: "100-51", description: "COMPRAVENTA VIVIENDA ÚNICA...", ... }
```

### Paso 4: Devolver Resultado
Responde con:
- **Código**: `100-51`
- **Descripción**: COMPRAVENTA VIVIENDA ÚNICA - EXENCIÓN TOTAL SELLOS
- **Impuesto de Sellos**: EXENTO
- **Tasa Retributiva**: $ 891.000
- **Aporte Terceros**: $ 25.000

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
