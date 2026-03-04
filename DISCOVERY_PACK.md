# Discovery Pack — Módulo Carpeta (NotiAR)

> Generado el 2026-03-04 con Claude Code. Comandos de discovery al final del documento.

---

## A) Folder Module Map (Rutas + Componentes)

### Rutas (Next.js App Router)

| URL | Page file | Tipo |
|-----|-----------|------|
| `/carpetas` | `src/app/carpetas/page.tsx` | SSR, usa RPC `search_carpetas` |
| `/carpeta/[id]` | `src/app/carpeta/[id]/page.tsx` | SSR, `force-dynamic`, `revalidate=0` |

No hay route groups `(dashboard)`. No hay `layout.tsx` propio — usa el root layout con `<AppShell>`.

### Componentes (árbol de dependencia)

```
FolderWorkspace.tsx  ← orquestador principal (state, realtime, dialogs)
├── CarpetaHero.tsx  ← header sticky (título, subtipo acto, metadata, vencimientos, tabs)
│
├── [Tab: Mesa de Trabajo]
│   └── WorkspacePipeline.tsx → FaseRedaccion
│       ├── PersonSearch.tsx (modal buscar persona)
│       ├── EditarClienteDialog.tsx (editar cliente inline)
│       └── DeedRichEditor.tsx (editor fullscreen TipTap)
│
├── [Tab: Antecedentes]
│   └── WorkspaceRadiography.tsx (antecedentes, inmueble, docs)
│       ├── PersonForm.tsx
│       └── AssetSearch.tsx
│
├── [Tab: Pre-Escriturario]
│   └── WorkspacePipeline.tsx → FasePreEscritura
│       ├── CertificadosPanel.tsx
│       ├── EstudioDominioPanel.tsx
│       └── LiquidacionPanel.tsx
│
├── [Tab: Post-Firma]
│   └── WorkspacePipeline.tsx → FasePostEscritura
│       ├── MinutaGenerator.tsx
│       ├── AMLCompliance.tsx
│       └── InscriptionTracker.tsx
│
└── Dialogs (modales gestionados por FolderWorkspace)
    ├── EditingPerson Dialog
    ├── EditingRepresentacion Dialog
    ├── Transcription Dialog
    ├── Edit Deed Metadata Dialog
    ├── Document Viewer Dialog
    └── Conflict Resolution Modal
```

**Header sticky**: `CarpetaHero.tsx:159` — `sticky top-0 z-30`
**Tabs**: Radix `@radix-ui/react-tabs` via shadcn. `TabsList` renderizado dentro de CarpetaHero como `children`, `TabsContent` en `FolderWorkspace.tsx:346-381`.

### Listado de carpetas

| Componente | Path |
|-----------|------|
| CarpetasTable | `src/components/CarpetasTable.tsx` |
| DeleteCarpetaDialog | (inline en CarpetasTable) |

### Server Actions

**`src/app/actions/carpeta.ts`** (279 líneas):

| Función | Línea | Propósito |
|---------|-------|-----------|
| `createFolder()` | 8 | Crear carpeta + escritura + operación default |
| `addOperationToDeed()` | 46 | Agregar operación a escritura |
| `linkPersonToOperation()` | 62 | Vincular persona a operación con rol |
| `removePersonFromOperation()` | 83 | Desvincular persona de operación |
| `updateRepresentacion()` | 100 | Actualizar datos_representacion (JSONB) |
| `linkAssetToDeed()` | 128 | Vincular inmueble a escritura |
| `updateFolderStatus()` | 145 | Cambiar estado de carpeta |
| `deleteCarpeta()` | 164 | Eliminar carpeta con cascade + storage cleanup |
| `unlinkPersonFromOperation()` | 234 | Soft unlink de participante |
| `upsertPerson()` | 255 | Upsert persona con fallback DNI temporal |

**`src/app/actions/escritura.ts`** (71 líneas):

| Función | Propósito |
|---------|-----------|
| `updateEscritura()` | Actualizar metadata (nro_protocolo, fecha, notario, registro) |
| `updateOperacion()` | Actualizar operación (tipo_acto, codigo) |
| `updateInmueble()` | Actualizar inmueble (partido_id, nro_partida) |

