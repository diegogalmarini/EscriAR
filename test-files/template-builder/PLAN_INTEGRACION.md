# Plan de Integración: EscriAR Template Builder ↔ EscriAR SaaS

> **Fecha:** Junio 2025  
> **Versión:** 1.0  
> **Estado:** Template Builder operativo — Fase de integración con SaaS

---

## 1. Situación Actual

### Template Builder (este proyecto)
| Métrica | Valor |
|---|---|
| Actos notariales | 78 (6 categorías) |
| Variables Jinja2 | 782 únicas en 100 categorías |
| Categorías de instrumentos | ESCRITURA_PUBLICA, COPIA_TESTIMONIO, ACTA_NOTARIAL, CERTIFICACION, INSTRUMENTO_DIGITAL, INSTRUMENTO_PRIVADO |
| Salida | ZIP = template.docx (Jinja2) + metadata.json (schema) |

### EscriAR SaaS (producto principal)
| Componente | Estado |
|---|---|
| `deedDrafter.ts` | Hardcoded, solo COMPRAVENTA + HIPOTECA, texto plano, solo Bahía Blanca |
| `notary_docx_builder.py` | ✅ Funcional — wrapper docxtpl de 30 líneas |
| `modelos_actos/` | Solo 1 template (PODER-ESPECIAL-COMPRA.docx) |
| `DraftingContext` | ~20 campos flat, sin categorías |
| AI Models | Gemini 2.5 Flash (rápido) + Pro (complejo) |

---

## 2. Diagnóstico — Gap Analysis

### DraftingContext actual vs. nuestras variables (ejemplo: Compraventa)

**EscriAR SaaS tiene hoy (DraftingContext):**

| Campo SaaS | Categoría Nuestra | Variables Nuestras Equivalentes |
|---|---|---|
| `numero_escritura` | escritura | `{{ escritura.numero }}` |
| `acto_titulo` | escritura | No hay equivalente directo (se calcula) |
| `fecha` | escritura | `{{ escritura.fecha }}` |
| `escribano` | escritura | `{{ escritura.escribano }}` |
| `registro` | escritura | `{{ escritura.registro }}` |
| `caracter_escribano` | escritura | `{{ escritura.caracter }}` |
| `distrito_notarial` | escritura | `{{ escritura.distrito }}` |
| `clientes[].nombre_completo` | vendedores/compradores | `{{ vendedores[i].nombre_completo }}`, `{{ compradores[i].nombre_completo }}` |
| `clientes[].nacionalidad` | vendedores/compradores | `{{ vendedores[i].nacionalidad }}` |
| `clientes[].dni` | vendedores/compradores | `{{ vendedores[i].numero_documento }}` |
| `clientes[].rol` | — | Implícito en el prefix (vendedores, compradores) |
| `inmuebles[].transcripcion_literal` | inmueble | `{{ inmueble.descripcion_legal }}` (parcial) |
| `tax.baseCalculoArs` | impuestos | `{{ impuestos.base_imponible }}` |
| `tax.detail.sellosPba` | impuestos | `{{ impuestos.sellados }}` |
| `tax.detail.itiAfip` | impuestos | `{{ impuestos.iti }}` |
| `compliance.risk_level` | — | No existe (dato interno, no va en escritura) |
| `mortgage.financial_terms` | hipoteca_datos | `{{ hipoteca_datos.monto_capital }}`, etc. |

**Categorías que EscriAR NO tiene en absoluto (47 variables faltantes):**

| Categoría | Variables | Datos Ejemplo |
|---|---|---|
| `apoderado` | 9 | nombre, DNI, domicilio, poder por el cual actúa |
| `conyuge` | 9 | nombre, DNI, asentimiento conyugal (Art. 456 CCyCN) |
| `titulo_antecedente` | 7 | escritura anterior, escribano anterior, matrícula, folio |
| `certificados` | 8 | catastro, inhibiciones, dominio, deuda municipal/ARBA |
| `persona_juridica` | 9 | razón social, CUIT, inscripción IGJ, representante legal |
| `poder_datos` | 5 | tipo de poder, facultades otorgadas, alcance |

**Categorías presentes pero con cobertura parcial (56 variables parciales):**

| Categoría | Tiene SaaS | Tiene Template Builder | Delta |
|---|---|---|---|
| escritura | 5 campos | 10 variables | +5 (folio, tomo, localidad, provincia, distrito) |
| vendedores | 3 campos | 9 variables | +6 (tipo_doc, estado_civil, domicilio, CUIT, fecha_nac, profesión) |
| compradores | 3 campos | 9 variables | +6 (ídem vendedores) |
| inmueble | 1 campo (blob) | 16 variables | +15 (matrícula, partida, superficie, linderos, nomenclatura...) |
| operacion | 0 campos | 8 variables | +8 (precio, moneda, forma pago, etc.) |
| impuestos | 3 campos | 4 variables | +1 |

### Resumen Cuantitativo (solo Compraventa)

