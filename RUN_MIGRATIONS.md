# RUN_MIGRATIONS.md — NotiAR (Supabase)  
Fecha: 2026-03-04  
Entorno: Supabase (SQL Editor)  
Nota: En este repo las migraciones se ejecutan **manual** en el Dashboard. Este documento define el **orden**, los **checks** y el **rollback**.

---

## 0) Convenciones (OBLIGATORIO)

1) **Un archivo por etapa**
- Cada etapa crea **1** archivo nuevo en `supabase_migrations/` con el prefijo:  
  `0XX_etapa_<n>__<slug>.sql`  
  Ej: `038_etapa_2__membresia_rls.sql`

2) **Nunca edites migraciones viejas**
- Si hay cambios, crea una nueva migración.

3) **Todo SQL debe ser idempotente cuando sea posible**
- Usar `create table if not exists`, `create index if not exists`, checks previos, etc.
- Cuando no sea posible (policies), incluir “DROP IF EXISTS” en rollback.

4) **Cada migración debe tener 3 secciones**
- `-- PRECHECKS`
- `-- APPLY`
- `-- POSTCHECKS`
y un bloque separado de `-- ROLLBACK` (para copiar/pegar).

---

## 1) Cómo ejecutar una migración (paso a paso)

### Paso 1 — Backup lógico mínimo (recomendado)
Antes de tocar RLS/Policies o tablas core, exportar (si aplica):
- Estructura/Policies actuales (captura o export)
- Filas críticas (owner, carpetas) si vas a cambiar acceso

### Paso 2 — Ejecutar PRECHECKS
- Abrir Supabase Dashboard → SQL Editor
- Pegar **solo** el bloque `-- PRECHECKS`
- Confirmar que todo “pasa” (no hay sorpresas)

### Paso 3 — Ejecutar APPLY
- Pegar bloque `-- APPLY`
- Ejecutar y guardar resultado

### Paso 4 — Ejecutar POSTCHECKS
- Pegar bloque `-- POSTCHECKS`
- Confirmar que:
  - tablas/columnas existen
  - índices creados
  - policies habilitadas
  - ejemplos de SELECT/INSERT funcionan según roles

### Paso 5 — Smoke test en la app
- Login con usuario autorizado
- Probar flujo mínimo del módulo afectado
- Login con usuario NO autorizado (cuando aplique RLS) y verificar deny

---

## 2) Orden de ejecución por etapas

> IMPORTANTE: No ejecutes etapas fuera de orden.

### ETAPA 1 — Estabilización (sin migración DB esperada)
- Normalmente **sin SQL**. Si se agrega algo, documentarlo aquí.

### ETAPA 2 — Organizaciones + Roles + RLS multi-tenant
1) Ejecutar: `038_etapa_2__org_and_rls.sql`
2) Verificar POSTCHECKS (9 checks: tablas, org por defecto, Diego OWNER, RLS enabled, policies count)
3) Smoke tests de acceso:
   - Login como Diego → puede ver/crear/editar carpetas
   - Usuario sin membresía → NO puede ver carpetas (count = 0)
4) **IMPORTANTE**: Antes de ejecutar, asegurarse de que el código de la app ya está desplegado (la app debe usar `createClient()` server-side para RLS)

### ETAPA 3 — Apuntes + Sugerencias (sin IA)
1) Ejecutar: `039_etapa_3__apuntes_sugerencias.sql`

### ETAPA 4 — Jobs NOTE_ANALYSIS (extensión de ingestion_jobs)
1) Ejecutar: `040_etapa_4__ingestion_jobs_job_type.sql`

### ETAPA 5 — Motor determinístico (posibles campos auditoría)
1) Ejecutar: `041_etapa_5__suggestions_audit_fields.sql` (solo si no se incluyó antes)

### ETAPA 6 — Categoría documental en operaciones
1) Ejecutar: `042_etapa_6__operaciones_categoria_documental.sql`

### ETAPA 7 — Certificados extracción verificable + confirmación
1) Ejecutar: `043_etapa_7__certificados_extraction_fields.sql`

### ETAPA 8 — QA / ajustes finales
- Solo migraciones menores, documentar si aplica.

---

## 3) Template de migración SQL (copiar en cada archivo)

```sql
-- =========================================
-- MIGRATION: 0XX_etapa_N__slug.sql
-- Fecha:
-- Etapa:
-- Descripción:
-- =========================================

-- PRECHECKS
-- 1) Validar que no existe ya la estructura (o que es compatible)
-- 2) Validar counts / estados relevantes
-- 3) Validar policies actuales (si se tocarán)

-- APPLY
-- BEGIN;

-- ... SQL principal ...

-- COMMIT;

-- POSTCHECKS
-- 1) Confirmar tablas/columnas
-- 2) Confirmar índices
-- 3) Confirmar RLS enabled
-- 4) Confirmar policies creadas
-- 5) Queries de ejemplo

-- ROLLBACK (copiar/pegar solo si hace falta)
-- BEGIN;

-- ... drop policies / revert columns / drop tables (con cuidado) ...

-- COMMIT;