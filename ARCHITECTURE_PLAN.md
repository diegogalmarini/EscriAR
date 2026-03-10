# EscriAR — Carpeta AI-First (Cerebro Híbrido) — Architecture & Implementation Plan
Fecha: 2026-03-04 (actualizado 2026-03-08)
Owner: Diego  
Implementador: Agente  
Scope: Rediseño completo de Carpeta + IA proactiva + Jobs + Seguridad completa (multi-tenant por Organización + RLS)

---

## 0) Objetivo
Implementar la Carpeta notarial con:

- Header sticky colapsable con "situación actual" (etapa, pendientes, certificados, docs, firma).
- Pestaña inicial "Apuntes" como **Punto de Ingesta Semántica** (IA propone, humano confirma, código ejecuta).
- Actuaciones y documentos separando **Instrumentos Privados** vs **Actos Protocolares** (dentro de Mesa de Trabajo).
- Pre-escriturario con **OCR / extracción verificable** (evidencia + confirmación humana) y bloqueos determinísticos.
- Arquitectura completa de seguridad: **Organización (tenant) + roles** y **RLS real (no permisivo)**.
- **Notificaciones y dashboard** de estado para el escribano.
- **Export de carpeta completa** (PDF bundle con escritura, certificados, actuaciones).

---

## Estado actual (2026-03-05)

| Etapa | Estado | Migraciones | Evidencia |
|-------|--------|-------------|-----------|
| ET1 — Estabilización | ✅ COMPLETADA | — | `location.reload` = 0 en carpeta. Realtime + `router.refresh()`. |
| ET2 — Seguridad Org+RLS | ✅ COMPLETADA | 038, 039 | `organizaciones`, `organizaciones_users`, `requireOrgMembership()`, RLS real. |
| ET3 — Apuntes + Sugerencias | ✅ COMPLETADA | 040 | Tablas `apuntes`/`sugerencias`, Server Actions, `ApuntesTab.tsx` (811 LOC). |
| ET4 — Jobs IA (NOTE_ANALYSIS) | ✅ COMPLETADA | 041 | `createApunte` → job `NOTE_ANALYSIS`, worker Railway, `ia_status`. |
| ET5 — Motor determinístico | ✅ COMPLETADA | 042 | `applySuggestion.ts` (467 LOC), 5 handlers, audit trail. |
| ET6 — Actuaciones Privado/Protocolar | ✅ COMPLETADA | 043, 044 | `ActuacionesPanel`, `GenerarActuacionDialog`, taxonomía PRIVADO/AMBIGUO/PROTOCOLAR/HIDDEN, microcopy. |
| ET6.1 — Código de Acto | ✅ COMPLETADA | 021-023, 045 | `search_carpetas` filtra por TRAMITE. `CarpetasTable` muestra código+acto. Código CESBA derivado. |
| ET7 — Pre-escriturario AI | ✅ COMPLETADA | 047 | Upload PDF + extracción IA (Gemini Pro) + confirmación humana + chips vencimientos en header. Deploy Railway OK (2026-03-07). |
| ET7.1 — Protocolo Inteligente | ✅ COMPLETADA | — | `publishToProtocolo(carpetaId)`: mapeo determinístico carpeta→protocolo_registros. Trigger auto en FIRMADA (updateFolderStatus + markAsSigned). Botón manual en CarpetaHero. Upsert idempotente by carpeta_id. Pendiente: sync bidireccional. |
| ET8+ET9 — Header + Auditoría | ✅ COMPLETADA | 050 | `audit_events` table + `logAuditEvent()` + (i) info popover en CarpetaHero + Server Actions instrumentados. |
| ET10 — Notificaciones/Dashboard | ✅ COMPLETADA | — | Dashboard alerts (pendientes semáforo) + PendingBadge en sidebar + `getPendingActionsSummary()`. |
| ET12a — Motor Jurisdiccional | ✅ COMPLETADA | 051 | JSON 135 partidos PBA + JurisdictionResolver + integración ingest/worker + campos partido_code/delegacion_code en inmuebles. |
| ET12b — Admin UI Jurisdicciones | 🔲 PENDIENTE | — | Tab admin para gestión de jurisdicciones, CRUD partidos, toggle provincias. |
| ET13 — Presupuestos Notariales | ✅ COMPLETADA | 052 | Motor de liquidación (`PresupuestoEngine`), UI `PresupuestoTab`, tablas de persistencia estructurada, y reorganización UI. |
| ET14 — Exportación PDF | ✅ COMPLETADA | — | Generación de presupuesto en PDF estructurado con `jsPDF` (`jspdf-autotable`). |
| ET15 — Sellos CABA | ✅ COMPLETADA | — | Alícuotas escalonadas para Sellos en CABA y selector de jurisdicción (PBA / CABA). |
| ET16 — Compartir Presupuesto | ✅ COMPLETADA | — | `CompartirPresupuestoDialog`: envío por WhatsApp (`wa.me/`), Email (`mailto:`), copiar al portapapeles. Selector de destinatario con contactos de la carpeta. Integrado en `PresupuestoTab`. |
| ET17 — Pre-carga automática Presupuesto | ✅ COMPLETADA | — | Pre-carga automática de tipo_acto, monto, moneda, cotización, valuación fiscal, tipo inmueble, cantidad de inmuebles, cantidad de personas, partido/jurisdicción, vivienda única, banco provincia, fecha adquisición, certificado no retención, urgencia, honorarios, legalizaciones, apostillas. |

