# Diario de Desarrollo — NotiAR

## 2026-03-09

- Implementada pre-carga automática de datos en PresupuestoTab:
  - tipo_acto, monto, moneda, cotización, valuación fiscal, tipo inmueble, cantidad de inmuebles, cantidad de personas, partido/jurisdicción, vivienda única, banco provincia, fecha adquisición, certificado no retención, urgencia, honorarios, legalizaciones, apostillas.
  - Los campos se llenan al abrir la pestaña usando los datos de la carpeta, operación, inmueble y participantes.
- Actualizado ARCHITECTURE_PLAN.md para reflejar ET16 y ET12b.
- Panel admin de jurisdicciones y resolver DB ya integrados.

## Próximos pasos
- Validación cruzada de aporte mínimo en el engine.
- Agregar folio elaborado como rubro en el presupuesto.
- Revisar fallback de tope VU en la UI.
- Mejoras futuras: export Excel, ITG, certificación de copias, departamentos de registración.
