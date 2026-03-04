# NotiAR — Carpeta AI-First (Cerebro Híbrido) — Architecture & Implementation Plan
Fecha: 2026-03-04  
Owner: Diego  
Implementador: Agente  
Scope: Rediseño completo de Carpeta + IA proactiva + Jobs + Seguridad completa (multi-tenant por Organización + RLS)

---

## 0) Objetivo
Implementar la Carpeta notarial con:

- Header sticky colapsable con “situación actual” (etapa, pendientes, certificados, docs, firma).
- Pestaña inicial “Apuntes” como **Punto de Ingesta Semántica** (IA propone, humano confirma, código ejecuta).
- Pestaña “Actuaciones y documentos” separando **Instrumentos Privados** vs **Actos Protocolares**.
- Pre-escriturario con **OCR / extracción verificable** (evidencia + confirmación humana) y bloqueos determinísticos.
- Arquitectura completa de seguridad: **Organización (tenant) + roles** y **RLS real (no permisivo)**.

---

## 1) Principios obligatorios (Guardrails)
1) **Human-in-the-loop:** la IA no escribe datos canónicos sin confirmación explícita del usuario autorizado.  
2) **IA propone, el código ejecuta:** la IA solo genera *Sugerencias* estructuradas; el sistema aplica cambios determinísticos.  
3) **Evidencia + confianza:** cada sugerencia muestra “por qué” (fragmento/origen) y nivel de confianza.  
4) **Auditoría:** registrar aceptar/rechazar + quién/cuándo + cambios aplicados.  
5) **Asincronía:** IA en background con estados y reintentos; la UI nunca se bloquea.  
6) **Seguridad (prompt injection):** PDFs y texto se tratan como contenido no confiable (extracción-only).  
7) **Fallback:** si IA falla, el flujo manual sigue funcionando.  

---

## 2) No-Alcance (para evitar scope creep)
- No rediseñar el sistema completo de Personas/Inmuebles fuera de lo estrictamente necesario.
- No construir un sistema completo de “tareas” si no existe base; solo acciones mínimas ligadas a sugerencias.
- No reescribir por completo el pipeline existente (Mesa/Antecedentes/Pre/Post) en una sola etapa.
- No “validación legal” por IA: la IA extrae, el escribano valida, el código bloquea.

---

## 3) Stack & contexto del repo (actual)
- **Next.js App Router**
- **Tailwind + shadcn/ui** (Radix Tabs)
- **Supabase** (Postgres + Storage + Auth + RLS)
- **IA:** `src/lib/agent/SkillExecutor.ts` (Gemini Flash/Pro)
- **Jobs/background:** tabla `ingestion_jobs` + worker externo (Railway) que hace polling por status

Rutas y componentes relevantes (Discovery Pack):
- Carpeta: `src/app/carpeta/[id]/page.tsx`
- Orquestador: `src/components/FolderWorkspace.tsx`
- Header sticky: `src/components/CarpetaHero.tsx`
- Tabs content: dentro de `FolderWorkspace.tsx`

---

## 4) Modelo de Seguridad (CORREGIDO) — Multi-tenant por Organización
> Ya existe UI de Administración → Usuarios. Eso gestiona “quién entra al sistema”, pero falta el enganche DB/RLS.
> La seguridad correcta para NotiAR se basa en **Organización (Escribanía)**, no en `carpetas_users` como base.

### 4.1 Entidades
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

### 4.4 Bootstrap anti lock-out (obligatorio)
Al habilitar RLS:
- Crear una organización por defecto (Escribanía Galmarini).
- Asignar a Diego como `OWNER`.
- Backfill: todas las carpetas existentes → `org_id` de la org por defecto.
- Backfill: cualquier dato dependiente debe quedar accesible por esa org (por org_id o por join a carpeta).

---

## 5) Etapas y hitos (ejecución estricta por fases)

### ETAPA 1 — Estabilización del módulo Carpeta (sin cambios de UX)
Objetivo: reducir fragilidad antes de meter seguridad/IA/UX.