Total: **52 migraciones SQL**, **20+ componentes principales**, **17 de 18 etapas completadas**.

---

## 1) Principios obligatorios (Guardrails)
1) **Human-in-the-loop:** la IA no escribe datos canónicos sin confirmación explícita del usuario autorizado.  
2) **IA propone, el código ejecuta:** la IA solo genera *Sugerencias* estructuradas; el sistema aplica cambios determinísticos.  
3) **Evidencia + confianza:** cada sugerencia muestra "por qué" (fragmento/origen) y nivel de confianza.  
4) **Auditoría:** registrar aceptar/rechazar + quién/cuándo + cambios aplicados.  
5) **Asincronía:** IA en background con estados y reintentos; la UI nunca se bloquea.  
6) **Seguridad (prompt injection):** PDFs y texto se tratan como contenido no confiable (extracción-only).  
7) **Fallback:** si IA falla, el flujo manual sigue funcionando.  

---

## 2) No-Alcance (para evitar scope creep)
- No rediseñar el sistema completo de Personas/Inmuebles fuera de lo estrictamente necesario.
- No construir un sistema completo de "tareas" si no existe base; solo acciones mínimas ligadas a sugerencias.
- No reescribir por completo el pipeline existente (Mesa/Antecedentes/Pre/Post) en una sola etapa.
- No "validación legal" por IA: la IA extrae, el escribano valida, el código bloquea.

---

## 3) Stack & contexto del repo (actual)
- **Next.js App Router**
- **Tailwind + shadcn/ui** (Radix Tabs)
- **Supabase** (Postgres + Storage + Auth + RLS)
- **IA:** `src/lib/agent/SkillExecutor.ts` (Gemini Flash/Pro)
- **Jobs/background:** tabla `ingestion_jobs` + worker externo (Railway) que hace polling por status
- **Template Builder:** Streamlit en `escriar-template-builder/` (34 modelos de actos en Supabase)

Rutas y componentes relevantes:
- Carpeta: `src/app/carpeta/[id]/page.tsx`
- Orquestador: `src/components/FolderWorkspace.tsx` (945 LOC, 5 tabs)
- Tabs: Apuntes | Mesa de Trabajo | Antecedentes | Pre-Escriturario | Post-Firma
- Header sticky: `src/components/CarpetaHero.tsx`
- Actuaciones: `src/components/ActuacionesPanel.tsx` (dentro de Mesa de Trabajo / FaseRedaccion)
- Modal actuaciones: `src/components/GenerarActuacionDialog.tsx`
- Apuntes + sugerencias: `src/components/ApuntesTab.tsx` (811 LOC)
- Motor determinístico: `src/lib/deterministic/applySuggestion.ts` (467 LOC)
- Auth multi-tenant: `src/lib/auth/getOrg.ts`
- Tipos actuaciones: `src/app/actions/actuaciones-types.ts` (taxonomía PRIVADO/AMBIGUO/PROTOCOLAR/HIDDEN)