**`src/app/actions/storageSync.ts`** (46 líneas):

| Función | Propósito |
|---------|-----------|
| `listStorageFiles()` | Listar archivos en prefix del bucket |
| `deleteStorageFile()` | Eliminar archivo de storage |
| `getSignedUrl()` | URL firmada (1h expiry) |

**`src/app/actions/template-render.ts`**:

| Función | Propósito |
|---------|-----------|
| `renderTemplate()` | Renderizar DOCX desde template con contexto |
| `loadRenderedDocument()` | Cargar documento previamente renderizado |
| `previewTemplateContext()` | Preview del JSON de contexto (debug) |
| `getActiveTemplate()` | Buscar modelos_actos activo por act_type |
| `downloadTemplate()` | Descargar DOCX desde storage |
| `renderDocx()` | Renderizar con docxtemplater |

### API Routes

| Ruta | Método | Path | Propósito |
|------|--------|------|-----------|
| Ingest | POST | `/api/ingest` | Ingesta sync (< 500KB) |
| Ingest Queue | POST | `/api/ingest/queue` | Cola async (> 500KB) |
| Templates Render | POST | `/api/templates/render` | Renderizar DOCX o preview |
| Search People | GET | `/api/search/people?q=` | Buscar personas (ilike) |
| Search Assets | GET | `/api/search/assets?q=` | Buscar inmuebles |
| Jobs | GET | `/api/jobs/[id]` | Estado de job de ingesta |

---

## B) Data Flow Diagram

### Carga de carpeta (lectura)

```
Browser → /carpeta/[id] (SSR)
  → page.tsx: supabase.from("carpetas").select("*, escrituras(*, inmuebles(*),
      operaciones(*, participantes_operacion(*, persona:personas(*))))")
  → Pasa `carpeta` a <FolderWorkspace initialData={carpeta}>
  → FolderWorkspace: useState(initialData) → distribuye a CarpetaHero, FaseRedaccion, etc.
```

### Suscripción realtime

```
FolderWorkspace.tsx:57-107
  → supabase.channel("carpeta-changes")
    .on('postgres_changes', {table: 'carpetas', filter: id=eq.carpetaId})
    .on('postgres_changes', {table: 'escrituras'})
    .on('postgres_changes', {table: 'participantes_operacion', event: 'INSERT'})
    .on('postgres_changes', {table: 'inmuebles', event: 'INSERT'})
  → Debounced router.refresh() cada 1s
```

### Escritura (mutaciones)

| Acción | Server Action | Refresh |
|--------|--------------|---------|
| Crear carpeta | `createFolder()` | `revalidatePath("/carpetas")` |
| Vincular persona | `linkPersonToOperation()` | `window.location.reload()` |
| Cambiar tipo acto | Inline `supabase.update()` + `onTipoActoChange` callback | setState local |
| Generar escritura | `renderTemplate()` | setState local (renderResult) |
| Eliminar carpeta | `deleteCarpeta()` | `revalidatePath`, redirect |

### Ingesta AI

```
MagicDropzone → POST /api/ingest (< 500KB) o POST /api/ingest/queue (> 500KB)
  → Gemini (SkillExecutor) extrae entidades
  → Upsert personas, inmuebles, operaciones, participantes
  → Upload PDF a Storage bucket "escrituras"
  → carpetas.ingesta_estado = COMPLETADO | ERROR
  → Realtime subscription detecta cambio → router.refresh()
```

### Estado global

**NO se usa**: Zustand, Redux, React Query, SWR, Context API.

Todo el state vive en `FolderWorkspace.useState(initialData)`. Los componentes hijos reciben datos por props. Mutaciones se propagan via callbacks (`onTipoActoChange`) o `window.location.reload()` / `router.refresh()`.

---

## C) DB Snapshot (tablas/campos)

### Tablas core

