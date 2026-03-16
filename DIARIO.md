# EscriAR — La Biblia del Proyecto

## Sesión 27: Fix Bucle Infinito Subida Escritura + Workflow Health-Check
**Fecha:** 2026-03-16
**Agente:** Antigravity AI
**Objetivo:** Resolver el bug donde subir un PDF en Protocolo dejaba el sistema en "Analizando documento con IA..." indefinidamente. Crear sistema de monitoreo de infraestructura.

### Problema resuelto
- Al subir una escritura PDF en la sección Protocolo, el sistema se quedaba en polling infinito. El flujo: `uploadEscrituraPdf()` → sube PDF → crea job `ESCRITURA_EXTRACT` en `ingestion_jobs` → el frontend hace polling cada 5s esperando `extraction_status = COMPLETADO`. **El worker de Railway estaba caído** → nadie procesaba el job → el status nunca cambiaba → bucle infinito.
- Se encontró un registro stuck: escritura #58 (`26f3870c`) con `extraction_status = PENDIENTE` indefinidamente. Se marcó como ERROR en Supabase directamente para desbloquear el frontend.

### Error del agente (corregido)
- **Intento erróneo**: Se creó un endpoint inline `/api/protocolo/extract` que intentaba ejecutar la extracción con Gemini directamente desde Vercel. Esto habría fallado porque **Vercel tiene timeout de ~60 segundos** y la extracción IA puede tardar 30-60+ segundos en PDFs complejos.
- **Corrección**: Se revirtió completamente el endpoint inline y los fire-and-forget en `protocolo.ts`. La extracción debe ejecutarse **exclusivamente en Railway**, que no tiene timeout corto.

### ⚠️ REGLA DE ARQUITECTURA CRÍTICA (grabada a fuego)

| Servicio | Responsabilidad | Timeout |
|----------|----------------|---------|
| **Vercel** | Frontend + API Routes livianas | ~60s (serverless) |
| **Railway** | Worker de extracción pesada (Gemini, PDFs, OCR) | Sin límite |
| **GitHub** | Fuente de verdad — ambos despliegan desde `main` | N/A |

> **NUNCA** poner lógica de extracción IA pesada (Gemini) en API Routes de Vercel.
> **NUNCA** se verá un cambio si no se actualiza GitHub.
> Si Railway cae, TODAS las extracciones de escrituras se quedan en bucle infinito.

### Workflow `/health-check` creado
- `.agent/workflows/health-check.md`: verifica los 3 servicios críticos:
  1. **GitHub**: commits sin pushear, archivos sin commitear
  2. **Vercel**: que el frontend responda sin errores 500
  3. **Railway**: que el worker esté corriendo (healthcheck HTTP)
  4. **Supabase**: queries SQL para detectar jobs y registros stuck

### Cambios realizados
- `src/app/actions/protocolo.ts`: limpio, sin fire-and-forget (solo crea job → Railway lo procesa)
- `.agent/workflows/health-check.md`: NUEVO — workflow de monitoreo de infraestructura
- Eliminado: `src/app/api/protocolo/extract/` (endpoint inline peligroso)
- DB fix directo: escritura #58 marcada como ERROR para desbloquear polling

---

## Sesión 26: Fix Falsos Positivos de Protocolo y Enlaces Rotos
**Fecha:** 2026-03-15
**Agente:** Antigravity AI
**Objetivo:** Resolver el bug crítico donde clientes exhibían decenas de documentos "Fuente: Protocolo" irrelevantes por matcheos parciales de nombre, y reparar los enlaces `pdf_url` rotos.

### Problema resuelto
- La lógica de "Hybrid Search 360" en `src/app/actions/clientRelations.ts` usaba un simple chequeo `.includes()` o un Regex muy permisivo sobre la versión stringificada de la data JSON (`analysis_metadata` y `extraction_data`). Esto causaba que un cliente llamado "Adriana Cristina FARINA" matcheara con documentos que mencionaban la "calle Farina", llenando su pestaña de documentos de basura (Falsos Positivos).
- Los documentos provenientes de `protocolo_registros` apuntaban a un storage bucket equivocado ("protocolo") causando errores 404, en vez de apuntar a donde la ingesta IA depositaba los PDFs procesados ("escrituras").

### Cambios realizados
- `src/app/actions/clientRelations.ts`: Se refactorizó la lógica de búsqueda de protocolo. Ahora, un cliente solo matchea con un documento de Protocolo si su DNI, su CUIT, o la totalidad de su nombre coincide de forma **ESTRICTA** contra los arrays de `entidades` o `clientes` extraídos por la IA y almacenados en los JSON. Se eliminó la búsqueda laxa e irresponsable.
- Visualización de PDFs: Las views o retornos del servidor se ajustaron para apuntar los PDFs relacionados al bucket correcto unificado.
- Verificación humana-like: Un agente de navegador (browser subagent) comprobó las vistas "Documentos" de múltiples clientes en el servidor local sin encontrar falsos positivos y confirmando que los "Ver PDF" funcionaban.

---

## Sesión 25: Corrección de Login OAuth (Google) y Flujo PKCE SSR
**Fecha:** 2026-03-13
**Objetivo:** Resolver el error `PKCE code verifier not found in storage` emitido por `@supabase/ssr` durante el proceso de autenticación con Google Auth.

### Problema resuelto
El entorno CSR usaba el `implicit` Auth Flow de Supabase dentro del cliente `supabaseClient.ts`, lo que rompía la lógica de cookies de servidor (PKCE) necesaria por Next.js SSR Routing y Middleware. Al usar Google Login, la redirección se enviaba a un fallback de cliente `callback-client`, el cual no tenía acceso al Code Verifier para validar con Supabase.

### Cambios realizados
- **Client Supabase:** Se eliminó `flowType: 'implicit'` de `src/lib/supabaseClient.ts`, restaurando el modo PKCE por default.
- **Login/Signup Pages:** Se modificaron las rutas redirigidas `signInWithOAuth` en `src/app/login/page.tsx` y `src/app/signup/page.tsx` para usar la ruta oficial de Servidor `/auth/callback`, permitiéndole al Router App Server configurar correctamente las cookies seguras.
- **Limpieza de Código:** Se eliminó la carpeta obsoleta de enrutamiento en cliente `src/app/auth/callback-client` para forzar que el stack dependa 100% de Cookies gestionadas vía el paquete oficial `@supabase/ssr`.## Sesión 24: Fix Trazabilidad Documental y URLs PDF
**Fecha:** 2026-03-13
**Objetivo:** Reparar el bug crítico de "Documentos Relacionados" (Trazabilidad) en Inmuebles y Clientes donde las resoluciones de fuentes PROTOCOLO y literales perdían el vínculo al PDF de almacenamiento.

### Problema resuelto
- Las extracciones de los documentos de PROTOCOLO o historiales de TRAMITE (cuyos PDFs quedaron vinculados a través de `protocolo_registros`) arrojaban `null` o vacío cuando se visualizaban en la entidad `Cliente` o `Inmueble`, imposibilitando la visualización del archivo escaneado original.
- El UI (Frontend) etiquetaba la fuente equivocadamente o mostraba `Desconocido` en lugar de la procedencia.

### Cambios realizados
- `src/app/actions/clientRelations.ts`: Se expandió la consulta de `escrituras` a Supabase incluyendo la selección relacional bidireccional `protocolo_registro_parent/child:protocolo_registros(...)`. Se implementó un mapeo seguro para resolver rutas del bucket de *escrituras* para entregar URLs completas `publicUrl`.
- `src/app/actions/inmuebleRelations.ts`: Implementado el mismo motor de resolución dual (parent/child) vía FK de Supabase, habilitando el botón de "Ver PDF" para historiales y extracciones literales provenientes de Protocolo.
- `src/app/inmuebles/[id]/page.tsx`: Modificada la capa de presentación para procesar y renderizar "Protocolo" o "Trámite" en lugar del fallback por defecto.
## Sesión 23: Trazabilidad Completa Protocolo → Escritura + Dedup con Sugerencias
**Fecha:** 2026-03-13
**Agente:** Claude Opus 4.6
**Objetivo:** Crear cadena de trazabilidad completa desde upload en Protocolo hasta entidades (personas, inmuebles), implementar dedup inteligente con sugerencias, y agregar pestaña "Documentos" en ficha de cliente.

### Problema resuelto
- "Seguimiento de Escrituras" extraía datos livianos pero NO creaba la cadena persona ← participante ← operación ← escritura ← PDF.
- El re-ingest batch creó 57 carpetas huérfanas con nombres de archivo PDF como carátula.
- La dedup hacía upsert silencioso sobreescribiendo datos existentes sin avisar.
- Los clientes no tenían pestaña "Documentos Relacionados" (los inmuebles sí).

### Cambios realizados

#### Migración 062: Schema trazabilidad
- `escrituras.protocolo_registro_id` → enlace bidireccional con `protocolo_registros.escritura_id`
- `sugerencias.carpeta_id` ahora nullable (protocolo no tiene carpeta)
- `sugerencias.protocolo_registro_id` para vincular sugerencias a registros de protocolo

#### Migración 063: Cleanup carpetas huérfanas
- SELECT COUNT verificó 57 carpetas con carátula `.pdf` + estado COMPLETADO
- DELETE ejecutado — carpetas reales de usuario no afectadas

#### Worker: Trazabilidad completa en ESCRITURA_EXTRACT
- Resolución de org_id via `organizaciones_users` para crear sugerencias
- Dedup personas: compara nombre, estado_civil, nacionalidad, domicilio; crea `DEDUP_PERSONA` si hay diffs
- Dedup inmuebles: compara nomenclatura y transcripcion_literal; crea `DEDUP_INMUEBLE` si hay diffs
- Crea escritura (`source='PROTOCOLO'`, `carpeta_id=null`) + operación + participantes
- Actualiza `protocolo_registros.escritura_id` back-reference

#### applySuggestion: Handlers nuevos
- `DEDUP_PERSONA`: actualiza persona con datos extraídos (manejo especial domicilio_real como `{literal}`)
- `DEDUP_INMUEBLE`: actualiza inmueble con datos extraídos

#### Clientes: Pestaña "Documentos"
- `clientRelations.ts`: enriquece retorno con escrituras vinculadas, tipo_acto y rol del cliente
- Nuevo componente `ClientDocumentosList.tsx` (cards con N° escritura, fecha, tipo acto, rol, PDF, carpeta, fuente)
- `clientes/[dni]/page.tsx`: 5ta pestaña "Documentos" con badge count