---

## 4) Modelo de Seguridad — Multi-tenant por Organización ✅
> Implementado en ET2 (migraciones 038-039).

### 4.1 Entidades (implementadas)
- `organizaciones` (tenant)
- `organizaciones_users` (membresía + roles)
- `carpetas.org_id` (y tablas dependientes con `org_id` o acceso derivado vía carpeta)

### 4.2 Roles (mínimo)
- `OWNER` (full)
- `NOTARIO` (acciones críticas + firma/protocolo)
- `ADMIN` (gestión operativa, no necesariamente firma)
- `STAFF` (carga/gestión limitada)

### 4.3 Regla de acceso (RLS)
Un usuario autenticado solo puede leer/escribir filas cuyo `org_id` coincida con una organización en la que sea miembro (`organizaciones_users`).

### 4.4 Bootstrap anti lock-out (completado)
- Organización por defecto: Escribanía Galmarini (`a0000000-0000-0000-0000-000000000001`).
- Diego = `OWNER`.
- Backfill completado para carpetas y datos dependientes.
- `requireOrgMembership()` en todos los Server Actions.

---

## 5) Etapas y hitos (ejecución estricta por fases)

---

### ✅ ETAPA 1 — Estabilización del módulo Carpeta (COMPLETADA)

Logros:
- `window.location.reload()` eliminado del módulo carpeta (0 ocurrencias).
- Realtime subscription con `router.refresh()` debounced.
- `FolderWorkspace.tsx` modularizado (FaseRedaccion, FasePreEscritura, FasePostEscritura, WorkspaceRadiography separados).
- Mesa/Antecedentes/Pre/Post funcionan sin reload.

---

### ✅ ETAPA 2 — Seguridad completa (Organización + Roles + RLS real) (COMPLETADA)

Logros:
- Migraciones 038 (`etapa_2__org_and_rls.sql`), 039 (`fix_rls_recursion.sql`).
- `organizaciones`, `organizaciones_users` creadas con RLS.
- `org_id` en `carpetas` y tablas dependientes.
- `requireOrgMembership()` en `src/lib/auth/getOrg.ts`.
- Bootstrap anti lock-out ejecutado.

---

### ✅ ETAPA 3 — Modelo AI-First base: Apuntes + Sugerencias (COMPLETADA)

Logros:
- Migración 040 (`etapa_3__apuntes_sugerencias.sql`).
- Tablas `apuntes` y `sugerencias` con RLS por organización.
- Server Actions: `apuntes.ts` (create/list/delete/retry), `sugerencias.ts` (list/accept/reject).
- UI: `ApuntesTab.tsx` (811 LOC) como tab default con panel de sugerencias.

---

### ✅ ETAPA 4 — Jobs IA para Apuntes (Gemini Flash) (COMPLETADA)

Logros:
- Migración 041 (`etapa_4__note_analysis_jobs.sql`).
- `createApunte()` inserta job `NOTE_ANALYSIS` automáticamente.
- Worker Railway procesa con `SkillExecutor` + `gemini-2.5-flash`.
- `ia_status`: PENDIENTE → PROCESANDO → COMPLETADO/ERROR.
- UI muestra "Analizando…" / reintento funcional.

---

### ✅ ETAPA 5 — Motor determinístico (COMPLETADA)