| Tabla | PK | Campos clave | FK |
|-------|-----|-------------|-----|
| **carpetas** | `id` (UUID) | `nro_carpeta_interna`, `caratula`, `estado`, `ingesta_estado` | — |
| **escrituras** | `id` (UUID) | `nro_protocolo`, `fecha_escritura`, `pdf_url`, `rendered_docx_path`, `inmueble_princ_id` | `carpeta_id` → carpetas |
| **operaciones** | `id` (UUID) | `tipo_acto`, `codigo` (CESBA), `monto_operacion` | `escritura_id` → escrituras |
| **participantes_operacion** | `id` (UUID) | `rol`, `porcentaje`, `datos_representacion` (JSONB) | `operacion_id` → operaciones, `persona_id` → personas(dni) |
| **personas** | `dni` (TEXT) | `nombre_completo`, `cuit`, `tipo_persona`, `estado_civil_detalle`, `domicilio_real` (JSONB), `profesion` | — |
| **inmuebles** | `id` (UUID) | `partido_id`, `nro_partida`, `transcripcion_literal`, `titulo_antecedente`, `valuacion_fiscal` | — |
| **certificados** | `id` (UUID) | `tipo`, `estado`, `nro_certificado`, `fecha_vencimiento` | `carpeta_id` → carpetas |
| **gravamenes** | `id` (UUID) | `tipo`, `estado`, `monto`, `juzgado` | `carpeta_id`, `inmueble_id`, `persona_id` |
| **modelos_actos** | `id` (UUID) | `act_type`, `label`, `docx_path`, `is_active`, `act_code` | — |
| **ingestion_jobs** | `id` (UUID) | `status` (enum), `file_path`, `result_data` (JSONB) | `carpeta_id`, `user_id` |
| **protocolo_registros** | `id` (UUID) | `nro_escritura`, `tipo_acto`, `es_errose`, `vendedor_acreedor`, `comprador_deudor` | — |
| **escribanos** | `id` (UUID) | `nombre_completo`, `caracter` (enum), `numero_registro`, `is_default` | — |
| **user_profiles** | `id` (UUID) | `email`, `approval_status`, `full_name` | FK → auth.users(id) |
| **fichas_web_tokens** | `id` (UUID) | token para formularios públicos | `persona_id` → personas(dni) |
| **knowledge_base** | `id` (UUID) | `content`, `embedding` (vector 768), `metadata` (JSONB) | — |
| **system_skills** | `slug` (TEXT) | `content_md`, `is_active` | — |

### Enums y CHECK constraints

| Campo | Valores |
|-------|---------|
| `carpetas.estado` | BORRADOR, EN_CURSO, FIRMADA, INSCRIPTA |
| `carpetas.ingesta_estado` | PENDIENTE, PROCESANDO, COMPLETADO, ERROR |
| `operaciones.tipo_acto` | Texto libre (COMPRAVENTA, HIPOTECA, DONACION, etc.) |
| `participantes_operacion.rol` | COMPRADOR, VENDEDOR, CEDENTE, CESIONARIO, ADQUIRENTE, DONANTE, DONATARIO, TITULAR, APODERADO, REPRESENTANTE, CONDOMINO, FIDUCIANTE, MUTUARIO, GARANTE |
| `personas.tipo_persona` | FISICA, JURIDICA, FIDEICOMISO |
| `personas.regimen_patrimonial` | COMUNIDAD, SEPARACION_BIENES |
| `certificados.tipo` | DOMINIO, INHIBICION, CATASTRAL, DEUDA_MUNICIPAL, DEUDA_ARBA, RENTAS, AFIP, ANOTACIONES_PERSONALES, OTRO |
| `certificados.estado` | PENDIENTE, SOLICITADO, RECIBIDO, VENCIDO |
| `gravamenes.tipo` | EMBARGO, HIPOTECA, INHIBICION_GENERAL, BIEN_DE_FAMILIA, USUFRUCTO, LITIS, OTRO |
| `gravamenes.estado` | VIGENTE, LEVANTADO, CADUCO |
| `escribano_caracter` (enum) | TITULAR, A_CARGO, ADSCRIPTO, INTERINO |
| `ingest_status` (enum) | pending, processing, completed, failed, cancelled |

### ERD simplificado