```
EscriAR SaaS extrae:    ~15 datos efectivos
Template Builder requiere: 103 variables en 12 categorías

Cobertura:  15/103 = 14.6%
Brecha:     88 variables adicionales necesarias
```

---

## 3. Arquitectura de Integración

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       FLUJO DE TRABAJO COMPLETO                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  DISEÑO (Template Builder — este proyecto)                              │
│  ═══════════════════════════════════════                                 │
│                                                                         │
│    Escribano sube              Template Builder              Salida     │
│    escritura real (.docx)  ──→  analiza + IA          ──→   ZIP         │
│                                 inyecta Jinja2               ├─ .docx   │
│                                                              └─ .json   │
│                                                                         │
│  PRODUCCIÓN (EscriAR SaaS — producto principal)                          │
│  ═════════════════════════════════════════════                           │
│                                                                         │
│    Carga ZIP ──→ Almacena en         ──→ Extrae datos    ──→ Render     │
│                  modelos_actos/           con AI Gemini       docxtpl    │
│                  + BD schema                                             │
│                                                                         │
│    metadata.json ──→ Auto-genera formulario web (sin programar)         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Contrato entre los dos sistemas

**El ZIP es el contrato.** Contiene:

1. **`template.docx`** — Documento Word con variables Jinja2 incrustadas
   - `docxtpl` lo renderiza directamente
   - Preserva formato exacto: fuentes, márgenes, tablas, sellos

2. **`metadata.json`** — Schema que describe CADA variable
   ```json
   {
     "schema_version": "1.0",
     "template_name": "compraventa_inmueble_template",
     "act_type": "compraventa",
     "total_variables": 103,
     "categories_used": ["escritura", "vendedores", "compradores", ...],
     "required_variables": [
       {
         "jinja_tag": "{{ escritura.numero }}",
         "field_name": "escritura.numero",
         "category": "escritura",
         "category_label": "Datos del Instrumento",
         "description": "Número de escritura pública",
         "type": "text",
         "example": "Escritura Número Ciento Veintitrés (123)",
         "is_array": false
       },
       {
         "jinja_tag": "{{ vendedores[0].nombre_completo }}",
         "field_name": "vendedores[0].nombre_completo",
         "category": "vendedores",
         "category_label": "Vendedores / Parte Transmitente",
         "description": "Nombre y apellido completo del vendedor",
         "type": "text",
         "example": "Juan Carlos PÉREZ",
         "is_array": true,
         "array_index": 0
       }
     ]
   }
   ```

---

## 4. Qué debe hacer cada sistema

### A) Template Builder (nosotros) — Ya hecho o en progreso

| Tarea | Estado | Prioridad |
|---|---|---|
| Catálogo de 78 actos notariales | ✅ Completo | — |
| Catálogo de 782 variables Jinja2 | ✅ Completo | — |
| Pipeline: DOCX → template Jinja2 → ZIP | ✅ Funcional | — |
| Metadata.json con schema completo | ✅ Funcional | — |
| **Exportar catálogo completo como JSON** | 🔧 En construcción | ALTA |
| **Procesar primer documento real** | ⏳ Pendiente | ALTA |
| **Generar templates de ejemplo para testing** | ⏳ Pendiente | MEDIA |

### B) EscriAR SaaS (producto principal) — Lo que debe construir

| Tarea | Prioridad | Detalle |
|---|---|---|
| **1. Tabla `modelos_actos`** | CRÍTICA | Almacenar templates + metadata por acto. Schema mínimo abajo. |
| **2. Endpoint upload ZIP** | ALTA | Recibir ZIP del Builder, extraer .docx y .json, almacenar. |
| **3. Expandir extracción AI** | ALTA | Gemini debe extraer las 12 categorías de datos, no solo 5. |
| **4. Separar datos AI vs usuario** | ALTA | Distinguir datos que extrae la IA de PDFs vs datos que completa el escribano al momento de firmar. |
| **5. Deprecar `deedDrafter.ts`** | MEDIA | Reemplazar con flujo template → docxtpl. Ya existe `notary_docx_builder.py`. |
| **6. Auto-generar formulario** | MEDIA | Usar `metadata.json` para crear formulario web dinámico con los tipos de input correctos. |

### Schema sugerido para tabla `modelos_actos`