### Archivos creados/modificados
- `supabase_migrations/062_protocolo_traceability.sql` — NUEVO
- `supabase_migrations/063_cleanup_orphan_carpetas.sql` — NUEVO
- `worker/src/index.ts` — trazabilidad + dedup
- `src/lib/deterministic/applySuggestion.ts` — handlers DEDUP
- `src/app/actions/clientRelations.ts` — documentos en retorno
- `src/components/ClientDocumentosList.tsx` — NUEVO
- `src/app/clientes/[dni]/page.tsx` — pestaña Documentos

### Pendientes identificados
- [ ] Dedup con sugerencias en `persistIngestedData` (flujo MagicDropzone) — solo worker tiene dedup
- [ ] RLS para escrituras con `carpeta_id=null` (source=PROTOCOLO) — policies actuales filtran por carpeta.org_id
- [ ] Vista global de sugerencias pendientes (las de protocolo no tienen carpeta, no aparecen en ApuntesTab)

---

## Sesión 22: Limpieza Final ITI y Reorganización de Terminología
**Fecha:** 2026-03-12
**Objetivo:** Finalizar la derogación del ITI y actualizar la terminología de Actos.

### Cambios Realizados:
- **Limpieza ITI**: Eliminación de residuos de ITI en `PresupuestoTab.tsx` (state duplicado y lógicas de retención).
- **Terminología**: 
    - Actualizado "ACTOS PROTOCOLARES" a "ESCRITURAS" en `acts_taxonomy_2026.json`.
    - Actualizado "Acto Privado/Protocolar" a "Instrumento Privado/Escritura" en `GenerarActuacionDialog.tsx`.
    - Actualizado mensajes de estado vacío en `ActuacionesPanel.tsx` con la nueva terminología.
- **Navegación Sidebar**: Reorganización de la barra lateral en `AppShell.tsx` para incluir "Modelos" y "Jurisdicciones" como secciones de primer nivel.
- **Nuevas Páginas**: Creadas `/app/modelos/page.tsx` y `/app/jurisdicciones/page.tsx`.
- **Admin Panel**: Eliminación de pestañas duplicadas en `/admin/users/page.tsx`.
- **Server Actions**: Actualizada la revalidación de caché en `modelos.ts` y `jurisdicciones.ts`.

---



> **DOCUMENTO MAESTRO COMPARTIDO ENTRE TODOS LOS AGENTES (Claude, Gemini, etc.)**
> Este archivo es el alma del proyecto. Contiene TODO lo que necesitás saber para entender, mantener y extender EscriAR.
> Cada agente que trabaje en el proyecto **DEBE** leer este archivo al inicio y actualizarlo al finalizar su sesión.
> NO crear documentos separados. Este es el único archivo de estado del proyecto.

---

## Índice