```
carpetas
  ├── 1:N → escrituras
  │     ├── 1:N → operaciones
  │     │     └── N:N → personas (via participantes_operacion)
  │     └── 1:1 → inmuebles (via inmueble_princ_id)
  ├── 1:N → ingestion_jobs
  ├── 1:N → certificados
  └── 1:N → gravamenes

inmuebles ← 1:N → gravamenes

personas
  ├── 1:N → participantes_operacion
  └── 1:N → fichas_web_tokens

modelos_actos (templates DOCX, standalone)
protocolo_registros (libro de protocolo, standalone)
escribanos (datos del escribano, standalone)
knowledge_base (RAG embeddings, standalone)
system_skills (prompts AI, standalone)
```

### Migraciones SQL

Ubicación: `supabase_migrations/` (37 archivos, 002-037). Ejecución **manual** en Supabase SQL Editor.

### RPC Functions

- **`search_carpetas(search_term, p_limit, p_offset)`** — búsqueda full-text por nombre, DNI, CUIT, código. Devuelve estructura plana con parties y escrituras como JSONB.
- **`match_knowledge(query_embedding, match_threshold, match_count, filter_category)`** — búsqueda vectorial para RAG.

### Storage

**Bucket**: `escrituras` (privado, URLs firmadas 1h)

| Operación | Ubicación | Código |
|-----------|-----------|--------|
| Upload PDF | `api/ingest/route.ts:684` | `supabaseAdmin.storage.from('escrituras').upload(...)` |
| Download template | `template-render.ts:58-67` | `supabaseAdmin.storage.from('escrituras').download(docxPath)` |
| Signed URL | `storageSync.ts:34-45` | `createSignedUrl(path, 3600)` |
| List files | `storageSync.ts:8-10` | `.list(prefix)` |
| Delete file | `storageSync.ts:22-24` | `.remove([path])` |

**Paths típicos**:
- `documents/[timestamp]_[filename]` — PDFs ingestados
- `modelos_actos/[act_type]/template.docx` — templates
- `rendered_docx/[carpeta_id]_[act_type].docx` — escrituras generadas

### Auth & RLS

- **Método**: Supabase Auth (email/password + OAuth)
- **Middleware**: `src/middleware.ts` — rutas públicas definidas, redirect a `/login` si no autenticado
- **Super admin**: `diegogalmarini@gmail.com` hardcodeado
- **RLS permisivo**: `certificados`, `gravamenes`, `protocolo_registros` permiten CRUD a cualquier usuario autenticado
- **No hay** tabla de membresía por carpeta ni roles por carpeta

### Capa IA

| Archivo | Propósito |
|---------|-----------|
| `src/lib/agent/SkillExecutor.ts` | Router unificado de skills (Gemini) |
| `src/lib/aiConfig.ts` | Modelos (flash/pro), schemas de extracción |
| `src/lib/knowledge.ts` | Sistema RAG (embeddings pgvector) |
| `src/lib/skills/routing/documentClassifier.ts` | Clasificar tipo de documento |
| `src/lib/skills/notary-rpi-reader.ts` | Extraer datos de certificados RPI |
| `src/lib/skills/generation/deedDrafter.ts` | Redactar borrador de escritura |
| `src/lib/skills/deterministic/taxCalculator.ts` | Calcular impuestos (sin AI) |

**Modelos**: `gemini-2.5-flash` (clasificación, extracción simple), `gemini-2.5-pro` (lectura compleja, redacción)

**Jobs/Background**: `ingestion_jobs` tabla como cola. Worker externo (Railway) poll by status. No hay cron ni edge functions.

---

## D) Risks & Constraints

1. **No hay estado global** — Todo el state vive en `FolderWorkspace.useState`. Sincronizar cambios entre tabs requiere callbacks manuales (`onTipoActoChange`).

2. **Refresh híbrido frágil** — Se mezclan `router.refresh()`, `window.location.reload()`, realtime subscriptions, y `revalidatePath()`. No hay estrategia unificada.

3. **`personas.dni` como PK** — Personas jurídicas usan DNI sintético (`SIN_DNI_XXXXX`). Hay migraciones de dedup pero riesgo de duplicados persiste.

4. **`tipo_acto` es texto libre** — La ingesta AI guarda strings arbitrarios. No hay enum estricto ni normalización en BD. El header usa lista hardcodeada para normalizar display.

5. **FolderWorkspace.tsx es monolítico (~913 líneas)** — Orquesta state, realtime, 6+ dialogs y toda la lógica CRUD.