Tareas:
- Extraer estado de carpeta a `useCarpetaState()` o Zustand (fuente de verdad única).
- Eliminar `window.location.reload()` en flows de carpeta (reemplazar por optimistic updates + refresh controlado).
- Unificar estrategia de refresh (evitar mezcla caótica de refresh/reload).
- Modularizar `FolderWorkspace.tsx` (sacar dialogs y lógica repetida) sin cambiar UI.

Hito ET1 (entregables):
- PR con refactor sin cambios visibles.
- `npm run build` OK.
- `rg "location.reload"` → 0 ocurrencias en módulo carpeta.
- Mesa/Antecedentes/Pre/Post funcionan igual que antes.

Rollback:
- Revert PR.

---

### ETAPA 2 — Seguridad completa (Organización + Roles + RLS real)
Objetivo: pasar de RLS permisivo a seguridad real multi-tenant.

Tareas DB:
- Crear `organizaciones` y `organizaciones_users(user_id, org_id, role)`.
- Agregar `org_id` a `carpetas`.
- Asegurar acceso de tablas dependientes por:
  - `org_id` directo (si se agrega), o
  - join derivado a `carpetas` (si no se agrega `org_id` en todas).
- Implementar RLS real (no permisivo) en tablas sensibles mínimas:
  - `carpetas`, `escrituras`, `operaciones`, `participantes_operacion`,
  - `certificados`, `gravamenes`, `ingestion_jobs`,
  - y luego (cuando existan): `apuntes`, `sugerencias`.

Bootstrap (OBLIGATORIO):
- Crear org por defecto + asignar a Diego como `OWNER`.
- Backfill carpetas existentes a la org por defecto.
- Garantizar que Diego NO pierde acceso al activar RLS.

UI / comportamiento mínimo:
- Si usuario no pertenece a la org, negar acceso (redirect o mensaje).

Hito ET2 (entregables):
- PR + migración SQL (con PRECHECKS/APPLY/POSTCHECKS/ROLLBACK).
- `RUN_MIGRATIONS.md` actualizado.
- Prueba manual documentada:
  - Usuario autorizado accede y opera.
  - Usuario no autorizado NO puede leer ni escribir.

Rollback:
- SQL `ROLLBACK` listo para desactivar policies/rls y revertir `org_id` si hace falta.
- Revert PR.

---

### ETAPA 3 — Modelo AI-First base: Apuntes + Sugerencias (sin IA primero)
Objetivo: crear estructura y UI base sin depender del modelo.

Tareas DB:
- Crear tablas `apuntes` y `sugerencias` con RLS por organización.
- Índices por `carpeta_id`, `created_at`.

Tareas App:
- Server Actions: apuntes (create/list/update opcional).
- Server Actions: sugerencias (list/accept/reject — por ahora solo estado).
- UI: nueva pestaña “Apuntes” como default + panel de sugerencias (mock con datos reales).

Hito ET3:
- PR
- Se puede crear apunte y verlo listado.
- Se puede aceptar/rechazar sugerencia (solo cambia estado).
- Acceso protegido por RLS (usuario fuera de org no ve nada).

Rollback:
- Revert PR + drop tables si fuese necesario.

---

### ETAPA 4 — Jobs IA para Apuntes (Gemini Flash) + creación automática de Sugerencias
Objetivo: Apuntes como ingesta semántica real (asincrónica).

Tareas DB:
- Extender `ingestion_jobs` para soportar nuevos `job_type` y referencias:
  - `job_type` (INGEST / NOTE_ANALYSIS / CERT_EXTRACT / DRAFT_DOC)
  - `payload` (jsonb)
  - `entity_ref` (jsonb; ej `{ apunte_id }`)
- RLS por org en `ingestion_jobs`.

