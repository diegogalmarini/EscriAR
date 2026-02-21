# NotiAR - Diario del Proyecto

> **ARCHIVO COMPARTIDO ENTRE TODOS LOS AGENTES (Claude, Gemini, etc.)**
> Cada agente que trabaje en el proyecto debe leer este archivo al inicio y actualizarlo al finalizar su sesión.
> NO crear diarios separados. Este es el único archivo de estado del proyecto.

---

## 1. Qué es NotiAR

SaaS argentino para escribanos (notarios). Gestión de carpetas notariales con extracción AI de escrituras PDF escaneadas y digitales.

## 2. Stack Tecnológico

| Componente | Tecnología |
|---|---|
| **Frontend** | Next.js 16.1.3, React 19, TypeScript 5, Tailwind CSS 4, Shadcn/Radix UI |
| **Backend** | Vercel (serverless) + Railway (Docker worker async) |
| **DB/Auth/Storage** | Supabase (PostgreSQL + Auth + Storage + pgvector) |
| **AI Extracción** | Google Gemini `gemini-3-flash-preview` (text + vision OCR) |
| **Monitoring** | Sentry |
| **Pendiente** | Resend (email, mencionado pero no integrado aún) |

## 3. Arquitectura

```
                    ┌──────────────┐
   PDF Upload ──►   │  Vercel App  │ ──► Supabase DB
   (< 500KB sync)   │  /api/ingest │     (carpetas, escrituras,
                    └──────────────┘      operaciones, personas,
                                          inmuebles, participantes)
                    ┌──────────────┐
   PDF Upload ──►   │   Railway    │ ──► Supabase DB
   (async queue)    │   Worker     │     (mismas tablas)
                    └──────────────┘
```

- **Dual pipeline**: sync (`/api/ingest`, archivos <500KB) + async (Railway worker, cola `ingestion_jobs`)
- **Worker**: Polling cada 3s, descarga PDF de Storage bucket `escrituras`, extrae con Gemini, inserta en BD
- **Tablas principales**: `carpetas` → `escrituras` → `operaciones` → `participantes_operacion` → `personas`; `inmuebles`
- **RPC**: `search_carpetas` — función PL/pgSQL que devuelve carpetas con `parties[]` y `escrituras[]` como JSONB
- **Taxonomía CESBA**: `acts_taxonomy_2026.json` con 100+ códigos de actos notariales para cálculo de tasas
- **RAG**: Base de conocimiento legal con embeddings en Supabase pgvector, chunking de 1000 chars con 200 overlap

## 4. Archivos Críticos (NO modificar sin entender contexto)

| Archivo | Qué hace |
|---|---|
| `worker/src/index.ts` | Worker Railway: esquema Zod `NotarySchema`, extracción Gemini + inserciones BD |
| `src/app/api/ingest/route.ts` | Pipeline sync (822+ líneas), más completo que el worker |
| `src/components/FolderWorkspace.tsx` | Vista de carpeta: roles, visor documentos, datos escritura |
| `src/components/CarpetasTable.tsx` | Tabla de carpetas, consume RPC `search_carpetas` (estructura plana) |
| `src/lib/services/TaxonomyService.ts` | Asignación de códigos CESBA |
| `src/data/acts_taxonomy_2026.json` | Taxonomía de actos ARBA (verificada al 100%) |
| `worker/src/acts_taxonomy_2026.json` | Copia de taxonomía para el worker standalone |
| `src/app/actions/storageSync.ts` | Server actions: listStorageFiles, deleteStorageFile, getSignedUrl |
| `src/lib/aiConfig.ts` | Schema de extracción AI del frontend (más completo que el worker) |

## 5. Convenciones y Reglas

### Naming
- "Nº de Acto" se renombró a **"Código"** (campo `codigo` en tabla `operaciones`, antes `nro_acto`) — pedido del Notario
- Personas Físicas: formato `APELLIDO, Nombre` — apellidos SIEMPRE en MAYÚSCULAS
- Personas Jurídicas: nombre tal cual, NO invertir (ej: `BANCO DE LA NACION ARGENTINA`, NO `ARGENTINA BANCO...`)

### Base de Datos
- Storage bucket se llama **`escrituras`** (NO `documents`)
- `pdf_url` en BD: pipeline frontend guarda URL pública completa, worker guarda path crudo → `resolveDocumentUrl()` maneja ambos
- `personas` PK = `dni` (string), no UUID
- `participantes_operacion` vincula personas ↔ operaciones con campo `rol`
- Migraciones SQL en `supabase_migrations/` (numeradas 001-029), se ejecutan **manual** en Supabase SQL Editor
- **Normalización**: `normalizePartido()`, `normalizePartida()`, `splitMultiplePartidas()` en `src/lib/utils/normalization.ts`
- **Personas JURIDICAS**: usan CUIT como PK (no DNI). Lookup por CUIT antes de generar SIN_DNI
- **Representación**: columna `datos_representacion JSONB` en `participantes_operacion` con `{representa_a, caracter, poder_detalle}`

