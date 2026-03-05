# NotiAR — Carpeta AI-First (Cerebro Híbrido) — Architecture & Implementation Plan
Fecha: 2026-03-04 (actualizado 2026-03-05)  
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
| ET7 — Pre-escriturario AI | 🔜 NEXT | — | Scaffolding existente: `CertificadosPanel.tsx`, `notary-rpi-reader.ts`, tabla `certificados`. |
| ET8 — Header sticky final | ⏳ PENDIENTE | — | `CarpetaHero.tsx` ya es sticky con badge. Falta: chips accionables, colapsado, menú seguro. |
| ET9 — Auditoría | ⏳ PENDIENTE | — | No iniciada. |
| ET10 — Notificaciones | ⏳ PENDIENTE | — | Nueva etapa. |
| ET11 — Export carpeta | ⏳ PENDIENTE | — | Nueva etapa. |

Total: **45 migraciones SQL**, **14+ componentes principales**, **6 etapas completadas**.

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
- **Template Builder:** Streamlit en `notiar-template-builder/` (34 modelos de actos en Supabase)

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

### ETAPA 7 — Pre-escriturario AI: OCR/extracción verificable + bloqueos (NEXT)
Objetivo: semáforo confiable con evidencia y confirmación humana.

> **Scaffolding existente:** la tabla `certificados` (mig. 031), `CertificadosPanel.tsx`, `CertificadoDialog.tsx`, y `notary-rpi-reader.ts` ya existen. El plumbing de jobs (`ingestion_jobs` con `job_type`) ya soporta `CERT_EXTRACT`. Esta etapa conecta las piezas.

Tareas DB:
- Extender `certificados` con:
  - `extraction_data` (jsonb) — campos extraídos por IA.
  - `extraction_evidence` (jsonb) — fragmentos/coordenadas del PDF fuente.
  - `extraction_status` (PENDIENTE/PROCESANDO/COMPLETADO/ERROR).
  - `confirmed_by` (uuid), `confirmed_at` (timestamp) — confirmación humana.
- Job `CERT_EXTRACT` en `ingestion_jobs` (el esquema ya lo soporta, solo crear el flujo).

Tareas Worker:
- Procesar `CERT_EXTRACT` con `notary-rpi-reader` usando `gemini-2.5-pro`.
- Guardar extracción + evidencia en `certificados`.

Tareas UI (Pre-escriturario):
- Mostrar campos extraídos + evidencia (fragmento del PDF).
- Confirmar/corregir: solo confirmado impacta `fecha_vencimiento`/estado.
- Bloqueos determinísticos visibles en header (si vencido/bloqueante → chip rojo en CarpetaHero).

Hito ET7:
- PR
- Subir certificado → extracción → confirmación → semáforo/chips actualizados.
- Bloqueo determinístico funciona.

Rollback:
- Deshabilitar CERT_EXTRACT (feature flag) + revert PR.

---

### ETAPA 8 — Header sticky final + QA
Objetivo: "situación actual" impecable + estabilidad.

> **Scaffolding existente:** `CarpetaHero.tsx` ya es sticky con `backdrop-blur`, contiene Badge de estado y botón delete. Falta el rework visual de chips y el colapsado.

Tareas UI:
- Rework `CarpetaHero.tsx`:
  - chip "Etapa: …" (estado de la carpeta).
  - chips accionables: Pendientes (sugerencias), Certificados (vencidos/OK), Docs (generados), Firma.
  - colapsado sin lag (intersection observer o scroll threshold).
  - menú acciones seguro (confirmar antes de delete, proteger acciones destructivas).
- QA manual: flujos críticos + permisos RLS + fallback IA.

Hito ET8:
- PR
- Header colapsa sin lag; chips navegan a tab/sección correcta; acciones peligrosas protegidas.
- `npm run build` OK.

Rollback:
- Revert PR.

---

### ETAPA 9 — Logs / Auditoría (Admin) — trazabilidad notarial
Objetivo: incorporar un registro auditable de acciones (quién, qué, cuándo, sobre qué) con filtros y buscador.

