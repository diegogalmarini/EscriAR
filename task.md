# Task del Dia - 2026-03-12 (08:07)

## Contexto
Directiva del notario y del owner:
1. Primero acomodar pestanas y temas de interfaz (UI/UX) del flujo de carpeta.
2. Luego abordar Presupuestos como paso critico pre-carpeta.
3. Si el cliente no acepta presupuesto, no se crea carpeta ni se persisten datos finales.

## Objetivo Operativo de Hoy
Alinear producto, UX y persistencia para que el presupuesto sea una decision previa obligatoria antes de formalizar carpeta.

## Plan de Ejecucion
- [ ] Revisar UX de tabs en Carpeta (orden, nombres, jerarquia visual, friccion).
- [ ] Definir estado "presupuesto_en_proceso" y "presupuesto_aceptado" para habilitar creacion de carpeta.
- [ ] Implementar guardas en server actions para bloquear creacion/persistencia final sin aceptacion.
- [ ] Modelar campos personalizados + calculados de Presupuesto con validaciones.
- [ ] Registrar trazabilidad de aceptacion/rechazo (quien/cuando/canal).
- [ ] Ajustar copy y mensajes de negocio en UI para el flujo pre-carpeta.
- [ ] Actualizar DIARIO.md y ROADMAP.md al cerrar la jornada.

## Criterios de Aceptacion
- [ ] El sistema no crea carpeta si presupuesto no esta aceptado.
- [ ] El escribano puede editar campos manuales y ver calculados consistentes.
- [ ] La UI de tabs refleja el flujo real pedido por el notario.
- [ ] Queda evidencia documental de decisiones en DIARIO.md y ROADMAP.md.

## Referencias
- ROADMAP.md -> Tareas Inmediatas (12-03-2026)
- DIARIO.md -> Changelog 2026-03-12 08:07
- ARCHITECTURE_PLAN.md -> Nota de alineacion 2026-03-12 08:07