Logros:
- Migración 042 (`etapa_5__sugerencias_audit.sql`).
- `applySuggestion.ts` (467 LOC) con 5 handlers: AGREGAR_PERSONA, COMPLETAR_DATOS, AGREGAR_CERTIFICADO, VERIFICAR_DATO, ACCION_REQUERIDA.
- Auditoría en `applied_changes_ref` (columna en sugerencias).
- Guardrails TRAMITE: `applySuggestion` nunca escribe en escritura INGESTA.

---

### ✅ ETAPA 6 — Actuaciones y documentos: Privado vs Protocolo (COMPLETADA)

Logros:
- Migraciones 043 (`etapa_6__actuaciones.sql`), 044 (`escrituras_source_column.sql`).
- `ActuacionesPanel.tsx`: 2 secciones colapsables (Protocolares primero, Privados segundo).
- `GenerarActuacionDialog.tsx`: modal con filtro por categoría, sin "Otros tipos".
- Taxonomía en `actuaciones-types.ts`: PRIVADO/AMBIGUO/PROTOCOLAR/HIDDEN.
  - PRIVADO: boleto_compraventa, sena, cesion_boleto, certificacion_firmas.
  - AMBIGUO: cesion_derechos, cesion_derecho_uso, autorizacion_conducir (aparecen en ambos modales, adoptan la categoría del modal).
  - OCULTOS: [] (reservado).
- Microcopy para actos ambiguos ("Se guardará como: Privado/Protocolar").
- Drafting con docxtemplater (JS puro) + mammoth HTML preview.

Decisión de diseño: Actuaciones viven dentro de Mesa de Trabajo (FaseRedaccion), no como tab independiente.

Pendiente técnico (no bloqueante):
- **Drafting versionado**: actualmente `template-render.ts` genera y sobreescribe. Falta tabla/campo `version` para no perder borradores previos al regenerar. Se debe abordar antes de que sea deuda técnica.

---

### ✅ ETAPA 6.1 — Código de Acto: fuente de verdad y visualización (COMPLETADA)

Logros:
- Migraciones 021-023, 045 (`search_carpetas_tramite_only.sql`).
- `search_carpetas` filtra parties/código/tipo_acto SOLO desde escritura TRAMITE (no antecedente).
- `CarpetasTable.tsx`: columna Código desde `operaciones.codigo`, con derivación desde `tipo_acto` → código CESBA si no hay código explícito.
- Código CESBA se auto-setea al confirmar tipo de acto.
- Carpetas sin código muestran "—".

---

### 🔧 ETAPA 7 — Pre-escriturario AI: OCR/extracción verificable + bloqueos (EN TESTING)
Objetivo: semáforo confiable con evidencia y confirmación humana.

> **Estado 2026-03-06:** Código completo. Migración 047 aplicada. Bucket Storage "certificados" creado. Deploy worker en curso. Pendiente: test funcional end-to-end.

#### Archivos creados/modificados en ET7

| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `supabase_migrations/047_etapa_7__cert_extraction.sql` | Migración | Agrega a `certificados`: `storage_path`, `extraction_status`, `extraction_data` (jsonb), `extraction_evidence` (jsonb), `extraction_error`, `confirmed_by`, `confirmed_at` |
| `worker/src/certExtractor.ts` | **NUEVO** | Extractor IA con Gemini 2.5 Pro. Prompts específicos por tipo de certificado (DOMINIO, INHIBICION, CATASTRAL, deudas, AFIP, ANOTACIONES_PERSONALES). Schema Zod con `datos` + `evidencia` (campo, texto, confianza). |
| `worker/src/index.ts` | Modificado | `CERT_EXTRACT` agregado al polling de jobs. Nuevo handler `processCertExtraction()`: descarga PDF → detecta nativo/escaneado → extrae con Gemini Pro → guarda en `certificados` → auto-rellena campos canónicos solo si vacíos. |
| `src/app/actions/certificados.ts` | Modificado | Nuevos tipos: `ExtractionData`, `ExtractionEvidence`, `ExtractionStatus`. Nuevas acciones: `uploadCertificadoPdf()` (sube a Storage + crea job), `confirmCertificadoExtraction()` (human-in-the-loop), `retryCertExtraction()`, `getCertificadoSignedUrl()`. Todas protegidas por `requireOrgMembership()`. |
| `src/components/CertificadoDialog.tsx` | Modificado | Reemplazado campo "PDF URL" manual por zona de drag & drop para subir PDF/imagen. Al guardar, sube a Storage y dispara job `CERT_EXTRACT` automáticamente. |
| `src/components/CertificadosPanel.tsx` | Modificado | Nuevo componente interno `ExtractionCard`: muestra estados (Analizando.../Extraído/Error), datos extraídos en grid, gravámenes e inhibiciones listados, evidencia expandible con confianza, botones Confirmar/Re-analizar. Polling automático cada 5s para extracciones en progreso. |
| `src/components/CarpetaHero.tsx` | Modificado | Sección "Certificados" con chips en vivo: vencidos (rojo), por vencer (amber), vigentes (verde), pendientes (gris), sin confirmar (azul). Fetch client-side de certificados por carpeta. |