Tareas Worker (Railway):
- Crear job NOTE_ANALYSIS al guardar apunte.
- Worker procesa NOTE_ANALYSIS con `SkillExecutor` usando `gemini-2.5-flash`.
- Validar salida por schema (Zod).
- Persistir sugerencias con evidencia + confianza.
- Actualizar `apuntes.ia_status` (PROCESANDO/COMPLETADO/ERROR).

Tareas UI:
- Mostrar estados “Analizando/Listo/Error/Reintentar”.
- Reintento crea/relanza job.

Hito ET4:
- PR
- Guardar apunte → aparece “Analizando…” → se generan sugerencias reales.
- Reintento funciona.
- UI no se bloquea.

Rollback:
- Deshabilitar creación de jobs (feature flag) + revert PR.

---

### ETAPA 5 — Motor determinístico: aceptar sugerencias aplica cambios reales
Objetivo: “IA propone, código ejecuta” con cambios canónicos.

Tareas:
- Implementar `applySuggestion()` determinístico.
- Soportar tipos mínimos:
  - crear acto privado,
  - crear acto protocolar,
  - completar parte (upsert persona + link).
- Auditoría mínima: `applied_changes_ref` (o registro equivalente).
- Permisos: solo NOTARIO/OWNER puede aceptar sugerencias “críticas”.

Hito ET5:
- PR
- Aceptar sugerencia crea operación y/o vincula persona sin reload.
- Auditoría visible (al menos en DB).

Rollback:
- Deshabilitar accept (feature flag) + revert PR.

---

### ETAPA 6 — Actuaciones y documentos: Privado vs Protocolo + drafting AI
Objetivo: inventario documental limpio + drafting contextual.

Tareas DB:
- Agregar `operaciones.categoria_documental` (PRIVADO/PROTOCOLO) + backfill.
- Asegurar que “solo PROTOCOLO” alimente índice/protocolo.

Tareas UI:
- Crear pestaña “Actuaciones” con 2 listas colapsables:
  - Instrumentos Privados
  - Actos Protocolares
- Mantener Mesa de Trabajo funcional (no romper pipeline actual).

Drafting:
- “Generar desde modelo” llama a skill `deedDrafter` (Gemini Pro si corresponde) con contexto acotado.
- Guardar como borrador versionado (no perder versión previa en regenerar).

Hito ET6:
- PR
- Operaciones separadas por categoría.
- Drafting genera borrador sin romper FaseRedaccion.

Rollback:
- Feature flag oculta pestaña + revert PR.

---

### ETAPA 7 — Pre-escriturario AI: OCR/extracción verificable + bloqueos
Objetivo: semáforo confiable con evidencia y confirmación humana.

Tareas DB:
- Extender `certificados` con:
  - extraction fields (jsonb),
  - evidence fields (jsonb),
  - status de extracción,
  - confirmación (confirmed_by/at).
- Job CERT_EXTRACT en `ingestion_jobs`.

Tareas Worker:
- Procesar CERT_EXTRACT con `notary-rpi-reader` usando `gemini-2.5-pro`.
- Guardar extracción + evidencia.

Tareas UI (Pre-escriturario):
- Mostrar campos extraídos + evidencia.
- Confirmar/corregir: solo confirmado impacta fecha_vencimiento/estado.
- Bloqueos determinísticos visibles en header (si vencido/bloqueante).

Hito ET7:
- PR
- Subir certificado → extracción → confirmación → semáforo/chips actualizados.
- Bloqueo determinístico funciona.

Rollback:
- Deshabilitar CERT_EXTRACT + revert PR.

---

### ETAPA 8 — Header sticky final + QA
Objetivo: “situación actual” impecable + estabilidad.

Tareas UI:
- Rework `CarpetaHero.tsx`:
  - chip “Etapa: …”,
  - chips accionables (Pendientes/Certificados/Docs/Firma),
  - colapsado sin lag,
  - menú acciones seguro (sin delete suelto).
- QA manual: flujos críticos + permisos RLS + fallback IA.

Hito ET8:
- PR
- Header colapsa sin lag; chips navegan; acciones peligrosas protegidas.
- `npm run build` OK.

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

---