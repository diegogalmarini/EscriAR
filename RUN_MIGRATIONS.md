# NotiAR — Orden de Migraciones

Ejecutar en orden en el SQL Editor de Supabase.
Cada archivo incluye PRECHECKS / APPLY / POSTCHECKS / ROLLBACK.

## Orden

| # | Archivo | Descripción | Estado |
|---|---------|-------------|--------|
| 038 | `supabase_migrations/038_etapa_2__org_and_rls.sql` | Organizaciones, org_users, RLS multi-tenant, search_carpetas | Ejecutada |
| 039 | `supabase_migrations/039_fix_rls_recursion.sql` | Fix recursión infinita RLS con SECURITY DEFINER | Ejecutada |
| 040 | `supabase_migrations/040_etapa_3__apuntes_sugerencias.sql` | Tablas apuntes + sugerencias, RLS por org, triggers updated_at | Ejecutada |
| 041 | `supabase_migrations/041_etapa_4__note_analysis_jobs.sql` | Extender ingestion_jobs: job_type, payload, entity_ref, org_id | **Pendiente** |
| 042 | `supabase_migrations/042_etapa_5__sugerencias_audit.sql` | Audit columns en sugerencias: applied_at, applied_by, apply_error, applied_changes | **Pendiente** |
| 043 | `supabase_migrations/043_etapa_6__actuaciones.sql` | Tabla actuaciones + tipos + generación documentos | Ejecutada |
| 044 | `supabase_migrations/044_escrituras_source_column.sql` | Columna source en escrituras (INGESTA/TRAMITE) | Ejecutada |
| 045 | `supabase_migrations/045_search_carpetas_tramite_only.sql` | search_carpetas filtra solo TRAMITE | Ejecutada |
| 046 | `supabase_migrations/046_fix_move_participants_to_tramite.sql` | Fix mover participantes a TRAMITE | Ejecutada |
| 047 | `supabase_migrations/047_etapa_7__cert_extraction.sql` | ET7: Extender certificados con extraction_data, extraction_evidence, extraction_status, confirmed_by/at | **Pendiente** |

## Instrucciones

1. Ejecutar los PRECHECKS antes de cada migración
2. Ejecutar la sección APPLY
3. Ejecutar los POSTCHECKS para verificar
4. Si algo falla, usar la sección ROLLBACK

## Notas

- Las migraciones anteriores a 038 ya fueron aplicadas y no se listan aquí
- Las funciones `user_has_org_access()` y `user_has_org_role()` (migración 039) son prerequisito para 040
- La migración 041 requiere que 040 esté ejecutada (tablas apuntes y sugerencias deben existir)
- La migración 042 requiere que 040 esté ejecutada (tabla sugerencias debe existir)
- Todas las tablas nuevas usan RLS por organización