```sql
CREATE TABLE modelos_actos (
  id              UUID PRIMARY KEY,
  act_type        VARCHAR(50) NOT NULL,     -- "compraventa", "hipoteca", etc.
  template_name   VARCHAR(100) NOT NULL,    -- "compraventa_inmueble_template"
  version         INTEGER DEFAULT 1,
  docx_path       VARCHAR(255) NOT NULL,    -- ruta al .docx en storage
  metadata        JSONB NOT NULL,           -- el metadata.json completo
  total_variables INTEGER NOT NULL,
  categories      VARCHAR[] NOT NULL,        -- ["escritura","vendedores",...]
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 5. Separación de datos: AI-extraídos vs Usuario-completados

**Insight clave:** No todos los datos de una escritura se extraen por IA de PDFs previos. Algunos los completa el escribano al momento de la operación.

### Datos que la IA extrae de documentos previos (PDFs, escrituras anteriores)
- Datos de personas: nombres, DNI, domicilios, CUIT (de DNI/escritura previa)
- Datos del inmueble: matrícula, superficie, linderos (de título/informe catastral)
- Título antecedente: escritura anterior, escribano, folio, tomo (de escritura previa)
- Certificados: números de certificado, fechas (de certificados emitidos)

### Datos que completa el escribano en el momento
- Número de escritura (se asigna al autorizar)
- Folio (se asigna en el protocolo)
- Fecha (fecha de autorización)
- Precio / monto de operación (lo acuerdan las partes)
- Forma de pago (lo declaran las partes)
- Impuestos calculados (el sistema los calcula o el escribano los ingresa)

### Datos que el sistema calcula automáticamente
- Sellados provinciales (% sobre monto)
- ITI AFIP (si aplica)
- Montos en letras (PESOS QUINIENTOS MIL → $500.000)

**Recomendación para EscriAR SaaS:** El `metadata.json` ya incluye un campo `type` por variable. Agregar un campo `source` con valores: `"ai_extract"`, `"user_input"`, `"calculated"`. Esto permite saber de dónde viene cada dato.

---

## 6. Plan de Ejecución por Fases

### FASE 1 — Inmediata (esta semana)
1. ✅ Exportar catálogo de variables como JSON (`export_catalog.py`)
2. ⏳ Subir primer documento real al Builder y generar primer ZIP
3. Compartir con EscriAR SaaS: catálogo JSON + ZIP de ejemplo + este documento

### FASE 2 — Corto plazo (1-2 semanas)
1. EscriAR SaaS crea tabla `modelos_actos` y endpoint de upload
2. EscriAR SaaS expande `DraftingContext` para cubrir las 12 categorías
3. Generar templates para los 5 actos más comunes:
   - Compraventa inmueble
   - Poder especial
   - Hipoteca
   - Donación
   - Constitución sociedad (SAS/SRL)

### FASE 3 — Mediano plazo (2-4 semanas)
1. Auto-generación de formulario web desde metadata.json
2. Templates para los 15 actos más frecuentes de AMBA/PBA
3. Sistema de versionado de templates

### FASE 4 — Largo plazo
1. Cobertura de los 78 actos
2. Templates por jurisdicción (PBA, CABA, Santa Fe, Córdoba)
3. IA que sugiere templates similares cuando no hay uno exacto

---

## 7. Qué decirle al agente EscriAR SaaS

### Mensaje sugerido:

> **Para el agente de EscriAR SaaS:**
>
> 1. **El catálogo de variables ya está listo.** Son 782 variables Jinja2 organizadas en 100 categorías, cubriendo 78 actos notariales argentinos. Te adjunto el JSON completo (`catalogo_variables_escriar.json`).
>
> 2. **El Template Builder genera ZIPs** con dos archivos:
>    - `template.docx` — plantilla Word con tags Jinja2 que `docxtpl` renderiza directamente (tu `notary_docx_builder.py` ya lo hace)
>    - `metadata.json` — schema completo con cada variable: nombre, categoría, descripción, tipo de input sugerido, ejemplo, si es array
>
> 3. **`deedDrafter.ts` debe ser reemplazado.** Está hardcodeado para 2 actos y genera texto plano. El flujo correcto es: template.docx + datos → docxtpl → escritura final.
>
> 4. **DraftingContext es insuficiente.** Para una compraventa necesitás 103 variables en 12 categorías. Hoy solo tenés ~15 campos en ~5 categorías. Faltan completamente: apoderado, cónyuge, título antecedente, certificados, persona jurídica, poder.
>
> 5. **Necesitás una tabla `modelos_actos`** para guardar los templates + metadata por acto. Te sugiero el schema en el plan.
>
> 6. **Separar fuentes de datos.** No todos los campos vienen de extracción AI. Algunos los completa el escribano (número escritura, precio) y otros se calculan (sellados, ITI).
>
> 7. **El catálogo JSON incluye para cada variable:**
>    ```json
>    {
>      "jinja_tag": "{{ vendedores[i].nombre_completo }}",
>      "category": "vendedores",
>      "category_label": "Vendedores / Parte Transmitente",
>      "description": "Nombre y apellido completo del vendedor",
>      "type": "text",
>      "example": "Juan Carlos PÉREZ",
>      "is_array": true,
>      "acts": ["compraventa", "cesion_derechos", "boleto_compraventa", ...]
>    }
>    ```

---

## 8. Archivos de referencia en este proyecto

| Archivo | Contenido |
|---|---|
| `src/variables_catalog.py` | Fuente de verdad de las 782 variables |
| `src/notary_knowledge.py` | Taxonomía de 78 actos y 6 categorías |
| `src/packager.py` | Generador de ZIP (template + metadata) |
| `catalogo_variables_escriar.json` | Export JSON del catálogo completo (generado) |
| `PLAN_INTEGRACION.md` | Este documento |

---

*Generado por EscriAR Template Builder — Fase de integración*