#### Flujo completo implementado
```
Escribano crea certificado + sube PDF
  → Supabase Storage bucket "certificados" (path: orgId/carpetaId/certId.ext)
  → ingestion_jobs.insert({job_type: 'CERT_EXTRACT', entity_ref: {certificado_id, tipo}})
  → Worker poll → lock → descarga PDF
  → Detecta PDF nativo (pdf-parse >200 chars) o escaneado (convertPdfToImages)
  → Gemini 2.5 Pro con prompt específico por tipo → schema {datos, evidencia}
  → certificados.update({extraction_status: 'COMPLETADO', extraction_data, extraction_evidence})
  → Auto-rellena fecha_vencimiento/nro_certificado/organismo SOLO si campo vacío
  → UI polling detecta cambio → ExtractionCard muestra datos
  → Escribano revisa evidencia → click "Confirmar extracción"
  → confirmed_by/confirmed_at + estado → 'RECIBIDO'
  → CarpetaHero re-fetch → chips actualizados
```

#### Infraestructura aplicada
- [x] Migración 047 ejecutada en Supabase SQL Editor (2026-03-06)
- [x] Bucket Storage "certificados" creado con RLS (2026-03-06)
- [x] Deploy worker a Railway (2026-03-07) — commit `docs: DIARIO.md - changelog 2026-03-07`
- [x] Test funcional: 56/56 escrituras reprocesadas → 237 personas, 53 inmuebles (`reprocess_protocolo.ts`)
- [x] ESCRITURA_EXTRACT worker deployado y operativo en Railway
- [x] Protocolo CRUD overhaul: migraciones 048-049, EscrituraDialog, ProtocoloWorkspace, IndiceProtocolo

#### Decisiones de diseño
- **Gemini 2.5 Pro** (no Flash) para certificados: mejor comprensión de documentos escaneados con sellos/manchas.
- **Human-in-the-loop**: la extracción IA no cambia el estado del certificado hasta confirmación explícita.
- **Auto-fill conservador**: el worker solo pre-rellena campos canónicos si están vacíos, nunca sobreescribe datos manuales.
- **Prompts por tipo**: cada tipo de certificado (DOMINIO, INHIBICION, CATASTRAL, etc.) tiene un prompt especializado que guía la extracción.
- **Evidencia con confianza**: cada dato extraído incluye un fragmento textual del PDF + nivel HIGH/MED/LOW.

Hito ET7:
- Subir certificado → extracción → confirmación → semáforo/chips actualizados.
- `npm run build` OK (verificado 2026-03-06).
- Bloqueo determinístico funciona.

Rollback:
- Deshabilitar CERT_EXTRACT (feature flag) + revert PR.

---

### ETAPA 7.1 — Protocolo Inteligente: extracción completa + flujo carpeta→protocolo
Objetivo: que al subir un PDF en "+ Nueva Escritura" se extraigan **todos** los datos relevantes (incluido upsert de Clientes e Inmuebles), y preparar el camino para que en producción los datos vengan directamente de la Carpeta cerrada.

