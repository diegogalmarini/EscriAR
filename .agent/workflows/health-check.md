---
description: Verifica que los 3 servicios críticos (GitHub, Vercel, Railway) estén sincronizados y corriendo
---
// turbo-all

# Health-Check de Infraestructura EscriAR

> **IMPORTANTE**: Si CUALQUIERA de estos servicios falla, el SaaS completo deja de funcionar.
> Ejecutar este workflow ANTES de hacer cualquier cambio en producción y DESPUÉS de cada push.

## 1. Verificar estado de Git local vs GitHub
```bash
git status
```
- Verificar: NO debe haber cambios sin commitear
- Si hay cambios pendientes → hacer commit y push ANTES de continuar

```bash
git log origin/main..HEAD --oneline
```
- Verificar: NO debe haber commits locales sin pushear
- Si hay commits pendientes → hacer `git push origin main`

## 2. Verificar Vercel (Frontend + API Routes)
Hacer fetch a la URL de producción para confirmar que responde:
```
Navegar al sitio: https://escriar.com
```
- Verificar: debe cargar sin errores 500
- Si falla → revisar logs de Vercel con MCP GitHub para ver el último deploy

**IMPORTANTE**: Vercel tiene timeout de ~60s para serverless functions. 
NUNCA colocar lógica de extracción IA pesada (Gemini) en API routes de Vercel.
La extracción SIEMPRE debe ejecutarse en Railway.

## 3. Verificar Railway (Worker de Extracción)
El worker tiene un healthcheck HTTP. Verificar que responde:
```
Navegar o hacer fetch a la URL del worker Railway (ver variable RAILWAY_URL en el dashboard)
```
- Debe responder: "EscriAR Worker is running"
- Si NO responde → el worker está caído → TODAS las extracciones de escrituras se quedarán en bucle infinito
- Verificar en Railway dashboard que el servicio esté RUNNING

## 4. Verificar Supabase (Base de Datos)
Usar MCP Supabase para verificar:
```sql
SELECT count(*) FROM ingestion_jobs WHERE status = 'pending' AND created_at < now() - interval '5 minutes';
```
- Si hay jobs pendientes de más de 5 minutos → Railway NO está procesando → worker caído
- Acción: verificar Railway inmediatamente

```sql
SELECT count(*) FROM protocolo_registros WHERE extraction_status IN ('PENDIENTE', 'PROCESANDO') AND updated_at < now() - interval '10 minutes';
```
- Si hay registros stuck → marcarlos como ERROR y verificar Railway

## 5. Resumen de verificación
Al finalizar, reportar al usuario:

| Servicio | Estado | Última actividad |
|----------|--------|-----------------|
| GitHub | ✅/❌ | Último commit: [hash] |
| Vercel | ✅/❌ | Deploy: [status] |
| Railway | ✅/❌ | Worker: [running/stopped] |
| Supabase | ✅/❌ | Jobs stuck: [count] |

## Regla de Oro
> **NUNCA se verá un cambio si no se actualiza GitHub.**
> Los 3 servicios dependen de GitHub como fuente de verdad:
> - Vercel hace deploy automático desde `main`
> - Railway hace deploy automático desde `main`
> - Si GitHub no está actualizado, NADA se actualiza