### Códigos CESBA (campo `codigo` en `operaciones`)
- COMPRAVENTA → `100-xx`
- DONACION → `200-xx` (empieza en `200-30`, NO existe `200-00`)
- HIPOTECA/PRÉSTAMO → `300-xx`
- CANCELACION HIPOTECA → `311-xx`
- CESION → `400-xx`
- PODER → `500-xx`
- FIDEICOMISO → `121-xx`
- Subcódigos: `-00` normal, `-51` vivienda única exenta sellos, `-24` plan social

### UI / Frontend
- `CarpetasTable` consume datos del RPC `search_carpetas` (estructura PLANA: `parties[]`, `number`, NO queries anidadas)
- `FolderWorkspace` maneja roles con `getRoleLabel()` y `getRoleBadgeStyle()` — incluye CONDOMINO, DONANTE, DONATARIO, etc.
- Documentos se visualizan con signed URLs via `getSignedUrl('escrituras', path)`

---

## 6. Hitos Estables (NO tocar sin revisión previa)

### Enero 2026
1. **Extracción de Inmuebles (Literal)** - Transcripción técnica completa sin recortes
2. **Gestión Integral de Clientes** - Fuente única de verdad, dedup por DNI/Upsert
3. **Diferenciación Persona Jurídica** - ID automática por CUIT, UI adaptada
4. **Estandarización de Apellidos** - MAYÚSCULAS, soporte compuestos
5. **Fideicomisos y Cesiones** - Roles complejos, doble precio ARS/USD
6. **Hipotecas UVA y Créditos BNA** - TNA, UVA, Plazo, roles Acreedor/Deudor
7. **Motor RAG (La Biblia)** - Búsqueda semántica legal con pgvector
8. **Mega-Document Chunking (49+ págs)** - División por secciones, merge con dedup

### Febrero 2026
9. **Fix updatePersona** - Busca por UUID/DNI/CUIT según corresponda
10. **Nuevo Cliente Dual** - Modo rápido (link) + completo (formulario)
11. **Ficha Pública Cónyuge** - Campo dinámico al seleccionar "Casado/a"
12. **Formatos: solo PDF y DOCX** - Removido soporte `.doc`

---

## 7. Changelog Reciente

### 2026-02-20 (Claude)

#### Worker Railway — fixes críticos
- **`tipo_inmueble: 'SIN CLASIFICAR'`** violaba CHECK constraint → eliminado (BD acepta NULL)
- **`nomenclatura_catastral`** → `nomenclatura` (nombre correcto de columna)
- **Job status**: se marcaba `completed` ANTES de insertar en BD → movido al final; si falla → `failed`
- **Esquema expandido**: de ~5 a 12 campos/persona, 6/inmueble (estado_civil, nacionalidad, domicilio, filiación, cónyuge, etc.)
- **Código CESBA**: worker ahora asigna `codigo` en operaciones via `getCESBACode()` con taxonomía bundleada

#### Seguridad
- Eliminado `error.stack` de respuestas API
- `SUPER_ADMIN_EMAILS` a env var con fallback
- Logs verbosos de middleware eliminados en producción
- `/api/auth-diag` protegido solo en development

#### UI
- `getRoleLabel()`/`getRoleBadgeStyle()`: agregados CONDOMINO, DONANTE, DONATARIO, FIDUCIANTE, MUTUARIO, GARANTE, REPRESENTANTE, TRANSMITENTE
- "Ver Documento" / "Descargar": signed URLs via `getSignedUrl('escrituras', path)` en vez de path crudo (fix 404)
- `CarpetasTable`: alineada con RPC `search_carpetas` (estructura plana `parties[]`, `number`)
- Persona Jurídica: `isJuridica()` checa `tipo_persona`/`cuit` para no invertir nombre

### 2026-02-21 (Claude) — Sesión larga, cambios mayores

#### Integridad de Datos — Sistema anti-duplicados completo
Problema: al re-subir un PDF se duplicaban personas, inmuebles, escrituras y participantes.
Solución implementada en AMBOS pipelines (frontend `/api/ingest` Y worker Railway):

- **Dedup participantes**: upsert con `ON CONFLICT DO NOTHING` (UNIQUE constraint en operacion_id+persona_id)
- **Dedup inmuebles**: UNIQUE index parcial en (partido_id, nro_partida). Lookup antes de INSERT; si existe, reutiliza
- **Dedup escrituras**: UNIQUE index parcial en (nro_protocolo, registro). Lookup antes de INSERT; si existe, actualiza metadata y reutiliza
- **Dedup operaciones**: si la escritura ya tiene operación, la reutiliza en vez de crear otra
- **Migración 026**: `supabase_migrations/026_unique_constraints_anti_duplicates.sql` — CONSTRAINTS en BD ✅ EJECUTADA

#### Normalización de datos
Problema: "Monte Hermoso" vs "MONTE HERMOSO" y "Bahía Blanca" vs "Bahia Blanca" generaban inmuebles duplicados. Partidas con puntos decorativos ("126.559") no matcheaban.