**Contexto:** La pestaña "Protocolo" tiene dos vistas hermanas que leen la misma fuente (`protocolo_registros`):
- **Seguimiento de Escrituras** — tabla plana: Esc., Folios, Día, Mes, Acto, Vendedor, Comprador, Código Acto.
- **Índice del Protocolo 2026** — generado automáticamente: Intervinientes (uno por línea), Operación (=Acto), Fecha (=Día+Mes), Esc., Folio (primer folio).

**Fase actual (pre-producción):** la escribanía sube PDFs generados fuera de EscriAr para nutrir con datos reales la pestaña Protocolo.
**Fase futura (producción):** al cerrar una Carpeta, un botón/acción toma los datos conocidos (partes, inmueble, acto, fechas, escritura) y crea/actualiza `protocolo_registros` sin necesidad de IA.

Tareas — Fase actual:
- [ ] **Worker: upsert personas/inmuebles** — Cuando `ESCRITURA_EXTRACT` completa, además de actualizar `protocolo_registros`, hacer upsert en tablas `personas` e `inmuebles` (como hace `reprocess_protocolo.ts` pero inline en cada job). Enriquecer el schema de Gemini para que devuelva datos estructurados de personas (nombre, DNI/CUIT, rol) e inmuebles (partido, partida, dirección).
- [ ] **Extracción de folios** — Agregar `folios` al schema de extracción de Gemini y al auto-fill del dialog.
- [ ] **Extracción de montos** — Agregar `monto_ars` / `monto_usd` al schema de extracción.

Tareas — Fase producción (posterior):
- [ ] **Server Action `publishToCarpeta(carpetaId)`** — Al cerrar carpeta, tomar datos de partes/inmueble/acto y crear/actualizar fila en `protocolo_registros`. Sin IA, datos determinísticos.
- [ ] **Botón "Publicar en Protocolo"** en CarpetaHero o menú de acciones de la carpeta.
- [ ] **Sincronización bidireccional** — Si se edita el registro en Protocolo, reflejar en Carpeta y viceversa (o al menos alertar discrepancias).

Hito ET7.1:
- Subir PDF → extracción → personas/inmuebles upserted + Seguimiento + Índice poblados automáticamente.
- Cerrar Carpeta → registro en Protocolo creado sin IA.
- `npm run build` OK.

Rollback:
- Revert PR. Las tablas personas/inmuebles no se modifican (solo se agregan datos).

---

### ETAPA 8+9 — Header info + Auditoría (COMPLETADA, fusionadas)
Objetivo: auditoría de acciones + botón (i) en CarpetaHero con popover de actividad.

> **Completada 2026-03-07.** Migración 050 aplicada. Commit 89eb4b2.

#### Archivos creados/modificados en ET8+ET9

| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `supabase_migrations/050_etapa_8_9__audit_events.sql` | **NUEVO** | Tabla `audit_events` con indexes + RLS por org. |
| `src/lib/logger.ts` | Modificado | Nuevo `logAuditEvent()` (fire-and-forget, typed `AuditAction`). `logAction()` deprecado. |
| `src/app/actions/audit.ts` | **NUEVO** | `getAuditEventsForCarpeta()` — lee eventos por carpeta. |
| `src/components/ui/popover.tsx` | **NUEVO** | Componente Popover (shadcn/Radix). |
| `src/components/CarpetaInfoPopover.tsx` | **NUEVO** | Popover con creación, última acción, log de actividad reciente. |
| `src/components/CarpetaHero.tsx` | Modificado | Botón (i) entre badge de estado y botón eliminar. |
| `src/app/actions/carpeta.ts` | Modificado | `FOLDER_CREATED`, `FOLDER_STATE_CHANGED`, `FOLDER_DELETED`. |
| `src/app/actions/apuntes.ts` | Modificado | `NOTE_CREATED`, `NOTE_DELETED`. |
| `src/app/actions/sugerencias.ts` | Modificado | `SUGGESTION_ACCEPTED`, `SUGGESTION_REJECTED`. |
| `src/app/actions/certificados.ts` | Modificado | `CERT_UPLOADED`, `CERT_DELETED`, `CERT_CONFIRMED`. |
| `src/app/actions/actuaciones.ts` | Modificado | `ACTUACION_GENERATED`. |