Tareas DB:
- Crear tabla `audit_events` con:
  - `id`, `created_at`, `org_id`
  - `actor_user_id`, `actor_role` (snapshot)
  - `action` (ej: FOLDER_CREATED, NOTE_CREATED, NOTE_DELETED, SUGGESTION_ACCEPTED, CERT_CONFIRMED, LOGIN, USER_APPROVED, etc.)
  - `entity_type`, `entity_id`
  - `summary` (línea general)
  - `metadata jsonb` (before/after, ids relacionados, confidence, evidencia, etc.)
  - `ip`, `user_agent`
  - `request_id` / `correlation_id`
  - `result` (OK/ERROR) + `error_message`
- RLS por organización. Acceso a logs: solo `OWNER/ADMIN` (y si se define, `NOTARIO` lectura).

Tareas App (instrumentación):
- Crear helper `logAuditEvent()` y llamarlo desde Server Actions y acciones sensibles:
  - CRUD de carpeta, cambios de estado, delete/archivar.
  - CRUD de apuntes (crear/editar/borrar).
  - Aceptar/rechazar sugerencias.
  - Carga/confirmación de certificados y cambios de vigencia.
  - Generación/regeneración/descarga de documentos.
  - Aprobaciones/bajas de usuarios (Administración).
- Asegurar que acciones críticas registren `request_id` para trazabilidad.

Tareas UI (Administración):
- Agregar pestaña "Logs" después de "Modelos".
- Tabla con columnas: Fecha/Hora, Usuario, Acción, Entidad, Resumen, Resultado.
- Buscador global + filtros:
  - por usuario, por acción, por entidad, por rango de fechas.
- Drawer/modal para ver `metadata` completa.

Hito ET9:
- PR + migración SQL + `RUN_MIGRATIONS.md` actualizado.
- Evidencia: se registran eventos reales al crear/borrar apunte y al cambiar estado de carpeta.
- UI Logs permite filtrar por usuario y fecha.

Rollback:
- Revert PR + rollback SQL (drop policies/table) si fuera necesario.

---

### ETAPA 10 — Notificaciones y Dashboard de estado (NUEVA)
Objetivo: que el escribano sepa qué carpetas necesitan atención sin tener que abrirlas una por una.

Tareas:
- **Dashboard `/dashboard`** con resumen:
  - Carpetas con sugerencias pendientes (PROPOSED).
  - Certificados próximos a vencer o vencidos.
  - Actuaciones sin documento generado.
  - Carpetas bloqueadas por pre-escriturario.
- **Badge global** en sidebar/nav indicando items que requieren acción.
- **Email digest** (opcional, posterior): resumen semanal de carpetas con pendientes. Puede usar Supabase Edge Functions o servicio externo.

Hito ET10:
- PR
- Dashboard muestra resumen real con links a carpetas.
- Badge de pendientes visible en navegación.

Rollback:
- Revert PR.

---

### ETAPA 11 — Export de carpeta completa (NUEVA)
Objetivo: permitir descargar toda la documentación de una carpeta como bundle (ZIP o PDF compuesto).

Motivación: en el ámbito notarial, poder exportar la carpeta completa (escritura, certificados, actuaciones, documentos generados) es un requisito operativo para archivo y para entregar al cliente.

Tareas:
- Server Action `exportCarpeta(carpetaId)`:
  - Recopilar: escritura (DOCX/PDF), certificados (PDFs de Storage), actuaciones generadas (DOCX).
  - Generar carátula/índice.
  - Empaquetar como ZIP (o PDF compuesto con TOC si se prefiere).
- UI: botón "Exportar Carpeta" en CarpetaHero o menú de acciones.
- Auditar evento `CARPETA_EXPORTED` (si ET9 ya existe).

Hito ET11:
- PR
- Descargar ZIP con todos los documentos de una carpeta.
- Auditoría del export (si disponible).

Rollback:
- Revert PR.

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
- Export de carpeta funcional
- Dashboard de pendientes operativo

---

## 8) Deuda técnica identificada
- **Drafting versionado**: `template-render.ts` sobreescribe al regenerar. Necesita tabla `actuacion_borradores` o campo `version` para preservar historial. Prioridad: abordar antes o durante ET7.
- **Actuaciones como tab independiente**: si con el uso la lista crece mucho dentro de Mesa de Trabajo, considerar promover a tab propio. Decisión diferida a feedback de uso real.
- **12 modelos de actos faltantes**: cancelacion_hipoteca, poder, usufructo, afectacion_vivienda, fideicomiso, constitucion_sociedad, declaratoria_herederos, testamento, servidumbre, reglamento_ph, protocolizacion, certificacion_firmas. Necesitan DOCX fuente para ser procesados por el Template Builder.