6. **WorkspacePipeline.tsx también es grande (~826 líneas)** — Exporta 3 fases pero comparten archivo.

7. **Sin tests** — No hay unit tests ni e2e. Solo `npm run build` como validación.

8. **Storage paths inconsistentes** — `pdf_url` puede ser URL completa o path relativo. `resolveDocumentUrl()` maneja ambos.

9. **RLS permisivo** — `certificados`, `gravamenes`, `protocolo_registros` no filtran por ownership de carpeta.

10. **Migraciones manuales** — Copiar/pegar SQL en Supabase Dashboard. Riesgo de drift entre entornos.

---

## E) Refactor Proposal (3 fases)

### Fase 1 — Estabilización de estado (1 PR)

**Objetivo**: Unificar la fuente de verdad del state de carpeta.

- Extraer `useCarpetaState()` hook que centralice `carpeta`, `setCarpeta`, y todas las mutaciones optimistas
- Reemplazar `window.location.reload()` por `router.refresh()` + optimistic updates
- Mover `onTipoActoChange` y lógica similar al hook centralizado
- Garantizar que CarpetaHero siempre refleje el estado actual

**Archivos**: FolderWorkspace.tsx, WorkspacePipeline.tsx
**Riesgo**: Bajo — refactor interno sin cambio de UI

### Fase 2 — Modularización de componentes (1-2 PRs)

**Objetivo**: Dividir archivos monolíticos para reducir riesgo de regresión.

- **PR 2a**: Extraer de WorkspacePipeline.tsx:
  - `PartesConfigurator.tsx` (transmitentes + adquirentes)
  - `ActoSelector.tsx` (selector de tipo de acto)
  - `TemplateGenerator.tsx` (generar/editar/descargar escritura)
- **PR 2b**: Extraer de FolderWorkspace.tsx:
  - `CarpetaDialogs.tsx` (todos los Dialog modales)
  - Dejar FolderWorkspace como puro orquestador (~200 líneas)

**Archivos**: WorkspacePipeline.tsx, FolderWorkspace.tsx + 5 nuevos
**Riesgo**: Medio — verificar que props/callbacks se pasen correctamente

### Fase 3 — Normalización de datos (1 PR)

**Objetivo**: Eliminar ambigüedad en `tipo_acto` y roles.

- Crear tabla `actos_catalogo` con: `slug` (PK), `label`, `cesba_code`, `category`
- Migración: normalizar `operaciones.tipo_acto` existentes a slugs del catálogo
- FK `operaciones.tipo_acto` → `actos_catalogo.slug`
- Unificar con `modelos_actos.act_type`
- Eliminar normalización hardcodeada en CarpetaHero

**Archivos**: Nueva migración SQL, buildTemplateContext.ts, CarpetaHero.tsx, CarpetasTable.tsx, WorkspacePipeline.tsx
**Riesgo**: Alto — requiere migración de datos en producción

---

## Comandos de discovery (replicable)

```bash
# Rutas Next.js
rg "page.tsx" --glob "src/app/**/page.tsx" --files
rg "layout.tsx" --glob "src/app/**/layout.tsx" --files

# Componentes importados por FolderWorkspace
rg "import.*from" src/components/FolderWorkspace.tsx
rg "import.*from" src/components/WorkspacePipeline.tsx

# Server Actions
rg "use server" src/app/actions/*.ts --files-with-matches
rg "export async function" src/app/actions/carpeta.ts

# API Routes
rg "route.ts" --glob "src/app/api/**/route.ts" --files

# Estado global
rg "zustand|redux|createContext|useContext" src/ --type ts --type tsx

# Refresh patterns
rg "router.refresh|revalidatePath|revalidateTag|location.reload" src/

# Tablas Supabase
rg "\.from\(" src/ -o | sort -u

# RLS
rg "ENABLE ROW LEVEL|CREATE POLICY" supabase_migrations/

# Storage
rg "\.storage|\.upload|\.download|createSignedUrl|getPublicUrl" src/

# AI/Skills
rg "SkillExecutor|classifyDocument|gemini|generative-ai" src/

# Auth
rg "supabase.auth|getUser|getSession" src/

# Migraciones
ls supabase_migrations/
```