Hito ET8+ET9:
- Todas las acciones clave registran eventos en `audit_events`.
- Popover (i) muestra creación + última acción + log reciente.
- `npm run build` OK.

---

### ETAPA 10 — Notificaciones y Dashboard de estado (COMPLETADA)
Objetivo: que el escribano sepa qué carpetas necesitan atención sin tener que abrirlas una por una.

> **Completada 2026-03-07.** Sin migración SQL — lectura de datos existentes.

#### Archivos creados/modificados en ET10

| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `src/app/actions/pendientes.ts` | **NUEVO** | `getPendingActionsSummary()`: consulta sugerencias PROPOSED, certificados vencidos/por vencer/sin confirmar, actuaciones DRAFT. Retorna contadores + carpeta_ids. |
| `src/components/DashboardAlerts.tsx` | **NUEVO** | Server Component. Grid de AlertCards con semáforo (rojo/ámbar/azul) y links a carpetas afectadas. Estado verde cuando no hay pendientes. |
| `src/components/PendingBadge.tsx` | **NUEVO** | Client Component. Pill roja en sidebar "Inicio" con total de pendientes. Auto-refresh cada 60s. |
| `src/components/AppShell.tsx` | Modificado | Import + renderizado de `PendingBadge` junto a "Inicio". |
| `src/app/dashboard/page.tsx` | Modificado | Sección "Pendientes" con `DashboardAlerts` antes de "Alertas de Vencimiento". |

Hito ET10:
- Dashboard muestra resumen real con links a carpetas.
- Badge de pendientes visible en navegación.
- `npm run build` OK.

---

### ✅ ETAPA 12a — Motor Jurisdiccional Notarial: datos + resolver (COMPLETADA)
Objetivo: mapeo determinístico partido→códigos oficiales (RPI/ARBA + delegación CESBA) para minutas, certificados catastrales y boletas.

> **Completada 2026-03-08.** Migración 051 aplicada. JSON con 135 partidos PBA. Seed ejecutado.

#### Patrón "Cerebro Híbrido" aplicado
- La IA extrae texto libre del partido (ej: "Bahia Blanca", "M. Hermoso").
- TypeScript resuelve determinísticamente a códigos numéricos exactos.
- La IA NUNCA memoriza ni calcula códigos.

#### Archivos creados/modificados en ET12a

| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `src/data/pba_2026_jurisdictions.json` | **NUEVO** | Mapa de verdad PBA: 135 partidos con `code` (ARBA), `delegation_code` (CESBA), `aliases`. |
| `src/lib/services/JurisdictionResolver.ts` | **NUEVO** | Resolver determinístico. Patrón TaxonomyService: import estático JSON → singleton → O(1) alias lookup. Métodos: `resolve(text)`, `resolveByCode(code)`, `getAllParties()`. |
| `worker/src/jurisdictionResolver.ts` | **NUEVO** | Versión standalone para worker Railway (CommonJS). Lee JSON compartido vía `fs.readFileSync`. |
| `supabase_migrations/051_etapa_12__jurisdicciones.sql` | **NUEVO** | Tabla `jurisdicciones` (GIN index en aliases, RLS por org). Campos `partido_code` + `delegacion_code` en `inmuebles`. |
| `scripts/seed_jurisdictions.ts` | **NUEVO** | Seed idempotente: JSON → tabla `jurisdicciones` vía Supabase admin. |
| `src/app/api/ingest/route.ts` | Modificado | Post-extracción: `jurisdictionResolver.resolve(partido)` → guarda códigos en inmueble. |
| `worker/src/index.ts` | Modificado | Post-extracción escrituras: resuelve códigos en ambos puntos de insert de inmuebles. |
| `src/lib/templates/buildTemplateContext.ts` | Modificado | `partido_code` y `delegacion_code` disponibles en template context para minutas. |