- **`normalizePartido()`**: Title Case + strip accents ("BAHÍA BLANCA" → "Bahia Blanca") — en `src/lib/utils/normalization.ts`
- **`normalizePartida()`**: quita puntos ("126.559" → "126559")
- **`splitMultiplePartidas()`**: separa "126-017.871-3 / 126-022.080" en 2 inmuebles independientes
- Aplicado en ambos pipelines (frontend + worker)
- **Migración 027**: normaliza partido a Title Case y partida sin puntos en data existente ✅ EJECUTADA
- **Migración 028**: normaliza tildes en partido_id + merge de duplicados con FK remap ✅ EJECUTADA

#### Personas Jurídicas — CUIT como ID canónico
Problema: BANCO DE LA NACION ARGENTINA aparecía 3 veces porque Gemini a veces devuelve DNI, a veces CUIT, a veces nada → se generaban SIN_DNI_xxx.

- **Fix en ambos pipelines**: para tipo_persona JURIDICA/FIDEICOMISO, usar CUIT como PK (no DNI)
- **Lookup por CUIT**: antes de generar SIN_DNI, buscar si ya existe una persona con ese CUIT
- **Migración 029**: fusiona duplicados existentes por CUIT en una sola persona canónica ⚠️ PENDIENTE DE EJECUTAR

#### Representación (Apoderados)
Problema: tarjeta de APODERADO mostraba "Representando a: No informado" y "Poder Otorgado: No consta".
Root cause: PDFs >500KB van al worker Railway, que NO tenía lógica de representación.

- **Migración 024**: columna `datos_representacion JSONB` en `participantes_operacion` ✅ EJECUTADA
- **Frontend ingest**: captura representación desde schema AI (`aiConfig.ts` tiene campo `representacion`)
- **Worker Railway**: ahora infiere representación post-inserción (detecta APODERADO → lo vincula a JURIDICA del mismo acto)
- **Worker Zod schema**: agregado campo `poder_detalle` para que Gemini extraiga texto completo del poder
- **UI**: tarjeta de APODERADO muestra "Representando a" y "Poder Otorgado" debajo del domicilio
- ⚠️ PENDIENTE: verificar que `poder_detalle` se extrae correctamente tras redeploy Railway

#### Roadmap
- Creado `ROADMAP.md` — documento maestro con 3 etapas, 14 hitos, criterios de aceptación, dependencias y orden de ejecución
- Auditoría completa del codebase: 18 páginas, 8 APIs, 53 componentes, 17 skills notariales, inventario EXISTS vs MISSING

### 2026-02-20 (Gemini)
- `search_carpetas` RPC reescrito: estructura aplanada con `parties[]` JSONB y `escrituras[]` JSONB
- Renaming `nro_acto` → `codigo` en toda la BD y UI
- Taxonomía CESBA sincronizada con códigos ARBA verificados al 100%
- Tabla de Actos: paginación, dropdown fix, búsqueda

---

## 8. Estado de Migraciones

| Migración | Descripción | Estado |
|-----------|-------------|--------|
| 001–023 | Setup inicial, auth, storage, schemas, RPC | ✅ Ejecutadas |
| 024 | `datos_representacion JSONB` en participantes_operacion | ✅ Ejecutada |
| 025 | Dedup personas, normalizar DNI | ✅ Ejecutada |
| 026 | UNIQUE constraints anti-duplicados (participantes, inmuebles, escrituras) | ✅ Ejecutada |
| 027 | Normalizar partido (Title Case) y partida (sin puntos) | ✅ Ejecutada |
| 028 | Normalizar tildes en partido + merge duplicados con FK remap | ✅ Ejecutada |
| 029 | Dedup personas jurídicas por CUIT (merge canónico) | ⚠️ **PENDIENTE** |

## 9. Pendientes Conocidos

### Urgentes (hacer antes de seguir con ROADMAP)
- [ ] **Ejecutar migración 029** en Supabase SQL Editor (dedup personas jurídicas por CUIT)
- [ ] **Verificar `poder_detalle`** funciona tras redeploy Railway (re-subir un PDF con apoderado)
- [ ] **Remover logs diagnósticos** de `src/app/api/ingest/route.ts` (agregados para debug representación)

### Deuda técnica
- [ ] Worker solo procesa 6 páginas de PDFs escaneados — cónyuges en páginas posteriores se pierden
- [ ] CESBA code assignment: worker usa mapeo simple, frontend usa TaxonomyService más completo
- [ ] Integración con Resend para emails transaccionales

### Roadmap
- **Ver `ROADMAP.md`** para el plan completo de desarrollo en 3 etapas (Estudio de Título → Redacción → Post-Firma)
- Próximos hitos: 1.1 Certificados, 1.3 Ficha Comprador, 1.4 Determinación Acto (pueden ir en paralelo)

---

> **IMPORTANTE**: Al terminar tu sesión de trabajo, agrega tus cambios en la sección 7 (Changelog) y actualiza la sección 8 (Pendientes). Firma con tu nombre de agente y fecha.
