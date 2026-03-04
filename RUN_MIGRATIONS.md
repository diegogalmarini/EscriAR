# NotiAR — Orden de Migraciones

Ejecutar en orden en el SQL Editor de Supabase.
Cada archivo incluye PRECHECKS / APPLY / POSTCHECKS / ROLLBACK.

## Orden

| # | Archivo | Descripción | Estado |
|---|---------|-------------|--------|
| 038 | `supabase_migrations/038_etapa_2__org_and_rls.sql` | Organizaciones, org_users, RLS multi-tenant, search_carpetas | Ejecutada |
| 039 | `supabase_migrations/039_fix_rls_recursion.sql` | Fix recursión infinita RLS con SECURITY DEFINER | Ejecutada |
| 040 | `supabase_migrations/040_etapa_3__apuntes_sugerencias.sql` | Tablas apuntes + sugerencias, RLS por org, triggers updated_at | **Pendiente** |

## Instrucciones

1. Ejecutar los PRECHECKS antes de cada migración
2. Ejecutar la sección APPLY
3. Ejecutar los POSTCHECKS para verificar
4. Si algo falla, usar la sección ROLLBACK

## Notas

- Las migraciones anteriores a 038 ya fueron aplicadas y no se listan aquí
- Las funciones `user_has_org_access()` y `user_has_org_role()` (migración 039) son prerequisito para 040
- Todas las tablas nuevas usan RLS por organización
