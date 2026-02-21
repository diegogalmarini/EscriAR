# NotiAR — La Biblia del Proyecto

> **DOCUMENTO MAESTRO COMPARTIDO ENTRE TODOS LOS AGENTES (Claude, Gemini, etc.)**
> Este archivo es el alma del proyecto. Contiene TODO lo que necesitás saber para entender, mantener y extender NotiAR.
> Cada agente que trabaje en el proyecto **DEBE** leer este archivo al inicio y actualizarlo al finalizar su sesión.
> NO crear documentos separados. Este es el único archivo de estado del proyecto.

---

## Índice

1. [Qué es NotiAR](#1-qué-es-notiar)
2. [Stack Tecnológico](#2-stack-tecnológico)
3. [Arquitectura General](#3-arquitectura-general)
4. [Estructura del Proyecto](#4-estructura-del-proyecto)
5. [Base de Datos](#5-base-de-datos)
6. [Pipelines de Ingesta (Extracción AI)](#6-pipelines-de-ingesta-extracción-ai)
7. [Sistema de Skills (Instrucciones para la AI)](#7-sistema-de-skills-instrucciones-para-la-ai)
8. [Sistema RAG (Memoria Legal)](#8-sistema-rag-memoria-legal)
9. [Skills + RAG: Cómo Trabajan Juntos](#9-skills--rag-cómo-trabajan-juntos)
10. [Páginas y Rutas](#10-páginas-y-rutas)
11. [Server Actions (API interna)](#11-server-actions-api-interna)
12. [Componentes Clave](#12-componentes-clave)
13. [Convenciones y Reglas](#13-convenciones-y-reglas)
14. [Archivos Críticos](#14-archivos-críticos)
15. [Estado de Migraciones](#15-estado-de-migraciones)
16. [Hitos Estables](#16-hitos-estables)
17. [Changelog](#17-changelog)
18. [Pendientes Conocidos](#18-pendientes-conocidos)

---

## 1. Qué es NotiAR

**NotiAR** es un SaaS argentino diseñado para **escribanos (notarios públicos)**. Su propósito es digitalizar y automatizar el ciclo completo de una escritura pública:

1. **Ingesta**: el escribano sube un PDF (escritura, título antecedente, certificado) y la AI extrae automáticamente todos los datos estructurados (personas, inmuebles, operaciones, montos, roles).
2. **Gestión**: organiza carpetas notariales con participantes, inmuebles, documentos adjuntos, estados de trámite.
3. **Redacción**: genera borradores de escritura con AI basándose en los datos extraídos.
4. **Liquidación**: calcula impuestos, sellos y aranceles notariales.
5. **Post-firma**: gestiona testimonio, minuta rogatoria, inscripción registral.

### Usuario principal
Un escribano público de Argentina, específicamente de la Provincia de Buenos Aires (Bahía Blanca). El sistema está pensado para derecho argentino, códigos CESBA (Colegio de Escribanos BA), e impuestos ARBA.

### Producto actual en producción
- URL: https://noti-ar.vercel.app/
- El escribano puede: subir PDFs → ver datos extraídos → gestionar carpetas → ver participantes → generar borradores → calcular impuestos básicos.

---

## 2. Stack Tecnológico

| Componente | Tecnología | Versión/Detalle |
|---|---|---|
| **Frontend** | Next.js + React + TypeScript | Next.js 16.1.3, React 19, TypeScript 5 |
| **Estilos** | Tailwind CSS + Shadcn/Radix UI | Tailwind 4, ~20 componentes Shadcn |
| **Backend principal** | Vercel (serverless functions) | Server Actions + API Routes |
| **Worker asíncrono** | Railway (Docker, Node.js) | Polling cada 3s sobre `ingestion_jobs` |
| **Base de datos** | Supabase PostgreSQL | + pgvector para RAG, + RLS habilitado |
| **Autenticación** | Supabase Auth | Email/password, approval por admin |
| **Storage** | Supabase Storage | Bucket `escrituras` (privado, signed URLs) |
| **AI (extracción)** | Google Gemini | `gemini-2.5-flash` (rápido) + `gemini-2.5-pro` (complejo) |
| **AI (embeddings)** | Google `text-embedding-004` | Para RAG (768 dims, cosine similarity) |
| **Monitoring** | Sentry | Error tracking en producción |
| **Deploy frontend** | Vercel | Auto-deploy desde `main` en GitHub |
| **Deploy worker** | Railway | Docker build desde `worker/Dockerfile` |
| **Pendiente** | Resend | Email transaccional (mencionado, no integrado) |

---

## 3. Arquitectura General

```
                     ┌─────────────────────────────────────────────┐
                     │              USUARIO (Escribano)            │
                     │          https://noti-ar.vercel.app         │
                     └───────────┬─────────────────┬───────────────┘
                                 │                 │
                    Sube PDF < 500KB          Sube PDF > 500KB
                                 │                 │
                     ┌───────────▼──────┐   ┌──────▼───────────┐
                     │   Vercel App     │   │   /api/ingest    │
                     │   /api/ingest    │   │   /queue         │
                     │   (sync)         │   │   (encola job)   │
                     └───────┬──────────┘   └──────┬───────────┘
                             │                     │
                             │              ┌──────▼───────────┐
                             │              │  Railway Worker  │
                             │              │  (polling async) │
                             │              └──────┬───────────┘
                             │                     │
                     ┌───────▼─────────────────────▼───────────┐
                     │          Supabase PostgreSQL             │
                     │                                         │
                     │  carpetas → escrituras → operaciones    │
                     │                ↓              ↓         │
                     │           inmuebles   participantes     │
                     │                           ↓             │
                     │                       personas          │
                     │                                         │
                     │  + knowledge_base (RAG, pgvector)       │
                     │  + system_skills (prompts de skills)    │
                     │  + ingestion_jobs (cola async)          │
                     │  + escribanos (datos del notario)       │
                     └─────────────────────────────────────────┘
```

### Dual Pipeline de Ingesta

NotiAR tiene **dos pipelines** para procesar PDFs, ambos hacen lo mismo (extraer datos con Gemini e insertar en BD) pero con distintas capacidades:

| Característica | Frontend (`/api/ingest`) | Worker (Railway) |
|---|---|---|
| **Archivo** | `src/app/api/ingest/route.ts` | `worker/src/index.ts` |
| **Trigger** | Upload directo del usuario | Cola `ingestion_jobs` |
| **Schema AI** | `aiConfig.ts` (Google SDK, más completo) | Zod `NotarySchema` (simplificado) |
| **Capacidades extra** | SkillExecutor, mega-document chunking, model upgrade dinámico, RAG context injection | Inferencia de representación post-inserción |
| **PDFs escaneados** | Timeout de Vercel (~60s) | Gemini File API: PDF completo sin límite de páginas |
| **CESBA codes** | `TaxonomyService` (más preciso) | `getCESBACode()` con taxonomía oficial (mismo JSON) |

**Regla importante**: Cualquier mejora en la lógica de extracción o persistencia debe aplicarse en **AMBOS** pipelines.

---

## 4. Estructura del Proyecto

```
NotiAR/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── actions/                  # 14 server actions (lógica backend)
│   │   ├── admin/users/              # Panel admin (usuarios, escribanos, knowledge)
│   │   ├── api/                      # 8 API routes
│   │   │   ├── ingest/route.ts       # Pipeline sync principal (822+ líneas)
│   │   │   ├── ingest/queue/route.ts # Encola en ingestion_jobs
│   │   │   ├── jobs/[id]/route.ts    # Polling de estado de job
│   │   │   ├── search/people/        # Búsqueda de personas
│   │   │   ├── search/assets/        # Búsqueda de inmuebles
│   │   │   └── admin/clean-storage/  # Limpieza de storage
│   │   ├── carpeta/[id]/             # Vista de una carpeta (FolderWorkspace)
│   │   ├── carpetas/                 # Lista de carpetas
│   │   ├── clientes/                 # Lista + detalle de clientes
│   │   ├── dashboard/                # Dashboard principal
│   │   ├── ficha/[token]/            # Formulario público para clientes
│   │   ├── inmuebles/                # Lista + detalle de inmuebles
│   │   ├── tabla-actos/              # Tabla de taxonomía CESBA
│   │   └── login/ signup/ ...        # Auth pages
│   │
│   ├── components/                   # ~30 componentes React
│   │   ├── FolderWorkspace.tsx        # Vista principal de carpeta (más grande)
│   │   ├── CarpetasTable.tsx          # Tabla de carpetas con RPC
│   │   ├── MagicDropzone.tsx          # Upload de PDFs con drag & drop
│   │   ├── smart/                     # Componentes AI-powered
│   │   │   ├── SmartDeedEditor.tsx    # Editor de escritura con AI
│   │   │   ├── TaxBreakdownCard.tsx   # Desglose de impuestos
│   │   │   └── ComplianceTrafficLight # Semáforo compliance
│   │   └── ui/                        # ~20 primitivos Shadcn/Radix
│   │
│   ├── lib/
│   │   ├── aiConfig.ts               # Schemas de extracción Gemini + model routing
│   │   ├── knowledge.ts              # Motor RAG (embed, chunk, query)
│   │   ├── agent/
│   │   │   ├── SkillExecutor.ts      # Orquestador central de skills AI
│   │   │   └── CrossCheckService.ts  # Triangulación de datos (official vs AI vs manual)
│   │   ├── skills/
│   │   │   ├── deterministic/        # Skills sin AI (puro cálculo)
│   │   │   │   ├── taxCalculator.ts  # Cálculo de impuestos y aranceles
│   │   │   │   └── timelinePlanner.ts # Planificador de plazos
│   │   │   ├── generation/
│   │   │   │   └── deedDrafter.ts    # Generador de texto de escritura
│   │   │   └── routing/
│   │   │       └── documentClassifier.ts # Clasificador de documentos
│   │   ├── services/
│   │   │   └── TaxonomyService.ts    # Asignación de códigos CESBA
│   │   └── utils/
│   │       ├── normalization.ts      # normalizePartido, normalizePartida, etc.
│   │       └── formatters.ts         # formatNotaryMoney, formatNotaryDate, etc.
│   │
│   └── data/
│       └── acts_taxonomy_2026.json   # Taxonomía CESBA (200+ códigos verificados)
│
├── worker/                           # Worker Railway (servicio independiente)
│   ├── src/index.ts                  # Pipeline async completo
│   ├── src/acts_taxonomy_2026.json   # Copia de taxonomía para worker standalone
│   ├── Dockerfile                    # Build Docker para Railway
│   └── package.json                  # Dependencias propias del worker
│
├── supabase_migrations/              # Migraciones SQL (001-030)
│   └── *.sql                         # Se ejecutan MANUAL en Supabase SQL Editor
│
├── .agent/skills/                    # Definiciones de skills (SKILL.md + prompts)
│   ├── notary-*/                     # 18 skills notariales
│   └── skill-creator/                # Meta-skill para crear nuevos skills
│
├── DIARIO.md                         # ← ESTE ARCHIVO (la Biblia)
├── ROADMAP.md                        # Plan de desarrollo en 3 etapas
└── CLAUDE.md                         # Instrucciones para Claude Code
```

---

## 5. Base de Datos

### Modelo Relacional Principal

```
carpetas (1)
    │
    ├── escrituras (N)           ← PDFs subidos a una carpeta
    │       │
    │       ├── operaciones (N)  ← actos jurídicos en cada escritura
    │       │       │
    │       │       └── participantes_operacion (N)  ← quién participa y con qué rol
    │       │               │
    │       │               └── personas (1)  ← registro único de persona
    │       │
    │       └── inmuebles (1)    ← propiedad vinculada a la escritura
    │
    └── ingestion_jobs (N)       ← cola de procesamiento async
```

### Tablas Principales

| Tabla | Columnas Clave | Notas |
|---|---|---|
| `carpetas` | `id`, `caratula`, `estado` (BORRADOR/EN_CURSO/FIRMADA/INSCRIPTA), `ingesta_estado`, `ingesta_paso`, `resumen_ia` | Carpeta = caso notarial. Es el contenedor principal. |
| `escrituras` | `id`, `carpeta_id` FK, `nro_protocolo`, `fecha_escritura`, `registro`, `notario_interviniente`, `inmueble_princ_id` FK, `pdf_url`, `analysis_metadata` JSONB, `contenido_borrador` TEXT, `fecha_firma_real`, `fecha_vencimiento_inscripcion`, `estado_inscripcion` | Cada PDF subido genera una escritura. `analysis_metadata` contiene el resultado crudo de la AI. |
| `operaciones` | `id`, `escritura_id` FK, `tipo_acto`, `monto_operacion`, `codigo` (CESBA), `precio_construccion`, `precio_cesion`, `moneda_cesion`, campos fideicomiso/cesión | Un acto jurídico dentro de una escritura (compraventa, hipoteca, etc.). |
| `participantes_operacion` | `id`, `operacion_id` FK, `persona_id` FK, `rol`, `porcentaje`, `datos_representacion` JSONB | Vincula persona ↔ operación. `datos_representacion`: `{representa_a, caracter, poder_detalle}`. UNIQUE(operacion_id, persona_id). |
| `personas` | `id` UUID, `dni` (string, PK lógica para FISICA), `cuit`, `nombre_completo`, `tipo_persona` (FISICA/JURIDICA/FIDEICOMISO), `nacionalidad`, `fecha_nacimiento`, `estado_civil_detalle`, `domicilio_real` JSONB, `nombres_padres`, `conyuge_nombre`, `conyuge_dni`, `direccion_completa` | Registro único por DNI (físicas) o CUIT (jurídicas). |
| `inmuebles` | `id`, `partido_id`, `nro_partida`, `nomenclatura`, `transcripcion_literal` TEXT, `titulo_antecedente` TEXT, `valuacion_fiscal` | UNIQUE parcial en (partido_id, nro_partida). Transcripción = copia textual del inmueble. Título antecedente = cadena de dominio. |
| `ingestion_jobs` | `id`, `user_id`, `carpeta_id`, `file_path`, `status` (pending/processing/completed/failed), `result_data` JSONB, `error_message`, timestamps | Cola async para el worker Railway. |
| `escribanos` | `id`, `nombre_completo`, `caracter` ENUM (TITULAR/A_CARGO/ADSCRIPTO/INTERINO), `genero_titulo` ENUM (ESCRIBANO/ESCRIBANA/NOTARIO/NOTARIA), `numero_registro`, `distrito_notarial`, `matricula`, `cuit`, `domicilio_legal`, `telefono`, `email`, `is_default` | Datos del escribano autorizante. Se inyectan en borradores de escritura. |
| `knowledge_base` | `id`, `content` TEXT, `embedding` vector(768), `metadata` JSONB | RAG: chunks embedidos con pgvector. Consultados via RPC `match_knowledge`. |
| `system_skills` | `slug`, `content_md` TEXT, `is_active` | Registro de skills: el `content_md` es el prompt/instrucción del skill. |
| `user_profiles` | `id` FK→auth.users, `email`, `full_name`, `approval_status` | Auth: el admin aprueba manualmente a cada usuario nuevo. |
| `fichas_web_tokens` | `id` (token UUID), `persona_id` FK | Tokens para formularios públicos de recolección de datos de cliente. |

### RPCs y Funciones

| Función | Qué hace |
|---|---|
| `search_carpetas(search_term, user_uuid)` | Busca carpetas con full-text. Devuelve estructura plana con `parties[]` JSONB y `escrituras[]` JSONB. Usada por `CarpetasTable`. |
| `match_knowledge(query_embedding, match_threshold, match_count, filter_category)` | Cosine similarity search sobre `knowledge_base`. Devuelve los N chunks más similares. |

### Constraints y Dedup

- **Personas**: FISICA se deduplica por `dni`, JURIDICA por `cuit`
- **Inmuebles**: UNIQUE parcial en `(partido_id, nro_partida)` donde ambos son NOT NULL
- **Escrituras**: UNIQUE parcial en `(nro_protocolo, registro)` donde ambos son NOT NULL
- **Participantes**: UNIQUE en `(operacion_id, persona_id)` con ON CONFLICT DO NOTHING
- **Normalización**: `normalizePartido()` (Title Case sin tildes), `normalizePartida()` (sin puntos)

---

## 6. Pipelines de Ingesta (Extracción AI)

### Flujo Común (ambos pipelines)

```
PDF → Detectar tipo (texto/escaneado) → Enviar a Gemini → Obtener JSON estructurado
→ Insertar/Actualizar en BD: inmueble → escritura → operación → personas → participantes
```

### Frontend Pipeline (`/api/ingest`)

**Archivo**: `src/app/api/ingest/route.ts` (~822 líneas)

1. Recibe `FormData` con archivo + `carpetaId`
2. Sube el PDF a Supabase Storage bucket `escrituras`
3. Usa `SkillExecutor` para clasificar y extraer datos:
   - Primero clasifica el documento (`documentClassifier`)
   - Luego ejecuta el skill apropiado (`notary-entity-extractor`, etc.)
4. Persiste datos extraídos en BD con lógica de dedup
5. Soporta **mega-documents** (>25,000 chars): los divide en chunks por secciones legales

**Schema de extracción**: definido en `src/lib/aiConfig.ts` como `ACTA_EXTRACCION_PARTES_SCHEMA`:
- `entidades[]`: rol, tipo_persona, datos personales completos, representación
- `inmuebles[]`: partido, partida, nomenclatura, transcripción literal, título antecedente
- `detalles_operacion`: precio, fecha, tipo_acto, escribano, registro
- `validacion_sistemica`: coherencia_identidad, observaciones

### Worker Pipeline (Railway)

**Archivo**: `worker/src/index.ts`

1. Polling cada 3 segundos sobre tabla `ingestion_jobs` (status = 'pending')
2. Lock optimista: actualiza a 'processing' con WHERE status = 'pending'
3. Descarga PDF de Storage
4. Detecta si es texto nativo o escaneado (<200 chars de texto = escaneado)
5. **Texto nativo**: envía texto crudo a Gemini con schema Zod `NotarySchema`
6. **Escaneado**: convierte primeras 6 páginas a PNG (200 DPI), envía como Vision
7. Persiste en BD con misma lógica de dedup
8. Marca job como 'completed' o 'failed'

**Schema Zod** (`NotarySchema`): más simplificado que el frontend, pero cubre: clientes (nombre, DNI, CUIT, nacionalidad, estado civil, domicilio, filiación, cónyuge, poder_detalle), inmueble (partido, partida, nomenclatura, transcripción, título antecedente), operación (tipo, monto, moneda, código).

### Routing Dinámico de Modelos Gemini

El `SkillExecutor` (pipeline frontend) usa routing inteligente:

```
Por defecto: gemini-2.5-flash (rápido, barato)
    ↓ upgrade automático si:
    - Palabras clave: HIPOTECA, MUTUO, FIDEICOMISO, CESION
    - Documento > 8,000 chars
    - Múltiples inmuebles detectados
    ↓
gemini-2.5-pro (más preciso, más caro)
```

Fallback: si un modelo falla, intenta con el siguiente en `MODEL_HIERARCHY`.

---

## 7. Sistema de Skills (Instrucciones para la AI)

### ¿Qué es un Skill?

Un **Skill** es una instrucción que le dice a la AI **cómo ejecutar una tarea específica**. Es el "qué hacer" y "cómo hacerlo". Un skill tiene:

1. **Definición** (`.agent/skills/notary-*/SKILL.md`): documento markdown con instrucciones detalladas, ejemplos, reglas de negocio
2. **Registro en BD** (`system_skills` tabla): el `content_md` se carga en Supabase y el `SkillExecutor` lo recupera en runtime
3. **Implementación TS** (opcional, `src/lib/skills/`): código TypeScript para skills deterministas o generadores de templates

### Tipos de Skills

#### A. Skills Deterministas (sin AI, puro código TS)

Estos NO llaman a Gemini. Son funciones TypeScript puras que calculan resultados:

| Skill | Archivo | Qué hace |
|---|---|---|
| `taxCalculator` | `src/lib/skills/deterministic/taxCalculator.ts` | Calcula Sellos PBA (2%), ITI AFIP (1.5%), Honorarios (2%), IVA (21%), Aportes Notariales (15%). Soporta ARS, USD, UVA con tipo de cambio. Exención vivienda única configurable. |
| `timelinePlanner` | `src/lib/skills/deterministic/timelinePlanner.ts` | Planificación inversa desde fecha de firma: calcula cuándo solicitar cada certificado (Dominio, Inhibición, Catastro, Municipal) según jurisdicción PBA. Modos Simple/Urgente con buffer de seguridad. |

#### B. Skills Generadores (template, sin AI en runtime)

| Skill | Archivo | Qué hace |
|---|---|---|
| `deedDrafter` | `src/lib/skills/generation/deedDrafter.ts` | Genera texto de escritura por composición de templates. Arma: encabezado → comparecencia ante escribano (con carácter: Titular/A Cargo/Adscripto/Interino) → comparecientes → intervención → cláusula de venta o hipoteca → inmueble → precio/capital → compliance UIF/PEP → impuestos → cierre. |

#### C. Skills Semánticos (llaman a Gemini vía SkillExecutor)

Estos se ejecutan enviando el prompt del skill + el documento a Gemini:

| Skill | Carpeta `.agent/skills/` | Estado | Qué hace |
|---|---|---|---|
| `notary-document-classifier` | `notary-document-classifier/` | ✅ Implementado | Clasifica un PDF en: ESCRITURA, DNI, PASAPORTE, CERTIFICADO_RPI, BOLETO_COMPRAVENTA, CATASTRO_ARBA. Decide qué extractor usar. |
| `notary-entity-extractor` | `notary-entity-extractor/` | ✅ Implementado | Extrae TODAS las entidades de una escritura: personas (nombre, DNI, CUIT, estado civil, filiación, cónyuge, domicilio), inmuebles, operación, representación. v4.1.0. |
| `notary-mortgage-reader` | `notary-mortgage-reader/` | ✅ Implementado | Extrae términos financieros de hipotecas: capital, UVA, TNA, sistema amortización (Francés), letra hipotecaria. |
| `notary-property-extractor` | `notary-property-extractor/` | ✅ Implementado (cubierto por entity-extractor) | Extrae transcripción literal completa del inmueble sin cortes en saltos de página. |
| `notary-act-coder` | `notary-act-coder/` | ✅ Implementado | Convierte descripción de acto en código CESBA 2026 con alícuota impositiva. |
| `notary-deed-drafter` | `notary-deed-drafter/` | ✅ Prompt definido | Instrucciones de redacción de escritura (complementa el TS generator). Art. 306 CCyC, num2words, asentimiento conyugal. |
| `notary-style-formatter` | `notary-style-formatter/` | 📋 Solo prompt | Normaliza datos al formato notarial: montos en letras, fechas completas, DNI con puntos. |
| `notary-certificate-manager` | `notary-certificate-manager/` | 📋 Solo prompt | Gestión de certificados registrales: vencimientos según Ley 17.801, semáforo de plazos, reserva de prioridad. |
| `notary-rpi-reader` | `notary-rpi-reader/` | 📋 Solo prompt | Lectura de certificados RPI: extrae gravámenes (embargos, hipotecas), inhibiciones, bien de familia. |
| `notary-identity-vision` | `notary-identity-vision/` | 📋 Solo prompt | OCR de DNI/pasaporte con Vision AI. Valida MRZ, cruza frente/dorso. |
| `notary-legal-validator` | `notary-legal-validator/` | 📋 Solo prompt | Valida operación contra reglas legales: Art. 470 CCyC (asentimiento conyugal), datos faltantes, bloqueos registrales. |
| `notary-tax-calculator` | `notary-tax-calculator/` | 📋 Solo prompt (duplicado del TS) | Cálculo impositivo — ya implementado como `taxCalculator.ts`. |
| `notary-uif-compliance` | `notary-uif-compliance/` | 📋 Solo prompt | Compliance AML/UIF: consulta RePET (terrorismo), PEP, justificación de fondos según resoluciones UIF. |
| `notary-registration-exporter` | `notary-registration-exporter/` | 📋 Solo prompt | Genera minuta rogatoria para RPI en formato estructurado (XML/JSON/PDF). |
| `notary-timeline-planner` | `notary-timeline-planner/` | 📋 Solo prompt (duplicado del TS) | Planificación de plazos — ya implementado como `timelinePlanner.ts`. |
| `notary-audit-logger` | `notary-audit-logger/` | 📋 Solo prompt | Hash SHA-256 para trazabilidad. "Libro de Intervención Digital" preparado para blockchain (BFA). |
| `notary-communication-bridge` | `notary-communication-bridge/` | 📋 Solo prompt | Genera mensajes personalizados (email/WhatsApp) para clientes según estado del trámite. |
| `notary-cost-monitor` | `notary-cost-monitor/` | 📋 Solo prompt | Audita consumo de tokens AI, monitorea gastos, gestiona Google Context Caching. |
| `notary-engine-optimizer` | `notary-engine-optimizer/` | 📋 Solo prompt | Asegura uso del modelo Gemini más potente disponible con fallback automático. |

#### D. Skills de Desarrollo (meta-skills para agentes)

Estos están en `.agent/skills/` pero NO son notariales — son instrucciones para los agentes de desarrollo:

| Skill | Qué hace |
|---|---|
| `brainstorming` | Proceso de ideación estructurada |
| `dispatching-parallel-agents` | Cómo lanzar subagentes en paralelo |
| `executing-plans` | Cómo ejecutar un plan paso a paso |
| `finishing-a-development-branch` | Cómo cerrar una rama de desarrollo |
| `receiving-code-review` | Cómo procesar code review |
| `requesting-code-review` | Cómo solicitar code review |
| `subagent-driven-development` | Desarrollo dirigido por subagentes |
| `systematic-debugging` | Debugging sistemático paso a paso |
| `test-driven-development` | TDD con tests primero |
| `using-git-worktrees` | Uso de git worktrees |
| `using-superpowers` | Capacidades especiales del agente |
| `verification-before-completion` | Verificación antes de marcar como completo |
| `writing-plans` | Cómo escribir planes de implementación |
| `writing-skills` | Cómo crear nuevos skills |
| `skill-creator` | Meta-skill que genera nuevos skills |

### SkillExecutor: El Orquestador Central

**Archivo**: `src/lib/agent/SkillExecutor.ts`

Este es el "cerebro" que decide cómo ejecutar cada skill:

```
SkillExecutor.execute(skillSlug, file?, contextData?)
    │
    ├─ "notary-tax-calculator"   → taxCalculator.ts  [determinista, sin AI]
    ├─ "notary-timeline-planner" → timelinePlanner.ts [determinista, sin AI]
    ├─ "notary-deed-drafter"     → DeedDrafter.generate()  [template, sin AI]
    └─ TODOS LOS DEMÁS           → executeSemanticSkill() [Gemini AI]
```

**`executeSemanticSkill()` hace:**
1. Carga el prompt del skill desde `system_skills` en BD
2. Elige el schema JSON apropiado (extracción general o hipotecas)
3. Detecta mega-documentos (>25,000 chars) → los divide en chunks
4. Inyecta contexto RAG si detecta fideicomiso/hipoteca
5. Enruta al modelo Gemini correcto (flash → pro si es complejo)
6. Parsea la respuesta JSON
7. Retorna datos estructurados

### Cómo Agregar un Nuevo Skill

1. **Crear la carpeta** `.agent/skills/notary-mi-skill/SKILL.md` con el prompt e instrucciones
2. **Registrar en BD**: INSERT en `system_skills` con slug = `notary-mi-skill` y content_md = contenido del SKILL.md
3. **Si es determinista**: crear archivo TS en `src/lib/skills/deterministic/` y agregar case en `SkillExecutor.execute()`
4. **Si es semántico**: solo necesita el prompt en BD — `executeSemanticSkill()` lo maneja automáticamente
5. **Si necesita schema de respuesta**: agregar el schema en `aiConfig.ts` y referenciarlo en `SkillExecutor`

---

## 8. Sistema RAG (Memoria Legal)

### ¿Qué es el RAG?

**RAG** (Retrieval-Augmented Generation) es la **"memoria legal"** de NotiAR. Son documentos de referencia que la AI consulta para entender contexto jurídico. En el RAG van:

- Leyes y normativas argentinas
- Doctrina notarial
- Tablas de impuestos
- Resoluciones del Colegio de Escribanos
- Conceptos legales complejos (hipotecas UVA, fideicomisos, etc.)

### Cómo Funciona (end-to-end)

#### Indexación (subir un documento)

```
Admin panel → Sube PDF/DOCX
    │
    ▼
extractText() → texto plano (pdf-parse o mammoth)
    │
    ▼
chunkText() → chunks de 1000 chars con 200 de overlap
             (intenta cortar en límites de oración)
    │
    ▼
Google text-embedding-004 → vector 768 dims por chunk
             (batches de 50)
    │
    ▼
INSERT en knowledge_base (content, embedding, metadata)
             (batches de 100 rows)
```

**Metadata por chunk**: `source_file` (nombre del archivo), `category` (`LEGAL_CONTEXT` | `SYSTEM_TAXONOMY` | `VALIDATION_RULES`), `chunk_index`, `indexed_at`.

#### Consulta (durante extracción AI)

```
SkillExecutor detecta keywords en el documento:
    - "FIDEICOMISO" o "CESIÓN" → busca categoría LEGAL_CONTEXT
    - "HIPOTECA" o "MUTUO"    → busca categoría LEGAL_CONTEXT
    │
    ▼
queryKnowledge(query, category)
    │
    ▼
Embeds la query con text-embedding-004
    │
    ▼
Llama RPC match_knowledge(embedding, threshold=0.4, count=5)
    │
    ▼
Supabase pgvector → cosine similarity → top 5 chunks
    │
    ▼
Se inyecta como "📚 CONTEXTO DE LA BASE DE CONOCIMIENTO" en el prompt de Gemini
```

#### Gestión (Admin Panel)

- **Archivo**: `src/app/actions/knowledge.ts`
- **UI**: Tab "Base de Conocimiento" en `/admin/users`
- `getKnowledgeFiles()` → lista documentos indexados (agrupados por source_file)
- `uploadKnowledgeFile(formData)` → indexa nuevo documento
- `deleteKnowledgeFile(fileName)` → elimina todos los chunks de ese documento

### Documentos Actualmente Indexados

| Documento | Categoría | Para qué sirve |
|---|---|---|
| Conceptos hipotecarios | LEGAL_CONTEXT | Contexto sobre hipotecas UVA, letras hipotecarias, TNA |
| Funciones y Trámites Notariales | LEGAL_CONTEXT | Referencia general del quehacer notarial |

### Cómo Agregar Nuevo Conocimiento

1. Conseguir el PDF o DOCX con contenido legal relevante
2. Ir a `/admin/users` → pestaña "Base de Conocimiento"
3. Subir el archivo → se indexa automáticamente
4. El contenido queda disponible para futuras extracciones AI

**Archivos ideales para agregar**:
- Ley 17.801 (Registro de la Propiedad)
- Código Civil y Comercial (artículos notariales)
- Resoluciones CENN/COLPROBA
- Tablas de aranceles CANN vigentes
- Normativa UIF sobre PEP y umbrales

---

## 9. Skills + RAG: Cómo Trabajan Juntos

La distinción es fundamental:

| Concepto | Analogía | Qué contiene | Dónde vive |
|---|---|---|---|
| **Skill** | "Las instrucciones del chef" | Cómo ejecutar una tarea: pasos, formato, reglas | `.agent/skills/` + `system_skills` en BD + `src/lib/skills/` |
| **RAG** | "La enciclopedia de cocina" | Conocimiento de dominio: leyes, conceptos, tablas | `knowledge_base` en BD (pgvector) |

### Ejemplo concreto

Cuando el escribano sube un PDF de una hipoteca UVA:

1. El **Skill** `notary-entity-extractor` le dice a Gemini: "Extraé las entidades, el capital, la tasa, el sistema de amortización..."
2. El **RAG** le da contexto: "Una hipoteca UVA es un préstamo indexado por Unidad de Valor Adquisitivo del BCRA. La letra hipotecaria escritural se rige por la Ley 24.441..."
3. **Gemini combina ambos**: sabe QUÉ buscar (skill) y ENTIENDE qué significa (RAG).

### Para que la AI aprenda nuevas capacidades necesitás:

| Necesidad | Qué hacer |
|---|---|
| **Nueva tarea** (ej: "extraer gravámenes de certificado RPI") | Crear un nuevo **Skill**: prompt + opcionalmente código TS |
| **Nuevo conocimiento** (ej: "tipos de gravámenes en derecho argentino") | Subir al **RAG**: PDF/DOCX en admin panel |
| **Ambos** | Si la tarea es nueva Y necesita contexto legal, creá el Skill Y subí el conocimiento |

---

## 10. Páginas y Rutas

| Ruta | Página | Descripción |
|---|---|---|
| `/` | Home | Redirect a `/dashboard` o `/login` |
| `/login` | Login | Autenticación con email/password |
| `/signup` | Registro | Formulario de registro (requiere aprobación admin) |
| `/pending-approval` | Esperando | Mensaje mientras el admin aprueba |
| `/unauthorized` | Sin acceso | Acceso denegado |
| `/dashboard` | Dashboard | Resumen: carpetas recientes, alertas de vencimiento, stats |
| `/carpetas` | Carpetas | Lista completa de carpetas con búsqueda (RPC `search_carpetas`) |
| `/carpeta/[id]` | Carpeta | **Vista principal**: FolderWorkspace con tabs (Mesa de Trabajo, Antecedente, Presupuesto, Borrador, etc.) |
| `/clientes` | Clientes | Lista de todas las personas registradas |
| `/clientes/[dni]` | Cliente | Detalle: datos personales, participaciones, carpetas vinculadas |
| `/inmuebles` | Inmuebles | Lista de todos los inmuebles registrados |
| `/inmuebles/[id]` | Inmueble | Detalle: transcripción, datos catastrales, escrituras vinculadas |
| `/ficha/[token]` | Ficha Pública | Formulario que el cliente completa con sus datos (no requiere auth) |
| `/agenda` | Agenda | Calendario de firmas y eventos |
| `/tabla-actos` | Tabla de Actos | Taxonomía CESBA 2026 completa con búsqueda |
| `/admin/users` | Admin | Gestión de usuarios, escribanos, base de conocimiento RAG |

### Tabs de FolderWorkspace (dentro de `/carpeta/[id]`)

| Tab | Valor | Contenido |
|---|---|---|
| **Mesa de Trabajo** | `mesa` | Vacía por ahora (futuro: espacio de trabajo del escribano) |
| **Antecedente** | `antecedente` | Sidebar con escrituras + archivos Storage. Main con tarjetas de participantes. Card de Título Antecedente al final. |
| **Presupuesto** | `budget` | `TaxBreakdownCard` con desglose impositivo |
| **Borrador Inteligente** | `smart-draft` | `SmartDeedEditor` con sugerencias AI |
| **Redacción (Manual)** | `draft` | `DeedEditor` WYSIWYG |
| **Minutas** | `compliance` | `MinutaGenerator` + `AMLCompliance` |
| **Inscripción** | `inscription` | `InscriptionTracker` (solo si carpeta está FIRMADA/INSCRIPTA) |

---

## 11. Server Actions (API interna)

Todas las acciones del servidor están en `src/app/actions/`. Son funciones `"use server"` que Next.js ejecuta en el backend.

### Carpetas y Escrituras

| Archivo | Funciones | Qué hace |
|---|---|---|
| `carpeta.ts` | `createFolder`, `deleteCarpeta`, `updateFolderStatus`, `addOperationToDeed`, `linkPersonToOperation`, `unlinkPersonFromOperation`, `linkAssetToDeed`, `upsertPerson`, `updateRepresentacion` | CRUD de carpetas + vincular personas/inmuebles a operaciones |
| `escritura.ts` | `updateEscritura`, `updateOperacion`, `updateInmueble` | Editar metadatos de escritura, operación e inmueble |
| `inscription.ts` | `markAsSigned`, `updateRegistryStatus`, `getExpiringDeeds` | Workflow post-firma: firma → inscripción RPI. Calcula vencimiento 45 días. Semáforo verde/amarillo/rojo. |

### Personas

| Archivo | Funciones | Qué hace |
|---|---|---|
| `personas.ts` | `createPersona`, `updatePersona`, `deletePersona` | CRUD de personas. `updatePersona` busca por UUID, DNI o CUIT según corresponda. |
| `clientRelations.ts` | `getClientWithRelations` | Deep fetch: persona → participaciones → operaciones → escrituras → carpetas |
| `ficha.ts` + `fichas.ts` | `createFichaToken`, `getFichaByToken`, `submitFichaData`, `generateFichaLink` | Genera link público para que cliente complete sus datos sin autenticarse |

### Escribanos y Admin

| Archivo | Funciones | Qué hace |
|---|---|---|
| `escribanos.ts` | `getEscribanos`, `getDefaultEscribano`, `createEscribano`, `updateEscribano`, `deleteEscribano`, `setDefaultEscribano` | CRUD de escribanos. El `getDefaultEscribano()` se usa para inyectar datos del notario en borradores. |
| `admin.ts` | `getAllUsers`, `approveUser`, `rejectUser`, `deleteUser`, `getUserStats`, `preCreateUser` | Gestión de usuarios: aprobación, rechazo, pre-creación. |
| `knowledge.ts` | `getKnowledgeFiles`, `uploadKnowledgeFile`, `deleteKnowledgeFile` | Gestión del RAG: indexar documentos, listar, eliminar. |

### Otros

| Archivo | Funciones | Qué hace |
|---|---|---|
| `draft.ts` | `generateDeedDraft`, `saveDeedDraft` | Genera borrador de escritura con Gemini + datos de carpeta + escribano. Persiste en `contenido_borrador`. |
| `storageSync.ts` | `listStorageFiles`, `deleteStorageFile`, `getSignedUrl` | Acceso a Supabase Storage. Signed URLs para visualizar PDFs. |
| `inmuebles.ts` | `deleteInmueble` | Eliminar un inmueble. |

---

## 12. Componentes Clave

### Componentes Principales (~30 archivos en `src/components/`)

| Componente | Qué hace |
|---|---|
| `FolderWorkspace.tsx` | **El más grande e importante.** Vista completa de una carpeta con tabs, tarjetas de participantes, sidebar de escrituras, modales de edición. |
| `CarpetasTable.tsx` | Tabla de carpetas con búsqueda. Consume RPC `search_carpetas` (estructura plana con `parties[]` y `escrituras[]`). |
| `MagicDropzone.tsx` | Upload de PDFs con drag & drop. Detecta tamaño y enruta a sync o async. |
| `PersonForm.tsx` | Formulario completo de persona: nombre, DNI, CUIT, estado civil, cónyuge, domicilio, filiación. |
| `PersonSearch.tsx` | Búsqueda de personas existentes para vincular a una operación. |
| `AssetSearch.tsx` | Búsqueda de inmuebles existentes para vincular a una escritura. |
| `DeedEditor.tsx` | Editor WYSIWYG de texto de escritura (modo manual). |
| `StatusStepper.tsx` | Stepper visual del estado de la carpeta. |
| `MinutaGenerator.tsx` | Genera minuta rogatoria para el RPI. |
| `AMLCompliance.tsx` | Verificaciones UIF/AML. |
| `InscriptionTracker.tsx` | Timeline de inscripción registral post-firma. |
| `GlobalSearch.tsx` | Búsqueda global (personas, inmuebles, carpetas). |
| `ClientOutreach.tsx` | Generación de mensajes para clientes. |
| `ExpiringDeedsAlert.tsx` | Alerta de escrituras por vencer plazo de inscripción. |

### Componentes Smart (AI-powered)

| Componente | Qué hace |
|---|---|
| `SmartDeedEditor.tsx` | Editor de escritura con sugerencias AI en tiempo real. |
| `TaxBreakdownCard.tsx` | Desglose de impuestos (Sellos, ITI, Honorarios, IVA). |
| `ComplianceTrafficLight.tsx` | Semáforo de compliance (verde/amarillo/rojo). |

### CrossCheckService

**Archivo**: `src/lib/agent/CrossCheckService.ts`

Servicio de **triangulación de datos** que valida la identidad de una persona comparando 3 fuentes:
- `official`: datos de API oficial (AFIP, RENAPER)
- `extracted`: datos extraídos por AI del documento
- `manual`: datos ingresados manualmente por el usuario

**Lógica**: DNI/CUIT = comparación estricta numérica. Nombres = fuzzy Levenshtein (tolerancia 5 chars para tildes/typos).
**Estados**: `MATCH_TOTAL` | `REVIEW_REQUIRED` | `CRITICAL_DISCREPANCY` (bloquea la operación).

---

## 13. Convenciones y Reglas

### Naming

- **"Código"** (no "Nº de Acto"): campo `codigo` en tabla `operaciones`. Pedido del Notario.
- **Personas Físicas**: formato `APELLIDO, Nombre` — apellidos SIEMPRE en MAYÚSCULAS.
- **Personas Jurídicas**: nombre tal cual, NO invertir. Ej: `BANCO DE LA NACION ARGENTINA` (correcto), NO `ARGENTINA BANCO...` (incorrecto).

### Base de Datos

- Storage bucket: **`escrituras`** (NO `documents`).
- `pdf_url`: el pipeline frontend guarda URL pública completa, el worker guarda path crudo. `resolveDocumentUrl()` maneja ambos.
- `personas` PK lógica: `dni` para FISICA, `cuit` para JURIDICA. `id` es UUID interno.
- Migraciones SQL: en `supabase_migrations/`, numeradas 001-030. Se ejecutan **MANUAL** en Supabase SQL Editor.
- **Normalización**: `normalizePartido()` (Title Case sin tildes), `normalizePartida()` (sin puntos decorativos), `splitMultiplePartidas()` (separa "X / Y").

### Códigos CESBA (campo `codigo` en `operaciones`)

| Tipo de Acto | Código | Notas |
|---|---|---|
| COMPRAVENTA | `100-xx` | `-00` normal, `-51` vivienda única exenta sellos, `-24` plan social |
| DONACION | `200-xx` | Empieza en `200-30`, NO existe `200-00` |
| HIPOTECA/PRÉSTAMO | `300-xx` | |
| CANCELACION HIPOTECA | `311-xx` | |
| CESION | `400-xx` | |
| PODER | `500-xx` | |
| FIDEICOMISO | `121-xx` | |

### UI / Frontend

- `CarpetasTable` consume RPC `search_carpetas` (estructura PLANA: `parties[]`, `number`, NO queries anidadas).
- `FolderWorkspace` maneja roles con `getRoleLabel()` y `getRoleBadgeStyle()`.
- Roles soportados: COMPRADOR, VENDEDOR, CEDENTE, CESIONARIO, ACREEDOR, DEUDOR, APODERADO, CONDOMINO, DONANTE, DONATARIO, FIDUCIANTE, MUTUARIO, GARANTE, REPRESENTANTE, TRANSMITENTE.
- Documentos se visualizan con signed URLs: `getSignedUrl('escrituras', path)`.
- Persona Jurídica: `isJuridica()` checa `tipo_persona`/`cuit` para no invertir nombre.

### Escribano Autorizante

- Datos del escribano por defecto: `getDefaultEscribano()`.
- Carácter: TITULAR | A_CARGO | ADSCRIPTO | INTERINO.
- Se inyecta en prompts AI y en `DeedDrafter` para la fórmula: `"ante mí, [NOMBRE], Escribano [a cargo del / Titular del / Adscripto al / Interino del] Registro número [N], del Distrito Notarial de [distrito]"`.

---

## 14. Archivos Críticos

**NO modificar sin entender el contexto completo.**

| Archivo | Qué hace | Líneas aprox. |
|---|---|---|
| `src/app/api/ingest/route.ts` | Pipeline sync de ingesta — el archivo más complejo | ~822 |
| `worker/src/index.ts` | Pipeline async (Railway worker) | ~600 |
| `src/components/FolderWorkspace.tsx` | Vista de carpeta — el componente más grande | ~1400 |
| `src/lib/agent/SkillExecutor.ts` | Orquestador de skills AI | ~500 |
| `src/lib/aiConfig.ts` | Schemas de extracción + model routing + pricing | ~300 |
| `src/lib/knowledge.ts` | Motor RAG (embed, chunk, query) | ~200 |
| `src/components/CarpetasTable.tsx` | Tabla de carpetas (RPC search_carpetas) | ~300 |
| `src/lib/services/TaxonomyService.ts` | Asignación de códigos CESBA | ~200 |
| `src/data/acts_taxonomy_2026.json` | Taxonomía de actos ARBA (verificada 100%) | JSON |
| `worker/src/acts_taxonomy_2026.json` | Copia de taxonomía para worker standalone | JSON |

---

## 15. Estado de Migraciones

| Migración | Descripción | Estado |
|-----------|-------------|--------|
| 001–023 | Setup inicial, auth, storage, schemas, RPC, fideicomiso, ingestion_jobs | ✅ Ejecutadas |
| 024 | `datos_representacion JSONB` en participantes_operacion | ✅ Ejecutada |
| 025 | Dedup personas, normalizar DNI | ✅ Ejecutada |
| 026 | UNIQUE constraints anti-duplicados (participantes, inmuebles, escrituras) | ✅ Ejecutada |
| 027 | Normalizar partido (Title Case) y partida (sin puntos) | ✅ Ejecutada |
| 028 | Normalizar tildes en partido + merge duplicados con FK remap | ✅ Ejecutada |
| 029 | Dedup personas jurídicas por CUIT (merge canónico) | ⚠️ **PENDIENTE** |
| 030 | Agregar telefono/email a escribanos + A_CARGO enum + datos Galmarini | ✅ Ejecutada |

**Nota**: las migraciones se ejecutan MANUAL en Supabase SQL Editor. No hay sistema de migración automático.

---

## 16. Hitos Estables

### Enero 2026
1. **Extracción de Inmuebles (Literal)** — Transcripción técnica completa sin recortes
2. **Gestión Integral de Clientes** — Fuente única de verdad, dedup por DNI/Upsert
3. **Diferenciación Persona Jurídica** — ID automática por CUIT, UI adaptada
4. **Estandarización de Apellidos** — MAYÚSCULAS, soporte compuestos
5. **Fideicomisos y Cesiones** — Roles complejos, doble precio ARS/USD
6. **Hipotecas UVA y Créditos BNA** — TNA, UVA, Plazo, roles Acreedor/Deudor
7. **Motor RAG** — Búsqueda semántica legal con pgvector
8. **Mega-Document Chunking** — División por secciones para PDFs de 49+ págs

### Febrero 2026
9. **Fix updatePersona** — Busca por UUID/DNI/CUIT según corresponda
10. **Nuevo Cliente Dual** — Modo rápido (link) + completo (formulario)
11. **Ficha Pública Cónyuge** — Campo dinámico al seleccionar "Casado/a"
12. **Formatos: solo PDF y DOCX** — Removido soporte `.doc`
13. **Sistema anti-duplicados completo** — Dedup en personas, inmuebles, escrituras, participantes
14. **Normalización de datos** — Title Case partidos, partidas sin puntos, tildes
15. **CUIT como ID canónico para jurídicas** — Lookup por CUIT antes de generar SIN_DNI
16. **Representación (Apoderados)** — JSONB con `representa_a`, `caracter`, `poder_detalle`
17. **Perfil de escribano completo** — Teléfono, email, carácter A_CARGO, datos oficiales Galmarini
18. **Reestructura de tabs** — Nuevo tab "Antecedente" con contenido previo de "Mesa de trabajo"
19. **Worker: PDF completo via File API** — Eliminado límite de 6 páginas, ahora procesa documentos escaneados completos
20. **Taxonomía CESBA unificada** — Worker usa el mismo JSON oficial de 822 códigos; corregidos bugs (CESION=834, USUFRUCTO=400, DONACION=200-30)
21. **Limpieza de logs diagnósticos** — Eliminados 15 console.log de debug en pipeline de ingesta

---

## 17. Changelog

### 2026-02-21 (Claude) — Sesión 2: Deuda técnica crítica

#### Worker: Eliminado límite de 6 páginas (File API)
Problema: `convertPdfToImages(fileBuffer, 6)` solo procesaba las primeras 6 páginas de PDFs escaneados. Escrituras bancarias de 30-40 páginas perdían cónyuges, clausulas UIF y firmas.

- Reemplazado: conversión a imágenes PNG → **Gemini File API** (`GoogleAIFileManager`)
- El PDF completo se sube a Google, Gemini lo procesa nativamente sin límite de páginas
- Limpieza automática: archivo temporal local + archivo en Gemini File API
- Agregada dependencia `@google/generative-ai` al worker

#### Taxonomía CESBA unificada
Problema: el worker tenía un mapeo manual con bugs graves — CESION→400 (es USUFRUCTO), PODER→500 (es AFECTACION A VIVIENDA), USUFRUCTO→150 (no existe), DONACION buscaba -00 (no existe, es -30).

- Reemplazadas 3 constantes y función `getCESBACode()` con mapeo verificado contra JSON oficial
- Todos los códigos validados contra `acts_taxonomy_2026.json` (822 códigos)
- Fallback: búsqueda por description en el JSON de taxonomía
- Corregido: CESION=834-00, USUFRUCTO=400-00, DONACION=200-30, AFECTACION BIEN FAMILIA=500-32

#### Limpieza de logs diagnósticos
- Eliminados 15 console.log de debug en `src/app/api/ingest/route.ts` (data dumps, traces por entidad, safety-net diagnósticos)
- Mantenidos 12 logs operacionales (inicio pipeline, routing, errores, dedup significativo)
- Eliminada variable `oldRol` sin uso

### 2026-02-21 (Claude) — Sesión 1: Cambios mayores

#### Integridad de Datos — Sistema anti-duplicados completo
Problema: al re-subir un PDF se duplicaban personas, inmuebles, escrituras y participantes.
Solución implementada en AMBOS pipelines (frontend `/api/ingest` Y worker Railway):

- **Dedup participantes**: upsert con `ON CONFLICT DO NOTHING` (UNIQUE constraint en operacion_id+persona_id)
- **Dedup inmuebles**: UNIQUE index parcial en (partido_id, nro_partida). Lookup antes de INSERT
- **Dedup escrituras**: UNIQUE index parcial en (nro_protocolo, registro). Lookup antes de INSERT
- **Dedup operaciones**: si la escritura ya tiene operación, la reutiliza
- **Migración 026**: constraints en BD ✅ EJECUTADA

#### Normalización de datos
Problema: "Monte Hermoso" vs "MONTE HERMOSO", "Bahía Blanca" vs "Bahia Blanca" generaban duplicados.

- **`normalizePartido()`**: Title Case + strip accents
- **`normalizePartida()`**: quita puntos decorativos
- **`splitMultiplePartidas()`**: separa "X / Y" en 2 inmuebles
- Migraciones 027+028 ✅ EJECUTADAS

#### Personas Jurídicas — CUIT como ID canónico
Problema: BANCO DE LA NACION ARGENTINA aparecía 3 veces con distintos SIN_DNI.

- Fix en ambos pipelines: JURIDICA usa CUIT como PK
- Migración 029 ⚠️ PENDIENTE

#### Representación (Apoderados)
- Migración 024: columna `datos_representacion JSONB` ✅ EJECUTADA
- Frontend ingest: captura representación desde schema AI
- Worker Railway: infiere representación post-inserción
- Worker Zod: campo `poder_detalle` para Gemini
- UI: tarjeta de APODERADO muestra "Representando a" y "Poder Otorgado"

#### Roadmap
- Creado `ROADMAP.md` — 3 etapas, 14 hitos, criterios de aceptación

#### Escribano Autorizante
- Migración 030: telefono, email, enum A_CARGO ✅ EJECUTADA
- Datos oficiales del Escribano Galmarini (matrícula 5317, registro 70, Bahía Blanca)
- Carácter A_CARGO en form, badge, DeedDrafter y draft.ts

#### Reestructura de Tabs
- Tab "Antecedente": todo el contenido previo de "Mesa de trabajo" + tarjeta "Título Antecedente"
- Tab "Mesa de trabajo": vacío (placeholder para futuro espacio de trabajo)
- Quitada tarjeta "Título Antecedente" de `/inmuebles/[id]`

### 2026-02-20 (Claude)

#### Worker Railway — fixes críticos
- `tipo_inmueble: 'SIN CLASIFICAR'` violaba CHECK → eliminado
- `nomenclatura_catastral` → `nomenclatura` (nombre correcto)
- Job status: se marcaba `completed` ANTES de insertar → movido al final
- Esquema expandido: de ~5 a 12 campos/persona
- Código CESBA: worker ahora asigna via `getCESBACode()`

#### Seguridad
- Eliminado `error.stack` de respuestas API
- `SUPER_ADMIN_EMAILS` a env var
- Logs verbosos eliminados en producción

#### UI
- Roles: CONDOMINO, DONANTE, DONATARIO, FIDUCIANTE, MUTUARIO, GARANTE, REPRESENTANTE, TRANSMITENTE
- Signed URLs para documentos (fix 404)
- `CarpetasTable` alineada con RPC

### 2026-02-20 (Gemini)
- `search_carpetas` RPC reescrito: estructura aplanada con `parties[]` JSONB
- Renaming `nro_acto` → `codigo` en BD y UI
- Taxonomía CESBA sincronizada 100%
- Tabla de Actos: paginación, dropdown fix, búsqueda

---

## 18. Pendientes Conocidos

### Urgentes (hacer antes de seguir con ROADMAP)
- [ ] **Ejecutar migración 029** en Supabase SQL Editor (dedup personas jurídicas por CUIT)
- [ ] **Verificar `poder_detalle`** funciona tras redeploy Railway (subir un PDF con apoderado)
- [ ] **Redeploy Worker** en Railway para activar: File API (sin límite páginas) + taxonomía CESBA unificada

### Deuda técnica
- [ ] Integración con Resend para emails transaccionales

### Roadmap
- **Ver `ROADMAP.md`** para el plan completo de desarrollo en 3 etapas
- Próximos hitos: 1.1 Certificados, 1.3 Ficha Comprador, 1.4 Determinación Acto (pueden ir en paralelo)

---

> **PROTOCOLO AL TERMINAR UNA SESIÓN DE TRABAJO:**
> 1. Agregar cambios realizados en la sección 17 (Changelog) con tu nombre de agente y fecha
> 2. Actualizar sección 15 (Migraciones) si creaste alguna nueva
> 3. Actualizar sección 18 (Pendientes) si resolviste algo o descubriste nuevos pendientes
> 4. Si creaste un skill nuevo, agregarlo en la sección 7
> 5. Si subiste un documento al RAG, agregarlo en la sección 8
> 6. Firmar con tu nombre de agente
>
> **Última actualización**: 2026-02-21 (sesión 2) — Claude