#### Flujo implementado
```
Apunte/PDF ingesta → IA extrae "Bahia Blanca" como partido
  → normalizePartido() → "Bahia Blanca" (Title Case, sin tildes excepto ñ)
  → jurisdictionResolver.resolve("Bahia Blanca")
  → Exact match en aliasMap → { partyCode: "007", delegationCode: "007" }
  → inmuebles.insert({ partido_id: "Bahia Blanca", partido_code: "007", delegacion_code: "007" })
  → Template context incluye códigos → minutas RPI generan datos correctos
```

#### Matching strategy
1. **Exact match**: input normalizado (lowercase, sin acentos) vs aliases pregenerados.
2. **Containment match**: si no hay exact, busca el alias más largo contenido en el input (mínimo 4 chars).
3. **No match**: retorna `null` — el campo queda vacío, el escribano completa manualmente.

Hito ET12a:
- `jurisdictionResolver.resolve("Bahia Blanca")` → `{ partyCode: "007", ... }` ✅
- `jurisdictionResolver.resolve("M. Hermoso")` → `{ partyCode: "126", ... }` ✅
- `jurisdictionResolver.resolve("INVENTADO")` → `null` ✅
- `npm run build` OK ✅

---

### 🔲 ETAPA 12b — Admin UI para Jurisdicciones (PENDIENTE)
Objetivo: panel de administración para gestionar jurisdicciones sin tocar código.

Tareas planificadas:
- [ ] Nueva tab "Jurisdicciones" en `/admin/users` (junto a Escribanos, Usuarios, Conocimiento, Modelos).
- [ ] Toggle por provincia (PBA activa, Córdoba inactiva, etc.).
- [ ] Selector de versión activa por provincia.
- [ ] CRUD de partidos: nombre, código, delegación, aliases.
- [ ] Upgrade JurisdictionResolver: cargar desde Supabase con TTL cache (60s) en vez de JSON estático.
- [ ] Auditoría de cambios (`logAuditEvent`).

---

---

## 6) Reglas de PR y entrega
- Un PR por etapa (máximo 2).
- Checklist de etapa completo en descripción del PR.
- Evidencia: screenshots/logs.
- Migraciones: archivo nuevo en `supabase_migrations/` + actualización de `RUN_MIGRATIONS.md`.
- No avanzar sin OK del Owner (Diego).

---

## 7) Definición global de Done
- `npm run build` OK
- Sin `window.location.reload()` en módulo Carpeta
- Seguridad multi-tenant por Organización + RLS real en tablas sensibles
- IA asincrónica con estados + reintentos
- Entidad `sugerencias` como capa intermedia
- Evidencia + confianza en sugerencias
- Auditoría aceptar/rechazar
- UI operable aun si IA falla
- Dashboard de pendientes operativo

---

## 8) Deuda técnica identificada
- **Drafting versionado**: `template-render.ts` sobreescribe al regenerar. Necesita tabla `actuacion_borradores` o campo `version` para preservar historial. Prioridad: abordar antes o durante ET7.
- **Actuaciones como tab independiente**: si con el uso la lista crece mucho dentro de Mesa de Trabajo, considerar promover a tab propio. Decisión diferida a feedback de uso real.
- **12 modelos de actos faltantes**: cancelacion_hipoteca, poder, usufructo, afectacion_vivienda, fideicomiso, constitucion_sociedad, declaratoria_herederos, testamento, servidumbre, reglamento_ph, protocolizacion, certificacion_firmas. Necesitan DOCX fuente para ser procesados por el Template Builder.
- **Export de carpeta completa (ex-ET11)**: empaquetar escritura + certificados + actuaciones en ZIP/PDF. Nice-to-have, no es bloqueante para la operación diaria. Implementar cuando surja la necesidad real.