1. [Qué es EscriAR](#1-qué-es-escriar)
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

## 1. Qué es EscriAR

**EscriAR** es un SaaS argentino diseñado para **escribanos (notarios públicos)**. Su propósito es digitalizar y automatizar el ciclo completo de una escritura pública:

1. **Ingesta**: el escribano sube un PDF (escritura, título antecedente, certificado) y la AI extrae automáticamente todos los datos estructurados (personas, inmuebles, operaciones, montos, roles).
2. **Gestión**: organiza carpetas notariales con participantes, inmuebles, documentos adjuntos, estados de trámite.
3. **Redacción**: genera borradores de escritura con AI basándose en los datos extraídos.
4. **Liquidación**: calcula impuestos, sellos y aranceles notariales.
5. **Post-firma**: gestiona testimonio, minuta rogatoria, inscripción registral.

### Usuario principal
Un escribano público de Argentina, específicamente de la Provincia de Buenos Aires (Bahía Blanca). El sistema está pensado para derecho argentino, códigos CESBA (Colegio de Escribanos BA), e impuestos ARBA.

### Producto actual
- URL de Producción: https://escriar.com
- El escribano puede: subir PDFs → ver datos extraídos → gestionar carpetas → ver participantes → generar borradores → calcular impuestos básicos.

### Modelo de Negocio y Pricing (SaaS B2B)
EscriAR está posicionado como un software de misión crítica **Enterprise / B2B** de alto valor agregado.
- **Pricing Objetivo:** ~$500 USD mensuales por escribanía (o planes por volumen de escrituras).
- **Value Proposition (ROI):** EscriAR reemplaza horas de *data entry* legal y liquidación de impuestos propenso a errores humanos (multas ARBA/AFIP), justificando ampliamente su costo frente al salario y cargas sociales de un empleado administrativo dedicado.
- **Margen Operativo:** Permite utilizar los modelos de IA más avanzados y costosos del mercado (Gemini 2.5 Pro / Claude 3.5 Sonnet / etc.) sin comprometer la rentabilidad, ya que el grueso de la tarifa absorbe los costos variables por token.
- **Requisitos Técnicos Críticos para este Precio:**
  1. **Zero Downtime:** Infraestructura PRO obligatoria (Supabase Pro, Railway Pro, Vercel Pro).
  2. **Multi-tenancy RLS estricto:** Es de vida o muerte la separación de datos entre organizaciones. Un escribano NUNCA debe poder ver los datos u operaciones de otra jurisdicción o colega.
  3. **Trazabilidad y Seguridad:** Logs detallados (Sentry) y auditoría inmutable (Skill `notary-audit-logger` con Hashing SHA-256).

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
                     │          https://escriar.vercel.app         │
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

EscriAR tiene **dos pipelines** para procesar PDFs, ambos hacen lo mismo (extraer datos con Gemini e insertar en BD) pero con distintas capacidades:

| Característica | Frontend (`/api/ingest`) | Worker (Railway) |
|---|---|---|
| **Archivo** | `src/app/api/ingest/route.ts` | `worker/src/index.ts` |
| **Trigger** | Upload directo del usuario | Cola `ingestion_jobs` |
| **Schema AI** | `aiConfig.ts` (Google SDK, más completo) | Zod `NotarySchema` (simplificado) |
| **Capacidades extra** | SkillExecutor, mega-document chunking, model upgrade dinámico, RAG context injection | Inferencia de representación post-inserción |
| **PDFs escaneados** | Timeout de Vercel (~60s) | Gemini File API: PDF completo sin límite de páginas (cleanup en `finally`) |
| **CESBA codes** | `TaxonomyService` (más preciso) | `getCESBACode()` con taxonomía oficial (mismo JSON) |

**Regla importante**: Cualquier mejora en la lógica de extracción o persistencia debe aplicarse en **AMBOS** pipelines.

---

## 4. Estructura del Proyecto

```
EscriAR/
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
│   │   ├── guia-tramites/            # Guía de trámites notariales (PBA/CABA)
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
│       ├── acts_taxonomy_2026.json   # Taxonomía CESBA (200+ códigos verificados)
│       └── catalogo_tramites_notariales.json # Catálogo de 84 trámites, 19 categorías (PBA/CABA)
│
├── worker/                           # Worker Railway (servicio independiente)
│   ├── src/index.ts                  # Pipeline async completo
│   ├── src/noteAnalyzer.ts           # Análisis de apuntes con Gemini Flash (NOTE_ANALYSIS + TRAMITE_REQUERIDO)
│   ├── src/certExtractor.ts          # Extractor de certificados con Gemini 2.5 Pro (ET7)
│   ├── src/acts_taxonomy_2026.json   # Copia de taxonomía para worker standalone
│   ├── Dockerfile                    # Build Docker para Railway
│   └── package.json                  # Dependencias propias del worker
│
├── supabase_migrations/              # Migraciones SQL (001-047)
│   └── *.sql                         # Se ejecutan MANUAL en Supabase SQL Editor
│
├── .agent/skills/                    # Definiciones de skills (SKILL.md + prompts)
│   ├── notary-*/                     # 19 skills notariales
│   └── skill-creator/                # Meta-skill para crear nuevos skills
│
├── CONTEXTO_PARA_AGENTES.md          # 🧠 Qué es EscriAR (Arquitectura y Dominio)
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
    ├── escrituras (N)           ← source: INGESTA (antecedente PDF) o TRAMITE (operación activa)
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
| `escrituras` | `id`, `carpeta_id` FK, `source` (INGESTA/TRAMITE), `nro_protocolo`, `fecha_escritura`, `registro`, `notario_interviniente`, `inmueble_princ_id` FK, `pdf_url`, `analysis_metadata` JSONB, `contenido_borrador` TEXT, `fecha_firma_real`, `fecha_vencimiento_inscripcion`, `estado_inscripcion` | Cada PDF subido crea escritura INGESTA (antecedente). La operación activa vive en escritura TRAMITE. `source` separa fuentes de verdad. |
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
| `search_carpetas(search_term, p_limit, p_offset)` | Busca carpetas con full-text. Devuelve estructura plana con `parties[]` JSONB y `escrituras[]` JSONB. **Parties y escrituras SOLO de source=TRAMITE**. Búsqueda sí incluye INGESTA. Usada por `CarpetasTable`. |
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
| `taxCalculator` | `src/lib/skills/deterministic/taxCalculator.ts` | Calcula Sellos PBA (2%), Ganancias Global (3%), Honorarios (2%), IVA (21%), Aportes Notariales (15%). Soporta ARS, USD, UVA con tipo de cambio. Exención vivienda única configurable. |
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
| `notary-procedures-catalog` | `notary-procedures-catalog/` | ✅ Implementado | Catálogo exhaustivo de certificados, impuestos, registros y actos administrativos para escrituras PBA/CABA (2026). Lee `resources/source_data.md` como fuente de conocimiento curada desde NotebookLM. |
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

**RAG** (Retrieval-Augmented Generation) es la **"memoria legal"** de EscriAR. Son documentos de referencia que la AI consulta para entender contexto jurídico. En el RAG van:

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
| `/tabla-actos` | Tabla de Actos | Taxonomía CESBA 2026 completa con búsqueda, header fijo, sin scroll horizontal |
| `/guia-tramites` | Guía de Trámites | Catálogo de 84 trámites notariales (PBA/CABA) con buscador, filtros por jurisdicción/fase, acordeones por categoría |
| `/admin/users` | Admin | Gestión de usuarios, escribanos, base de conocimiento RAG |

### Layout de FolderWorkspace (dentro de `/carpeta/[id]`)

**Usa Tabs (Shadcn) con 4 pestañas.** Header `CarpetaHero` fijo arriba.

| Pestaña | value | Componente | Contenido |
|---|---|---|---|
| **Mesa de Trabajo** (default) | `mesa-trabajo` | `FaseRedaccion` | Borrador Inteligente (IA) + DeedEditor manual |
| **Antecedentes** | `antecedentes` | `WorkspaceRadiography` | Documento Original, Inmueble, Partes Intervinientes, Archivos (full width) |
| **Pre-Escriturario** | `pre-escritura` | `FasePreEscritura` | Certificados + TaxBreakdown + Liquidación y Honorarios |
| **Post-Firma** | `post-escritura` | `FasePostEscritura` | Minuta + AMLCompliance + InscriptionTracker |

`WorkspacePipeline.tsx` exporta 3 componentes: `FasePreEscritura`, `FaseRedaccion`, `FasePostEscritura`.

---

## 11. Server Actions (API interna)

Todas las acciones del servidor están en `src/app/actions/`. Son funciones `"use server"` que Next.js ejecuta en el backend.

### Carpetas y Escrituras

| Archivo | Funciones | Qué hace |
|---|---|---|
| `carpeta.ts` | `createFolder`, `deleteCarpeta`, `updateFolderStatus`, `addOperationToDeed`, `linkPersonToOperation`, `unlinkPersonFromOperation`, `linkAssetToDeed`, `upsertPerson`, `updateRepresentacion` | CRUD de carpetas + vincular personas/inmuebles a operaciones. `updateFolderStatus` publica en protocolo automáticamente al pasar a FIRMADA. |
| `escritura.ts` | `updateEscritura`, `updateOperacion`, `updateInmueble` | Editar metadatos de escritura, operación e inmueble |
| `inscription.ts` | `markAsSigned`, `updateRegistryStatus`, `getExpiringDeeds` | Workflow post-firma: firma → inscripción RPI. Calcula vencimiento 45 días. Semáforo verde/amarillo/rojo. `markAsSigned` publica en protocolo automáticamente. |

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
| `protocolo.ts` | `createProtocoloRegistro`, `updateProtocoloRegistro`, `deleteProtocoloRegistro`, `getProtocoloRegistro`, `uploadEscrituraPdf`, `confirmEscrituraExtraction`, `retryEscrituraExtraction`, **`publishToProtocolo`** | CRUD protocolo + PDF upload + extracción AI. **`publishToProtocolo(carpetaId)`**: mapea datos de carpeta→protocolo_registros determinísticamente. Idempotente (upsert por carpeta_id). |
| `storageSync.ts` | `listStorageFiles`, `deleteStorageFile`, `getSignedUrl` | Acceso a Supabase Storage. Signed URLs para visualizar PDFs. |
| `inmuebles.ts` | `deleteInmueble` | Eliminar un inmueble. |

---

## 12. Componentes Clave

### Componentes Principales (~30 archivos en `src/components/`)

| Componente | Qué hace |
|---|---|
| `AppShell.tsx` | Layout global: sidebar con navegación (incluye "Guía de Trámites" con icono ClipboardList), topbar, responsive. |
| `FolderWorkspace.tsx` | **Orquestador.** State, handlers, realtime subscriptions, dialogs. Renderiza CarpetaHero + Tabs (4 pestañas: Mesa de Trabajo, Antecedentes, Pre-Escriturario, Post-Firma). |
| `WorkspaceRadiography.tsx` | **Pestaña Antecedentes** (full width). Datos extraídos read-only: Documento, Inmueble, Partes, Archivos. Sin `<details>`, DNI/CUIT siempre visible, line-clamp-4 con "Ver más". |
| `WorkspacePipeline.tsx` | Exporta 3 componentes: `FasePreEscritura` (Certificados + Tax + Liquidación), `FaseRedaccion` (Borrador IA + Editor), `FasePostEscritura` (Minuta + Compliance + Inscripción). |
| `CarpetaHero.tsx` | Header de carpeta: carátula, badge estado, chips de certificados en vivo (vencidos/por vencer/vigentes/pendientes/sin confirmar), botón eliminar con AlertDialog, botón "Protocolo" manual (visible en FIRMADA/INSCRIPTA). |
| `CarpetasTable.tsx` | Tabla de carpetas con búsqueda. Consume RPC `search_carpetas` (estructura plana con `parties[]` y `escrituras[]`). |
| `ApuntesTab.tsx` | Tab de apuntes con análisis AI: renderiza sugerencias tipo TRAMITE_REQUERIDO con links clickeables a organismos, badges de jurisdicción (PBA/CABA) y costos. Polling automático, retry, skeletons. |
| `CertificadoDialog.tsx` | Modal alta/edición de certificados con drag & drop para subir PDF (reemplazó campo URL manual). Auto-trigger de extracción AI al subir. |
| `CertificadosPanel.tsx` | Panel de certificados con ExtractionCard: estados de extracción AI, evidencia expandible, botones Confirmar/Re-analizar. Semáforo Vigente/Por Vencer/Vencido. |
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
| `TaxBreakdownCard.tsx` | Desglose de impuestos (Sellos, Ganancias Global, Honorarios, IVA). |
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
- Migraciones SQL: en `supabase_migrations/`, numeradas 001-047. Se ejecutan **MANUAL** en Supabase SQL Editor.
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
| `src/components/FolderWorkspace.tsx` | Orquestador de carpeta (state + dialogs) | ~800 |
| `src/components/WorkspaceRadiography.tsx` | Columna izquierda — datos extraídos | ~450 |
| `src/components/WorkspacePipeline.tsx` | Columna derecha — pipeline notarial | ~130 |
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
| 029 | Dedup personas jurídicas por CUIT (merge canónico) | ✅ Ejecutada |
| 030 | Agregar telefono/email a escribanos + A_CARGO enum + datos Galmarini | ✅ Ejecutada |
| 031 | Tabla certificados | ✅ Ejecutada |
| 032 | Tabla gravámenes con FK a carpetas, inmuebles, personas, certificados | ✅ Ejecutada |
| 033 | Campos profesion, regimen_patrimonial, nro_documento_conyugal en personas | ✅ Ejecutada |
| 035 | Tabla modelos_actos — Templates DOCX para actos notariales | ✅ Ejecutada |
| 037 | Columna rendered_docx_path en tabla escrituras para Documentos Generados | ✅ Ejecutada |
| 038 | Organizaciones, org_users, RLS multi-tenant, search_carpetas | ✅ Ejecutada |
| 039 | Fix recursión infinita RLS con SECURITY DEFINER | ✅ Ejecutada |
| 040 | Tablas apuntes + sugerencias, RLS por org, triggers updated_at | ✅ Ejecutada |
| 041 | Extender ingestion_jobs: job_type, payload, entity_ref, org_id para NOTE_ANALYSIS | ✅ Ejecutada |
| 042 | Audit columns en sugerencias: applied_at, applied_by, apply_error, applied_changes | ✅ Ejecutada |
| 043 | Tabla actuaciones | ✅ Ejecutada |
| 044 | Columna `source` en escrituras (INGESTA/TRAMITE) + crear escrituras TRAMITE | ✅ Ejecutada |
| 045 | search_carpetas: parties y escrituras SOLO de TRAMITE | ✅ Ejecutada |
| 046 | Mover participantes huérfanos de INGESTA a TRAMITE (cleanup) | ✅ Ejecutada |
| 047 | Extracción AI de certificados (ET7): job_type CERT_EXTRACT, campos extraction en certificados | ✅ Ejecutada |
| 048 | Protocolo: pdf_storage_path, carpeta_id, flexibilizar nro_escritura para errose | ✅ Ejecutada |
| 049 | Protocolo: columnas de extracción AI (extraction_status, extraction_result, extraction_job_id) | ✅ Ejecutada |
| 051 | ET12: tabla jurisdicciones + campos partido_code/delegacion_code en inmuebles | ✅ Ejecutada |
| 052 | ET13: tablas presupuestos, presupuesto_items y presupuesto_honorarios | ✅ Ejecutada |

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
22. **Seguridad File API** — Cleanup de PDFs en Gemini en bloque `finally` (purga garantizada)
23. **Worker actualiza `carpeta.ingesta_estado`** — Fix crítico: las carpetas procesadas por worker async ahora pasan a COMPLETADO/ERROR correctamente

24. **Refactor visual "Centro de Comando"** — Tabs eliminados, layout 2 columnas permanente (Radiografía + Pipeline)
25. **Modularización FolderWorkspace** — Extraído WorkspaceRadiography.tsx y WorkspacePipeline.tsx
26. **UX notarial mejorada** — DNI/CUIT siempre visible, line-clamp-4, p-6, text-sm, fases numeradas

27. **Rollback a Tabs** — 4 pestañas (Mesa de Trabajo, Antecedentes, Pre-Escriturario, Post-Firma) por decisión PO
28. **Card Liquidación y Honorarios** — inputs Precio Real + Honorarios en pestaña Pre-Escriturario

### Marzo 2026
29. **ET1-ET7 completadas** — Todas las etapas del ARCHITECTURE_PLAN cerradas (ver ARCHITECTURE_PLAN.md)
30. **Integración Template Builder** — 34 modelos DOCX procesados y subidos a Supabase, dropdown dinámico, pipeline render completo
31. **Skill `notary-procedures-catalog`** — Con `source_data.md` (21 secciones de conocimiento notarial 2026, curado desde NotebookLM)
32. **Página Guía de Trámites** — 84 trámites en 19 categorías (PBA/CABA) con buscador, filtros, acordeones
33. **TRAMITE_REQUERIDO** — Nuevo tipo de sugerencia AI que propone links a organismos cuando el escribano escribe un apunte
34. **Worker Railway deployado** — NOTE_ANALYSIS enriquecido + CERT_EXTRACT + TRAMITE_REQUERIDO activos en producción
35. **Extracción AI de certificados (ET7)** — `certExtractor.ts` con Gemini 2.5 Pro, drag & drop en CertificadoDialog, ExtractionCard con Confirmar/Re-analizar
36. **CarpetaHero con chips de certificados** — Indicadores en vivo: vencidos/por vencer/vigentes/pendientes/sin confirmar

### ✅ Etapa 1 CERRADA: Ingesta y Estudio de Títulos
Pipeline dual (frontend sync + worker async Railway) 100% funcional y estabilizado. Gemini File API sin límite de páginas, taxonomía CESBA unificada, seguridad de archivos, estado de carpeta sincronizado. Testeado con PDFs complejos (escrituras multipartitas, documentos escaneados 30+ páginas).

---

## 17. Changelog

### 2026-03-16 (Antigravity) — Fix Bucle Infinito Escritura + Health-Check Workflow
- **Bug**: subir PDF en Protocolo → sistema en polling infinito. Causa: **Railway worker caído**.
- **Error del agente**: se creó un endpoint inline en Vercel para extracción → revertido porque Vercel tiene timeout ~60s, insuficiente para Gemini.
- **Corrección**: Railway reiniciado por usuario. Código revertido a depender 100% de Railway para extracción.
- **DB fix**: escritura #58 stuck con `PENDIENTE` → marcada como `ERROR`.
- **Nuevo**: `.agent/workflows/health-check.md` — verifica GitHub + Vercel + Railway + Supabase.
- **Regla**: NUNCA poner extracción IA pesada en Vercel. Railway = worker sin timeout.

### 2026-03-15 (Copilot) — Creación de Documento Onboarding para Agentes y Corrección CESBA
- Se detectó un error crítico en los códigos CESBA para actos que no tributan sellos (Actas, Certificacioones, Poderes, etc.). Todo el sistema, desde el Template Builder, les asignaba \800-02\ (Actos con Objetos Varios, gravado 1.2%) en vez de \800-32\ (No Gravados).
- **Template Builder**: Modificado \src/act_codes.py\ forzando todos los actos no gravados a usar \800-32\. Cero ocurrencias restantes de \800-02\.
- **SaaS**: Creado script \C:\Users\diego\EscriAR\fix_cesba_codes.sql\ para actualizar en la tabla \modelos_actos\ todos los templates que ya fueron importados con la mala parametrización, y corregido el código \metadata\.
- **Organización de AI**: Creado el documento abstracto \CONTEXTO_PARA_AGENTES.md\ con la vista 10,000 pies de la arquitectura (por qué, cómo, para quién). Indicado en la estructura de este DIARIO para que todos lo lean antes de tocar la BD o sugerir lógicas espurias.

### 2026-03-12 08:07 — Alineación de Prioridades (Notario)

- Se incorpora directiva operativa del día: **primero** ajustes de pestañas/UI según feedback del notario.
- Se define **Presupuesto** como paso crítico **pre-carpeta**: si el cliente no acepta, **no** se crea carpeta ni se persisten datos finales.
- Se aclara alcance de Presupuestos: soportar variantes múltiples con campos manuales personalizados y campos calculados.
- Se alinea planificación entre documentos: `ROADMAP.md` concentra prioridades inmediatas; `ARCHITECTURE_PLAN.md` mantiene estado técnico de implementación por etapas.

### 2026-03-09 (Claude) — ET16, ET12b, ET17: Compartir, Admin Jurisdicciones, Pre-carga

#### ET17 — Pre-carga automática en PresupuestoTab
- Los campos se llenan al abrir la pestaña usando datos de carpeta, operación, inmueble y participantes
- Campos: tipo_acto, monto, moneda, cotización, VF, tipo inmueble, cantidad inmuebles/personas, jurisdicción, VU, Bco Provincia, fecha adquisición, cert no retención, urgencia, honorarios, legalizaciones, apostillas
- Fix: import useEffect movido al top-level (import en medio del componente causaba build error del otro agente)

#### ET16 — Compartir presupuesto por WhatsApp, email y clipboard
- Componente `CompartirPresupuestoDialog` con 3 canales de envío
- Integrado en PresupuestoTab

#### ET12b — Panel Admin Jurisdicciones (completado)
- JurisdictionResolver ahora lee de DB con caché TTL 5min + fallback JSON
- Panel admin CRUD + filtros + bulk toggle en `/admin/users`
- Server actions para create, update, delete, toggle jurisdicciones

### 2026-03-08 (Claude) — ET13, ET14, ET15: Sistema de Presupuestos, Exportación a PDF y Sellos CABA

#### ET15 — Soporte Sellos CABA en PresupuestoEngine
- Selector de Jurisdicción (PBA / CABA) en `PresupuestoTab`.
- Lógica de alícuotas escalonadas para CABA (0%, 2%, 3%, 3.6%) implementada en `cabaTaxCalculator.ts`.
- Cálculo dinámico dependiendo de la jurisdicción seleccionada en el engine unificado.

#### ET14 — PDF Export de Presupuesto Notarial
- Integración de `jsPDF` y `jspdf-autotable`.
- Botón "Descargar PDF" funcional en la pestaña pre-escritura.
- Documento generado con resumen general para el cliente y detalle analítico (impuestos, aportes, CABA/PBA, exenciones).

#### ET13 — Unificación de Calculadores en PresupuestoEngine
- Nuevo motor `PresupuestoEngine` como *single source of truth* para costos.
- Tab Presupuesto movido lógicamente en la carpeta después de Mesa de Trabajo.
- Eliminado `LiquidacionPanel` (deprecated) y reemplazado por `LiquidacionResumen`.
- Tablas `presupuestos`, `presupuesto_items` y `presupuesto_honorarios` introducidas en la migración 052 para persistencia estruturada de las liquidaciones al cliente.

### 2026-03-08 (Claude) — ET12: Motor Jurisdiccional Notarial

#### ET12a — Resolver Determinístico + Integración
- Tabla `jurisdicciones` (migración 051) con 135 partidos PBA, códigos ARBA oficiales y delegaciones CESBA
- `JurisdictionResolver.ts` (frontend singleton) + `jurisdictionResolver.ts` (worker standalone) — patrón Cerebro Híbrido: AI extrae texto, TS resuelve códigos
- Matching: normalización (lowercase, strip accents) → exact match aliases → containment match
- Integración en `ingest/route.ts` y `worker/index.ts`: al persistir inmuebles, resuelve `partido_code` + `delegacion_code` automáticamente
- `buildTemplateContext.ts` mapea códigos resueltos al template context para minutas/certificados
- JSON compartido `src/data/pba_2026_jurisdictions.json` usado por ambos resolvers

#### ET12b — Admin UI Jurisdicciones
- Nueva pestaña "JURISDICCIONES" en `/admin/users` (lazy loaded)
- CRUD completo: crear, editar, eliminar partidos con códigos y aliases
- Stats cards (total, activos, inactivos, delegaciones)
- Filtros por búsqueda, estado activo/inactivo, provincia
- Toggle activo/inactivo individual y bulk por provincia
- Server actions en `src/app/actions/jurisdicciones.ts`

#### Corrección de datos seed
- Auditoría reveló ~80% de códigos ARBA incorrectos en seed original (sistema de codificación desconocido, no ARBA/Geodesia)
- Verificación contra fuente oficial: https://www.arba.gov.ar/archivos/Publicaciones/codigospartidos.html
- Correcciones clave: José C. Paz=132 (no 131 duplicado), Ezeiza=130, Zárate=038, Arrecifes=010, Lezama=137
- Fix columnas DB: seed usaba nombres en español, DB usa inglés (`jurisdiction_id`, `party_name`, `party_code`)
- Fix onConflict: alineado con UNIQUE constraint `(jurisdiction_id, version, party_code)`
- Fix seed script: crear Supabase client directo (ESM hoisting impedía carga de dotenv antes de import)

### 2026-02-23 (Antigravity) — Sesión 1: Ficha de Poderes y Estabilización Visual

#### Módulo de Poderes (Retrocompatibilidad e UI)
- Migración ejecutada para crear la tabla `poderes` y almacenar relaciones estructuradas entre Otorgante y Apoderado.
- Creación de modal `FichaPoderDialog` para ingesta de datos de poderes (Nro Escritura, Registro, Archivo adjunto).
- Unificación: `getClientWithRelations` ahora fusiona poderes de la nueva tabla con los poderes *históricos* (extraídos del JSONB `datos_representacion` en `participantes_operacion`).
- Vista en Ficha del Cliente (`ClientPoderesList`) incluye un badge de "Histórico" para los heredados de operaciones previas.

#### Parser RegEx para Poderes Históricos
- Problema: Los poderes extraídos de operaciones previas tenían los metadatos (fecha, escribano, registro, número) agrupados como un gran párrafo en prosa.
- Solución: Se agregó `extractPoderData` (regex parser) en `clientRelations.ts` para extraer estas variables limpiamente sin requerir llamadas costosas a IA, rellenando los campos "N/A" automáticamente en la interfaz.

#### Corrección del Bucle Infinito en Ingesta
- Problema: El cartel "Procesando operación..." de `CarpetaHero` colapsaba el frontend eternamente si el webhook fallaba en actualizar `ingesta_estado` a completado, bloqueando el acceso a los datos.
- Solución: La UI ahora ignora agresivamente el `"PROCESANDO"` si detecta que la base de datos ya contiene un `tipo_acto` válido para esa operación, lo que indica que la extracción fue sustancialmente exitosa. Esta lógica también se aplicó a `CarpetasTable`.

#### Arquitectura de IA de Negocio (Decisión: Oráculo vs Agente)
- Se acordó mantener los manuales legales (leyes, códigos, tablas RPI/ARBA) guardados en una instancia externa de NotebookLM.
- Esta instancia actuará como "Oráculo Legal" manejado por el usuario Escribano, cuyas directivas destiladas se pasarán luego al Agente de Código para crear las directivas de extracción o *Skills*, para evitar saturar el contexto semántico del Agente Programador.

### 2026-02-22 (Claude) — Sesión 5: Rollback a Tabs — Separación por roles
#### Rollback de 2 columnas → 4 pestañas (Tabs Shadcn)
- Eliminado layout `grid grid-cols-1 lg:grid-cols-12` de 2 columnas permanentes
- Restaurado sistema `<Tabs>` con 4 pestañas por decisión del Product Owner (carga cognitiva)
- Pestañas: **Mesa de Trabajo** (default, redacción), **Antecedentes** (radiografía full width), **Pre-Escriturario** (certificados + impuestos), **Post-Firma** (minuta + compliance + inscripción)

#### Modularización de WorkspacePipeline.tsx en 3 exports
- `FasePreEscritura`: Certificados, TaxBreakdownCard, nuevo Card "Liquidación y Honorarios" (inputs Precio Real + Honorarios)
- `FaseRedaccion`: Borrador Inteligente (IA) + DeedEditor manual
- `FasePostEscritura`: MinutaGenerator + AMLCompliance + InscriptionTracker
- Eliminados números gigantes (PhaseHeader con círculos 1/2/3) — las pestañas organizan el flujo
- WorkspaceRadiography ahora ocupa full width (eliminado `lg:col-span-4 lg:sticky`)

### 2026-02-22 (Claude) — Sesión 4: Refactor visual "Centro de Comando"

#### Eliminación de Tabs → Layout 2 columnas permanente
- Eliminado sistema de `<Tabs>` con 7 pestañas (mesa, antecedente, budget, smart-draft, draft, compliance, inscription)
- Reemplazado por grid `lg:grid-cols-12` con 2 columnas permanentes: Radiografía (4) + Pipeline (8)
- Eliminada fricción de navegación entre pestañas — todo visible en una sola vista

#### Modularización de FolderWorkspace.tsx (~1400 → ~800 líneas)
- **Nuevo: `WorkspaceRadiography.tsx`** (~450 líneas) — Columna izquierda read-only
  - Cards: Documento Original, Inmueble, Partes Intervinientes, Archivos
  - Sin `<details>` para datos clave — DNI/CUIT/Rol siempre visibles
  - `line-clamp-4` con botón "Ver más" para transcripción literal y título antecedente
  - Padding `p-6`, font `text-sm` mínimo para datos legales
  - Participantes en lista vertical compacta (1 columna)
- **Nuevo: `WorkspacePipeline.tsx`** (~130 líneas) — Columna derecha workflow
  - 3 fases con `PhaseHeader` numerado (círculo + text-xl + Separator)
  - Fase 1: Certificados (inputs fecha + badge Pendiente) + TaxBreakdownCard
  - Fase 2: Borrador IA (botón prominente) + DeedEditor manual en `<details>`
  - Fase 3: MinutaGenerator + AMLCompliance + InscriptionTracker (condicional)
  - `space-y-16` entre fases para separación radical
- **FolderWorkspace.tsx** simplificado a orquestador: state, handlers, realtime, dialogs

#### CarpetaHero con botón eliminar
- Movido AlertDialog de eliminación de carpeta al componente CarpetaHero
- Props `onDelete` + `isDeleting` — Trash2 icon junto al badge de estado

#### Limpieza de imports
- Eliminados ~18 imports no utilizados (Tabs, Card, ScrollArea, StatusStepper, AlertDialog, etc.)
- Funciones `getRoleBadgeStyle`/`getRoleLabel` movidas a WorkspaceRadiography

### 2026-02-21 (Claude) — Sesión 3: Estabilización final Etapa 1

#### Bug crítico: Worker no actualizaba `carpeta.ingesta_estado`
- El worker marcaba `ingestion_jobs.status = 'completed'` pero **nunca tocaba** `carpetas.ingesta_estado`
- Las carpetas procesadas por el worker async quedaban eternamente en `PROCESANDO`
- Fix: el worker ahora actualiza `carpetas.ingesta_estado` → `'COMPLETADO'` (éxito) o `'ERROR'` (fallo)
- Esto dispara el realtime listener del frontend, que refresca la UI automáticamente
- También se incluye `ingesta_paso` con mensaje descriptivo en ambos casos

#### Seguridad: Gemini File API cleanup en `finally`
- `fileManager.deleteFile()` movido de `try` a `finally` en `worker/src/index.ts`
- Variable `geminiFileName` trackeada fuera del `try` para garantizar purga
- PDFs ya no quedan cacheados 48h en servidores Google si `generateObject()` falla

#### Cierre de Etapa 1: Ingesta y Estudio de Títulos — 100% funcional
Pipeline de ingesta asíncrona con Gemini File API testeado con PDFs complejos (escrituras multipartitas, documentos escaneados de 30+ páginas). Ambos pipelines (frontend sync + worker async) producen resultados equivalentes y actualizan el estado de la carpeta correctamente.

### 2026-02-21 (Claude) — Sesión 2: Deuda técnica crítica

#### Worker: Eliminado límite de 6 páginas (File API)
Problema: `convertPdfToImages(fileBuffer, 6)` solo procesaba las primeras 6 páginas de PDFs escaneados. Escrituras bancarias de 30-40 páginas perdían cónyuges, clausulas UIF y firmas.

- Reemplazado: conversión a imágenes PNG → **Gemini File API** (`GoogleAIFileManager`)
- El PDF completo se sube a Google, Gemini lo procesa nativamente sin límite de páginas
- **Seguridad**: limpieza garantizada en bloque `finally` — el PDF se purga de servidores Google incluso si la llamada al LLM falla (evita caché de 48h en Google)
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

### 2026-02-23 (Antigravity) — Sesión 2: Gestor de Certificados (Hito 1.1)

#### Backend y Base de Datos
- Creación de migración SQL `031_create_certificados_table.sql` para alojar metadatos de los certificados (tipo, estado, fechas, nro, pdf, etc.).
- Definición de tipos TypeScript estrictos (`Certificado`, `CertificadoInsert`, `CertificadoUpdate`, `TipoCertificado`, `EstadoCertificado`).
- Creación de Endpoints Server Actions CRUD en `src/app/actions/certificados.ts` (`getCertificadosPorCarpeta`, `createCertificado`, `updateCertificado`, `deleteCertificado`).

#### Interfaz de Usuario (UI)
- Implementación de `CertificadosPanel.tsx` con listado reactivo y Badges dinámicos tipo **Semáforo** (Vigente, Por Vencer > 3 días, Vencido).
- Creación de modal `CertificadoDialog.tsx` que actúa como formulario híbrido de alta y edición con inputs acotados a los enums estrictos de la tabla.
- Integración del Panel dentro del hub central de la carpeta (`WorkspacePipeline.tsx` / `FasePreEscritura.tsx`), en reemplazo del los componentes estáticos "mockeados". 

### 2026-02-23 (Antigravity) — Sesión 3: Lector RPI y Cruce de Inhibiciones (Hito 1.2)

#### AI Skill
- Actualización de `notary-rpi-reader.ts`: se agregó extracción de `persona_inhibida_dni` al JSON Schema para Gemini.

#### Backend y Base de Datos
- Migración `032_create_gravamenes_table.sql`: tabla de gravámenes (EMBARGO, HIPOTECA, INHIBICION, etc.) con FK a `carpetas`, `inmuebles`, `personas`, `certificados`.
- Server Actions CRUD en `src/app/actions/gravamenes.ts` con tipos estrictos (`Gravamen`, `GravamenInsert`, `GravamenUpdate`).
- `analyzeCertificadoRPI` en `ai-analysis.ts`: ahora persiste automáticamente cada gravamen detectado por Gemini en la tabla `gravamenes`, incluyendo nombre y DNI de persona inhibida en observaciones.

#### Interfaz de Usuario (UI)
- `EstudioDominioPanel.tsx`: semáforo de dominio (Libre / Observado / **BLOQUEO: Parte Inhibida**), cruce de DNIs de participantes vs. inhibiciones, alerta roja crítica bloqueante.
- `WorkspacePipeline.tsx`: extracción de DNIs únicos de participantes y propagación al panel.

### 2026-02-23 (Antigravity) — Sesión 4: Ficha Completa del Comprador (Hito 1.3)

#### Base de Datos
- Migración `033_personas_add_escritura_fields.sql`: columnas `profesion`, `regimen_patrimonial` (CHECK: COMUNIDAD/SEPARACION_BIENES), `nro_documento_conyugal`.

#### Backend
- `fichas.ts` (`submitFichaData`) y `personas.ts` (`updatePersona`): persisten los 3 campos nuevos.

#### Interfaz de Usuario (UI)
- `PersonForm.tsx`: sección "Estado Civil, Profesión y Filiación" con campo Profesión, panel amber condicional (cuando casado) con Cónyuge, DNI Cónyuge y Select de Régimen Patrimonial.
- `FichaForm.tsx` (ficha pública `/ficha/[token]`): mismos campos con lógica condicional.
- `WorkspacePipeline.tsx`: tarjetas de participantes muestran profesión e indicador "⚠ Ficha incompleta" si faltan datos.

### 2026-02-26 (Claude Opus) — Fix crítico: Error 500 en panel de administración

#### Bug resuelto: Server actions crasheaban en /admin/users
- **Causa raíz**: `SUPPORTED_ACT_TYPES` (const array) se exportaba desde `modelos.ts` que tiene `"use server"`. Next.js registraba la constante como server action en el manifiesto, rompiendo el módulo completo en runtime de Vercel. Como todas las actions de `/admin/users` comparten módulo, el 500 afectaba a `getAllUsers`, `getUserStats` y `getEscribanos`.
- **Fix**: Creado `src/app/actions/modelos-types.ts` (sin `"use server"`) con `ModeloActo` interface y `SUPPORTED_ACT_TYPES` constante. `modelos.ts` ahora solo exporta funciones async.
- **Lección**: Los archivos `"use server"` SOLO deben exportar funciones async. Exportar constantes, arrays u objetos rompe el runtime de server actions.

#### Limpieza de 10 commits de debug fallidos
- Eliminados `console.log` de debug excesivos en `admin.ts` y `escribanos.ts` agregados por agente anterior que intentó arreglar el 500 sin éxito.

#### Migración 035 confirmada ejecutada
- La tabla `modelos_actos` ya existía en producción. Se subieron 2 modelos: Compraventa (30 vars) y Autorización Vehicular (24 vars).

### 2026-03-06 (Antigravity) — Skill `notary-procedures-catalog` + Guía de Trámites + UI refinements

#### Nuevo Skill: `notary-procedures-catalog`
- Creado `.agent/skills/notary-procedures-catalog/SKILL.md` — especialista en listado exhaustivo de certificados, impuestos, registros y actos administrativos para escrituras en PBA y CABA (2026).
- Lee siempre `resources/source_data.md` como fuente de conocimiento curada desde NotebookLM antes de responder.
- Responsabilidades: consulta de requisitos, identificación de impuestos, validación jurisdiccional, mantenimiento del conocimiento.

#### Nueva Página: Guía de Trámites (`/guia-tramites`)
- Creado `src/app/guia-tramites/page.tsx` — página completa con buscador, filtros por jurisdicción (PBA/CABA) y fase (Previo, Pre-escriturario, Escriturario, Post-escriturario), acordeones por categoría con expand/collapse.
- Creado `src/data/catalogo_tramites_notariales.json` — catálogo de 84 trámites en 19 categorías con costos 2026, links a organismos externos, y metadata.
- Agregado item "Guía de Trámites" al sidebar en `src/components/AppShell.tsx` con icono `ClipboardList`.

#### Tabla de Actos — UI Refinements
- Header fijo (sticky) con título, buscador y botón "Ver PDF Oficial" — queda pegado al hacer scroll.
- Eliminado scroll horizontal: columnas con anchos porcentuales y `table-fixed`.
- Eliminado texto redundante "X resultados encontrados" (ya visible en header).
- Eliminada fila de "Caja de Seguridad Social..." (irrelevante).
- Eliminado footer note verde ("Fuente: Tabla de Actos...").

#### Guía de Trámites — UI Refinements
- Header sticky de 3 filas: título + badge, buscador full-width, filtros (Jurisdicción + Fase) + Expandir/Colapsar.
- Eliminado texto redundante "84 resultados" debajo del buscador.
- Tarjetas de acordeón más compactas: `!py-0` override scoped (no afecta resto del SaaS) para eliminar el `py-6` default del componente Card.
- Padding reducido: `py-1.5` en headers colapsados, `py-2.5` en items expandidos.
- **Bug fix**: crash `TypeError: Cannot read properties of null (reading 'toLowerCase')` en búsqueda — campos `descripcion` y `url_label` pueden ser null, agregadas guardas `(field || '').toLowerCase()`.

#### Fixes UI generales
- **AlertDialog centering**: fix del bug `translate-x` en `alert-dialog.tsx` que descentraba modales.
- **Modal "Conflicto de datos"**: footer de `ApuntesTab.tsx` apilado vertical para nombres largos que rompían layout.

#### Worker: TRAMITE_REQUERIDO (nuevo tipo de sugerencia)
- `worker/src/noteAnalyzer.ts`: nuevo tipo `TRAMITE_REQUERIDO` en Zod schema + prompt enriquecido con 17 organismos/URLs, jurisdicción auto-detectada (PBA/CABA), deadlines estimados, costos actualizados 2026.
- `src/lib/deterministic/applySuggestion.ts`: handler `TRAMITE_REQUERIDO` (informacional — solo registra aceptación).
- `src/components/ApuntesTab.tsx`: `renderPayload()` para TRAMITE_REQUERIDO con `ExternalLink` clickeables, badges de jurisdicción y costo.

#### Commits
- `d4344ea` — feat: Add Guía de Trámites page + sidebar item
- `9d5a3af` — style: Sticky header with search + remove horizontal scroll (Tabla de Actos)
- `070a603` — style: Remove tabla-actos footer, sticky header + compact cards for guia-tramites
- `5b51179` — fix: Null safety in search + two-line header for guia-tramites
- `1a005b7` — fix: Filters below search bar + compact cards with !py-0 override

---

### 2026-03-07 — ET7.1 Fase Producción: publishToProtocolo

#### Contexto y decisión
La tabla `protocolo_registros` tenía una columna `carpeta_id` (FK → carpetas) que nadie escribía. El worker ya upsertaba personas/inmuebles y extraía folios, pero el registro de protocolo nunca se vinculaba a la carpeta origen. Se decidió crear una función determinística que mapee los datos de la carpeta al protocolo cuando el trámite se firma.

#### Diseño aprobado
- **Trigger automático**: cuando una carpeta pasa a estado `FIRMADA` (sea vía `updateFolderStatus` o `markAsSigned`)
- **Mapeo determinístico** (sin IA): escritura TRAMITE → operación → participantes → personas
- **Idempotente**: upsert por `carpeta_id` — si ya existe, actualiza; si no, crea
- **No bloqueante**: si falla la publicación, el cambio de estado sigue siendo exitoso (fire-and-forget con `.catch()`)
- **Botón manual**: visible en CarpetaHero cuando el estado es FIRMADA o INSCRIPTA como fallback

#### Mapeo de campos carpeta → protocolo_registros
| Campo protocolo | Fuente carpeta |
|---|---|
| `nro_escritura` | `escritura.nro_protocolo` |
| `dia/mes/anio` | `escritura.fecha_escritura` (parseado) |
| `tipo_acto` | `operacion.tipo_acto` |
| `codigo_acto` | `operacion.codigo` |
| `vendedor_acreedor` | Participantes con rol VENDEDOR/TRANSMITENTE/DONANTE/CEDENTE/FIDUCIANTE/TITULAR/CONDOMINO → `nombre_completo` separados por "; " |
| `comprador_deudor` | Participantes con rol COMPRADOR/ADQUIRENTE/DONATARIO/CESIONARIO/MUTUARIO/FIDEICOMISARIO → `nombre_completo` separados por "; " |
| `monto_ars` | `operacion.monto_operacion` |
| `carpeta_id` | El propio `carpetaId` |
| `es_errose` | Siempre `false` (viene de trámite real) |

#### Archivos modificados
- **`src/app/actions/protocolo.ts`**: nueva función `publishToProtocolo(carpetaId)` — carga carpeta con jerarquía completa vía `supabaseAdmin`, mapea datos, upsert en `protocolo_registros`
- **`src/app/actions/carpeta.ts`**: `updateFolderStatus` ahora llama `publishToProtocolo` cuando `newStatus === "FIRMADA"` (fire-and-forget)
- **`src/app/actions/inscription.ts`**: `markAsSigned` ahora llama `publishToProtocolo` después de setear estado FIRMADA (fire-and-forget)
- **`src/components/CarpetaHero.tsx`**: botón "Protocolo" (icono BookOpen) visible en FIRMADA/INSCRIPTA, con loading state y toast de feedback

#### Dos caminos a FIRMADA
1. **StatusStepper** → `updateFolderStatus(folderId, "FIRMADA")` → dispara `publishToProtocolo`
2. **InscriptionTracker** → `markAsSigned(escrituraId, fechaFirma)` → actualiza carpeta directamente → dispara `publishToProtocolo`

Ambos caminos están cubiertos.

#### Deuda técnica pendiente (ET7.1 bi-direccional)
- Sync protocolo→carpeta no implementado (si se edita un registro de protocolo, no se refleja en la carpeta)
- Detección de conflictos entre ediciones manuales del protocolo y las de carpeta

### 2026-03-07 (Antigravity) — Protocolo: CRUD + PDF upload + AI extraction + navegación + reprocesamiento masivo

#### Protocolo Fase 1+2: Seguimiento mejorado
- `ProtocoloWorkspace.tsx`: eliminadas columnas USD/ARS del display, default sort por folios, iconos Eye + FolderOpen + Trash2 en columna acciones (90px).
- Interface `ProtocoloRegistro` extendida con `pdf_storage_path` y `carpeta_id`.
- Migración 048: `pdf_storage_path`, `carpeta_id`, flexibilizar `nro_escritura` para errose.
- `seed_protocolo_2026.py`: carga masiva de 62 registros (58 escrituras + 4 errose) + 56 PDFs al bucket "protocolo".

#### HOTFIX: Confirmación obligatoria al borrar (SUPER BUG)
- `ProtocoloWorkspace.tsx`: AlertDialog antes de eliminar. `deleteRow` reemplazada por `confirmDelete` (solo ejecuta tras confirmar). Trash2 ya no borra directo.
- Escritura 1 restaurada en DB (borrada accidentalmente por el bug).

#### Eye icon → Signed URL
- Eye icon llama `getSignedUrl("protocolo", pdf_storage_path)` → abre PDF en nueva pestaña con URL firmada (1h expiry).

#### Protocolo Fase 3: Links navegables
- FolderOpen navega a `/carpeta/{id}` en nueva pestaña.
- Nombres de partes splitean por " y " → cada nombre es un link individual a `/clientes?q={nombre}`.
- `/clientes` acepta `?q=` param para pre-llenar búsqueda (con Suspense).
- `link_carpetas_protocolo.py`: script para auto-vincular carpetas futuras.

#### CRUD Modal + AI Extraction
- `EscrituraDialog.tsx`: modal nueva escritura con PDF upload + drag & drop.
- `src/app/actions/protocolo.ts`: server actions CRUD (create, update, delete).
- `src/lib/actClassifier.ts`: auto-clasificación de código CESBA.
- `worker/src/escrituraExtractor.ts`: extractor AI de escrituras con Gemini 2.5 Pro.
- `worker/src/index.ts`: bifurcación para job_type ESCRITURA_EXTRACT.
- Migración 049: columnas de extracción AI en protocolo_registros.

#### Reprocesamiento masivo
- `scripts/reprocess_protocolo.ts`: descarga 56 PDFs de Supabase, extrae datos via Gemini 2.5 Pro, corrige tipo_acto, upserts personas/inmuebles. Resultado: 56/56 OK, 237 personas, 53 inmuebles.
- `scripts/verify_quality.ts`: auditoría de calidad post-proceso.

#### UI Fixes
- Default `pageSize` = 20 en `ProtocoloWorkspace` (consistente con el resto del SaaS).
- Texto con `break-words` en vez de `truncate` en tabla Seguimiento — evita solapamiento de columnas.
- `IndiceProtocolo.tsx`: columna "Operación" ampliada de 180px → 340px para que actos largos quepan en una línea.
- `InmueblesTable.tsx`: split de partida por `/` además de `;` → cada partida en su propia línea.

#### Commits
- `7c45adf` — feat: Protocolo Fase 1+2 - Seguimiento mejorado + migración 048 + seed 62 registros
- `925a440` — fix: HOTFIX - Confirmación obligatoria al borrar registro del protocolo
- `8b4776b` — feat: Eye icon serves PDFs via signed URL from Supabase Storage
- `3f182a9` — feat: Protocolo Fase 3 - links navegables
- `c6e1820` — feat: CRUD modal + PDF upload + AI extraction + auto-classify codigo_acto
- `ca34811` — feat: mass PDF reprocessing pipeline for Protocolo 2026
- `ab6ef59` — fix: split client names into individual clickable links
- `d4f58ba` — fix: default pageSize to 20 in ProtocoloWorkspace
- `14e9d9f` — fix: Protocolo table text wrapping (break-words)
- `785faa9` — fix: split partida on '/' separator in InmueblesTable
- `591bfca` — fix: widen Operacion column to 340px in Indice Protocolo

### 2026-03-07 (tarde) — ET7.1 Protocolo Inteligente: extracción completa + upsert personas/inmuebles

#### Worker ESCRITURA_EXTRACT enriquecido
- **Schema Gemini ampliado**: ahora extrae arrays estructurados de `personas` (nombre, DNI, CUIT, rol, tipo_persona, estado_civil, domicilio, nacionalidad) e `inmuebles` (partido, partida, nomenclatura, dirección, descripción) además de los campos planos existentes.
- **Nuevo campo `folios`** en schema de extracción (rango ej: "001/005").
- **Upsert personas**: al completar ESCRITURA_EXTRACT, el worker hace upsert en tabla `personas` con dedup por DNI (misma lógica que INGEST). origen_dato = 'IA_PROTOCOLO'.
- **Upsert inmuebles**: upsert en tabla `inmuebles` con dedup por partido_id + nro_partida. Soporta partidas múltiples separadas por coma.
- **Fix modelo Gemini**: `gemini-2.5-pro-preview-06-05` → `gemini-2.5-pro` (nombre estable).

#### Frontend
- **EscrituraDialog**: auto-fill `folios` desde extraction data. Eliminada nota "Ingresá manualmente (no se extrae del PDF)".
- **protocolo.ts**: tipo `EscrituraExtractionData` ampliado con campo `folios`.

#### ARCHITECTURE_PLAN.md
- ET7 marcada ✅ COMPLETADA (deploy Railway confirmado).
- Nueva **ET7.1 — Protocolo Inteligente** agregada con dos fases:
  - Fase actual (pre-producción): worker upsert personas/inmuebles + folios/montos.
  - Fase producción: `publishToProtocolo(carpetaId)` al cerrar carpeta.

#### Archivos modificados
- `worker/src/escrituraExtractor.ts` — schema enriquecido + prompt + fix modelo
- `worker/src/index.ts` — upsert personas/inmuebles en processEscrituraExtraction()
- `src/app/actions/protocolo.ts` — tipo EscrituraExtractionData + folios
- `src/components/EscrituraDialog.tsx` — auto-fill folios
- `ARCHITECTURE_PLAN.md` — ET7 completada + ET7.1 agregada

#### Build
- `npm run build` ✅
- `npx tsc --noEmit` (worker) ✅

### 2026-03-04 — Normalización tipo de acto en CarpetaHero

- **CarpetaHero.tsx**: el subtítulo superior ahora normaliza el `tipo_acto` de la BD contra una lista de actos conocidos (COMPRAVENTA, HIPOTECA, DONACIÓN, etc.), eliminando sufijos espurios como "COMPLETA" que la ingesta AI a veces agrega.
- Cuando no hay tipo de acto definido, muestra **"ACTO A DEFINIR"** (antes "Acto por definir").

### 2026-03-03 (Antigravity) — Integración Template Builder → SaaS EscriAR

#### Lo hecho
- Se procesaron 34 modelos DOCX (escrituras públicas + instrumentos privados) con el Template Builder de Streamlit. 767 variables Jinja2 extraídas en total.
- Los 34 ZIPs se subieron a Supabase Storage (bucket escrituras) y sus metadatos a la tabla modelos_actos.
- El dropdown de tipo de acto en `WorkspacePipeline.tsx` ahora es dinámico — consulta `modelos_actos` en tiempo real, mostrando solo modelos activos.
- Se agregó un botón "Generar desde Modelo" que ejecuta el pipeline completo: descarga template DOCX → arma contexto desde datos de la carpeta → renderiza con Python docxtpl → sube DOCX final → entrega URL de descarga firmada.
- **Vista Previa Inline y Modal (Mammoth)**: El HTML se genera server-side directamente del DOCX renderizado conservando formato.
  - Panel de texto inline debajo del botón con contenido renderizado (scrollable, max 500px).
  - Botón "Vista Previa" (ojo) abre un modal grande con el documento DOCX renderizado completo y descargar.
  - Botón "Regenerar" disponible para corregir datos y volver a generar un mismo documento.
  - Botón "Descargar" estandarizado post-generación.
  - Guardado de la ruta `rendered_docx_path` del template en tabla escrituras (Migración 037).
- `buildTemplateContext.ts` expandido con 30+ aliases de roles (donantes, cedentes, poderdantes, usufructuarios, etc.) para que cada template use sus propios nombres de variable sin romper.
- Se creó `numberToWords.ts` para conversión de montos a letras en español notarial. Integrado en `operacion.precio_letras`.
- `SUPPORTED_ACT_TYPES` expandido de 21 a 47 entradas organizadas por categoría.
- Build Next.js pasa limpio (0 errores TS).

#### Archivos modificados en EscriAR SaaS
- `src/components/WorkspacePipeline.tsx` — dropdown dinámico + botón render
- `buildTemplateContext.ts` — aliases + precio_letras
- `src/lib/templates/numberToWords.ts` — nuevo
- `src/app/actions/modelos-types.ts` — 47 act types
- `src/app/actions/modelos.ts` — ajustes menores
- `src/app/admin/users/ModelosTab.tsx` — ajustes UI

### 2026-03-04 (Claude Opus) — ETAPA 4: NOTE_ANALYSIS + Sugerencias reales con Gemini Flash

#### Migración 041: Extensión de ingestion_jobs
- Nuevas columnas: `job_type` (TEXT, default 'INGEST'), `payload` (JSONB), `entity_ref` (JSONB), `org_id` (UUID FK)
- Relajado NOT NULL en `file_path` y `original_filename` (NOTE_ANALYSIS no tiene archivo)
- Índices: `(job_type, status)`, `(carpeta_id, job_type)`, GIN en `entity_ref`
- PRECHECKS/APPLY/POSTCHECKS/ROLLBACK completos

#### Backend: Server Actions
- `createApunte()`: ahora crea apunte con `ia_status='PROCESANDO'` e inserta job `NOTE_ANALYSIS` en `ingestion_jobs`
- `retryNoteAnalysis(apunteId, carpetaId)`: nueva action — resetea `ia_status` a PROCESANDO y crea nuevo job

#### Worker: noteAnalyzer (Gemini Flash)
- Nuevo módulo `worker/src/noteAnalyzer.ts` con:
  - Schema Zod `NoteAnalysisOutputSchema`: array de sugerencias (max 5) con tipo, payload, evidencia_texto, confianza
  - Tipos de sugerencia: COMPLETAR_DATOS, AGREGAR_PERSONA, AGREGAR_CERTIFICADO, VERIFICAR_DATO, ACCION_REQUERIDA
  - Prompt de extracción con reglas de seguridad (texto = datos, nunca instrucciones)
  - Usa `gemini-2.5-flash` via `@ai-sdk/google` + `generateObject`
- Worker loop actualizado: detecta `job_type='NOTE_ANALYSIS'` y bifurca a `processNoteAnalysis()`
- `processNoteAnalysis()`: lee apunte → analiza con Gemini → valida con Zod → inserta sugerencias → actualiza ia_status

#### UI: ApuntesTab mejorado
- Badge "Analizando..." con spinner para apuntes en PROCESANDO
- Polling automático cada 5s cuando hay apuntes procesando (se detiene al completar)
- Botón Reintentar (RefreshCw) visible en apuntes con ERROR
- Skeletons animados en panel de sugerencias mientras hay análisis en curso
- Import de `retryNoteAnalysis` y `RefreshCw`

#### Archivos modificados/creados
- `supabase_migrations/041_etapa_4__note_analysis_jobs.sql` — NUEVO
- `worker/src/noteAnalyzer.ts` — NUEVO
- `worker/src/index.ts` — import noteAnalyzer, bifurcación NOTE_ANALYSIS, processNoteAnalysis()
- `src/app/actions/apuntes.ts` — createApunte con job, retryNoteAnalysis nueva
- `src/components/ApuntesTab.tsx` — polling, retry, skeletons, badge Analizando
- `RUN_MIGRATIONS.md` — actualizado con migración 041

### 2026-03-04 (Claude Opus) — ETAPA 5: Motor determinístico (Aceptar sugerencias aplica cambios reales)

#### Migración 042: Audit columns en sugerencias
- Nuevas columnas: `applied_at` (timestamptz), `applied_by` (UUID FK auth.users), `apply_error` (text), `applied_changes` (JSONB)
- Permite auditar qué cambios reales se ejecutaron al aceptar cada sugerencia

#### Motor determinístico: `src/lib/deterministic/applySuggestion.ts`
- Dispatcher por tipo de sugerencia con handlers idempotentes
- **AGREGAR_PERSONA**: upsert persona por DNI + vincular como participante a la operación
- **COMPLETAR_DATOS**: actualiza campos de operación (monto, tipo_acto, codigo) o carpeta (caratula)
- **AGREGAR_CERTIFICADO**: crea certificado PENDIENTE del tipo indicado (idempotente: skip si ya existe)
- **VERIFICAR_DATO / ACCION_REQUERIDA**: informativos, solo registran aceptación del usuario
- Cada handler devuelve `ApplyResult { success, applied_changes, error }` para audit trail

#### Backend: acceptSuggestion con ejecución real
- Lee sugerencia y verifica estado PROPOSED (idempotencia)
- Ejecuta motor determinístico según tipo
- Actualiza sugerencia con audit trail: applied_at, applied_by, applied_changes, apply_error
- Si el motor falla, mantiene estado PROPOSED y registra error

#### UI: ApuntesTab con feedback de aplicación
- Spinner "Aplicando..." en botón Aceptar durante ejecución
- Botones deshabilitados durante procesamiento
- Muestra errores de aplicación (apply_error) en sugerencias pendientes y resueltas
- Toast diferenciado: "Sugerencia aplicada" vs "Error al aplicar sugerencia"

#### Archivos modificados/creados
- `supabase_migrations/042_etapa_5__sugerencias_audit.sql` — NUEVO
- `src/lib/deterministic/applySuggestion.ts` — NUEVO
- `src/app/actions/sugerencias.ts` — acceptSuggestion con motor determinístico
- `src/components/ApuntesTab.tsx` — spinner, error states, disabled buttons
- `RUN_MIGRATIONS.md` — actualizado con migración 042

### 2026-03-05 (Claude Opus) — Separación INGESTA/TRAMITE: Fuente de verdad

#### Decisión arquitectónica: columna `source` en `escrituras`
- **Problema**: Mesa de Trabajo mostraba participantes del antecedente (PDF original) mezclados con los del trámite activo. `applySuggestion` insertaba personas en la escritura INGESTA en vez de TRAMITE. `CarpetasTable` y `search_carpetas` mostraban datos del antecedente como si fueran del trámite.
- **Solución**: Nueva columna `source VARCHAR(20)` con CHECK (INGESTA/TRAMITE). Cada carpeta tiene DOS escrituras: INGESTA (datos extraídos del PDF) y TRAMITE (operación activa editable).
- **Regla de oro**: Mesa de Trabajo y sugerencias SIEMPRE operan sobre TRAMITE. Antecedentes SIEMPRE muestra INGESTA. Nunca se mezclan.

#### Migración 044: Columna `source` + creación de TRAMITE
- Agrega `source` a `escrituras` con CHECK constraint
- Marca escrituras existentes con pdf_url/analysis_metadata como INGESTA
- Crea escritura TRAMITE + operación para cada carpeta que no tenga una
- Copia tipo_acto, código y monto de INGESTA a TRAMITE

#### Migración 045: search_carpetas filtra por TRAMITE
- RPC `search_carpetas` muestra parties y escrituras SOLO de `source='TRAMITE'`
- La búsqueda sigue buscando en TODAS las escrituras (antecedente es searchable)

#### Migración 046: Mover participantes huérfanos
- Mueve participantes manuales (no IA_OCR) de operaciones INGESTA a TRAMITE
- ON CONFLICT DO NOTHING para idempotencia
- Limpia INGESTA después de copiar

#### applySuggestion: supabaseAdmin + getTramiteOperacion
- `getFirstOperacion()` reemplazado por `getTramiteOperacion()` que filtra por `source='TRAMITE'`
- Usa `supabaseAdmin` (bypassa RLS) para TODAS las queries — fix crítico porque escrituras creadas por migración admin no eran visibles al cliente con RLS
- Auto-crea TRAMITE si no existe (con logging extensivo)
- Guardrails: verifica `source === 'TRAMITE'` antes de insertar participantes

#### Componentes modificados
- **FolderWorkspace.tsx**: `activeDeedId` = TRAMITE; Antecedentes recibe solo INGESTA; break-glass modal con checkbox para edición excepcional del antecedente
- **CarpetaHero.tsx**: carátula, subtipo e inmueble desde TRAMITE; removido badge de código
- **CarpetasTable.tsx**: `getActo()` y `getCodigo()` buscan TRAMITE primero
- **WorkspacePipeline.tsx**: removida card "Tipo de Acto" (redundante); badges "Vende / Transmite"
- **buildTemplateContext.ts**: contexto de template desde TRAMITE
- **ingest route.ts**: escritura de ingesta marcada `source='INGESTA'`; dedup solo busca INGESTA
- **carpeta.ts**: `createFolder` crea con `source='TRAMITE'`; guardrail en `linkPersonToOperation`
- **escritura.ts**: nueva `ensureTramiteEscritura()` server action

---

## 18. Pendientes Conocidos

### Verificación pendiente
- [ ] **Verificar `poder_detalle`** funciona tras redeploy Railway (subir un PDF con apoderado)

### Integración Template Builder
- [ ] Test end-to-end real (crear carpeta con datos → generar DOCX → verificar output)
- [ ] Wiring del botón "Borrador IA" (Path A con Gemini)
- [ ] Persistencia de campos faltantes en BD: forma_pago, título_antecedente estructurado, vehículo, etc.

### Trazabilidad y Dedup
- [ ] Dedup con sugerencias en `persistIngestedData` (flujo MagicDropzone aún hace upsert silencioso)
- [ ] RLS para escrituras sin carpeta (`source='PROTOCOLO'`, `carpeta_id=null`) — necesita policy alternativa
- [ ] Vista global de sugerencias pendientes (las de protocolo no tienen carpeta)
- [ ] Verificar FK `escrituras.carpeta_id` → confirmar si es CASCADE, SET NULL o RESTRICT

### Deuda técnica
- [ ] Integración con Resend para emails transaccionales

### Próximas Etapas (ARCHITECTURE_PLAN)
- [ ] **ET8**: Header sticky final — CarpetaHero con chips accionables, colapsado, menú seguro
- [ ] **ET9**: Auditoría — tabla `audit_events` + helper `logAuditEvent` + UI Logs
- [ ] **ET10**: Notificaciones/Dashboard — badge global + carpetas que necesitan atención
- [ ] **ET11**: Export de carpeta completa (ZIP)

### Roadmap (Hitos funcionales)
- **Ver `ROADMAP.md`** para el plan completo de desarrollo en 3 etapas
- **ET completadas**: ET1-ET7 (ver ARCHITECTURE_PLAN.md)
- **Hitos completados**: 1.1 (Certificados), 1.2 (Lector RPI + Inhibiciones), 1.3 (Ficha Comprador)
- [ ] **Hito 1.4**: Determinación automática del acto (subcódigos CESBA)
- [ ] **Hito 1.5**: Liquidación impositiva completa (ARBA, RPI, arancel CANN, Ganancias Global/Cedular)

---

> **PROTOCOLO AL TERMINAR UNA SESIÓN DE TRABAJO:**
> 1. Agregar cambios realizados en la sección 17 (Changelog) con tu nombre de agente y fecha
> 2. Actualizar sección 15 (Migraciones) si creaste alguna nueva
> 3. Actualizar sección 18 (Pendientes) si resolviste algo o descubriste nuevos pendientes
> 4. Si creaste un skill nuevo, agregarlo en la sección 7
> 5. Si subiste un documento al RAG, agregarlo en la sección 8
> 6. Firmar con tu nombre de agente
>
> **Última actualización**: 2026-03-07 — Antigravity — Protocolo CRUD completo (Fases 1-3), ET7.1 Protocolo Inteligente (upsert personas/inmuebles), migraciones 048-049, reprocesamiento masivo 56 PDFs, UI fixes en tablas.


### 2026-03-12 (Antigravity) – Sesión 7: Derogación ITI y Ajustes Fiscales (Finalizado)

#### Objetivo
Actualizar el sistema para reflejar la derogación definitiva del Impuesto a la Transferencia de Inmuebles (ITI) según Ley 27.743 (Paquete Fiscal 2024) y unificar terminología.

#### Cambios Realizados
- **Eliminación ITI**: Se removió el cálculo del 1.5% de ITI y estados residuales en src/components/PresupuestoTab.tsx.
- **Ganancias Global**: Implementación de retención del 3% para empresas y habitualistas (AFIP).
- **Ganancias Cedular**: Lógica informativa para el 15%.
- **Unificación Terminológica**: Cambio de 'Actos Protocolares/Privados' a 'Escrituras' e 'Instrumentos Privados' en archivos de data (src/data/acts_taxonomy_2026.json) y UI (src/components/GenerarActuacionDialog.tsx, src/components/ActuacionesPanel.tsx).
- **Configuración Fiscal**: Actualizado src/data/fiscal_config_2026.json.
- **Borrador/Presets**: Actualizado src/lib/skills/generation/deedDrafter.ts and src/lib/templates/buildTemplateContext.ts.

#### Archivos Modificados
- src/lib/services/PresupuestoEngine.ts
- src/lib/skills/deterministic/taxCalculator.ts
- src/components/smart/TaxBreakdownCard.tsx
- src/data/acts_taxonomy_2026.json
- src/data/fiscal_config_2026.json
- src/components/GenerarActuacionDialog.tsx
- src/components/ActuacionesPanel.tsx
- src/components/PresupuestoTab.tsx
- .agent/skills/notary-tax-calculator/SKILL.md

---

> **Última actualización**: 2026-03-13 — Claude Opus 4.6 (Trazabilidad Protocolo + Dedup Sugerencias + Documentos en Clientes)

### 2026-05-14 (Antigravity) – Entendimiento Consolidado de Flujos y Arquitectura de Datos

#### Objetivo
Consolidar, documentar de forma inamovible y explicar detalladamente los cuatro flujos principales de ingreso y creación de datos en el SaaS EscriAR (Ingesta de Trámite, Creación Manual, Registro Histórico y Borradores).

#### Acciones y Flujos Documentados
Se auditó la lógica del front-end (`DashboardActions.tsx`, `api/ingest/route.ts`, tablas `borradores`, `protocolo_registros`) y se dejó constancia oficial en la Arquitectura de Datos:
1.  **Ingesta de Nuevo Trámite (Desde "Inicio"):** Subir PDF/DOCX -> Crea `Carpeta` (PROCESANDO) -> Extrae entidades (Clientes, Inmuebles, Operación) y las enlaza a la nueva la carpeta.
2.  **Creación Manual de Entidades:** Clic en "+ Nueva Carpeta", "+ Nuevo Cliente", etc -> Crea la entidad vacía y aislada, a la espera de vinculación manual.
3.  **Registro Histórico e Índice (Desde "Protocolo"):** Subir PDF -> **NO crea Carpeta**. Inyecta metadata a `protocolo_registros` -> Alimenta automáticamente el "Índice del Protocolo" y se usa de matriz RAG para inferir Titulares Actuales en futuros trámites.
4.  **Borradores (Drafts) Temporales:** Clic en "+ Nuevo Documento" / "+ Nuevo Presupuesto" -> Crea un registro en tabla `borradores` (estado DRAFT, `carpeta_id` null). Queda autónomo esperando asignación a una Carpeta formal.

#### Archivos Modificados
- `C:\Users\diego\.gemini\antigravity\brain\...\arquitectura_datos_escriar.md`
- `DIARIO.md`

### 2026-03-15 (Antigravity) – Cacería de "Super Bugs": El Retorno de la Identidad

**Problema 1: Frontend Ciego (Bug Documentos)**
- **Síntoma:** Los clientes no mostraban documentos del Protocolo 2026 en su perfil (Aparecía "No hay documentos vinculados" y el contador en 0).
- **Causa:** La API `getClientWithRelations` sólo buscaba coincidencias de nombres dentro de la metadata de la tabla `escrituras` huérfanas, pero **no** consultaba la nueva tabla `protocolo_registros`.
- **Solución:**
  1. Se modificó `clientRelations.ts` para ejecutar una búsqueda semántica (`ilike`) sobre los campos `vendedor_acreedor`, `comprador_deudor` y `extraction_data` de todos los registros del Protocolo.
  2. Los resultados se mapearon al array `documentos` simulando la estructura esperada por la UI, inyectándoles dinámicamente el tag `SOURCE: 'PROTOCOLO'`.
  3. Ahora, cuando un cliente abre su ficha, el sistema "hila" en tiempo real todas sus menciones históricas.

**Problema 2: El Multiplicador de Basura (Bug Duplicación Personas)**
- **Síntoma:** Al subir múltiples escrituras que involucraban a una misma entidad jurídica (ej. FIDEICOMISO ARES o CODESUR), el sistema creaba decenas de perfiles basura con DNI `SIN_DNI_...` o `TEMP-...`.
- **Causa:** La IA fallaba en extraer el CUIT de estos fideicomisos/empresas desde el PDF. El Worker de Ingesta, al no tener CUIT, intentaba buscar la entidad existente **sólo por CUIT**, fallaba, y creaba un perfil temporal nuevo por cada documento, asociando el documento a un fantasma en vez de al perfil canónico.
- **Solución:**
  1. **Limpieza Quirúrgica:** Se programó y ejecutó un script en producción (`dedup_personas.ts`) que rastreó todos los UUIDs temporales. Los agrupó por una versión "limpia" del nombre (sin S.A., S.R.L.), migró todas sus Operaciones hacia el perfil maestro y eliminó a todos los clones.
  2. **Vacuna en Worker:** Se endureció la heurística en `worker/src/index.ts`. Ahora, si la extracción vuelve vacía de CUIT, el script ejecuta una _búsqueda difusa por nombre_ en la DB antes de rendirse. Si encuentra a la empresa por nombre, usa su DNI real, bloqueando la creación de clones.
- **Validación:** Se comprobó vía navegador robotizado que _escriar.com_ ya no lista duplicados para entidades conocidas.

## Fase V : Lanzamiento Oficial (En Proceso)
