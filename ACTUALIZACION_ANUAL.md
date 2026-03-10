# Checklist de Actualización Fiscal Anual — EscriAR

> **Cuándo**: Diciembre de cada año, cuando se publican las nuevas leyes impositivas y tabla CESBA.
> **Quién**: El administrador del SaaS (escribano titular).
> **Tiempo estimado**: 2-3 horas de trabajo manual + deploy.

---

## Fuentes oficiales a consultar

| Fuente | Qué publicar | Dónde buscar |
|--------|-------------|--------------|
| Boletín Oficial PBA | Ley Impositiva (topes VU, UT, coeficientes correctores) | https://www.gba.gob.ar/boletin_oficial |
| ARBA | Coeficientes de valuación fiscal, Unidad Tributaria | https://www.arba.gov.ar |
| CESBA (Colegio Escribanos BA) | Tabla de Actos, aportes mínimos, tasas registrales | https://www.colescba.org.ar |
| RPBA (Registro de la Propiedad) | Tarifario certificados e informes | Circular del RPBA |
| UIF | SMVM para cálculo de umbral reportable | https://www.argentina.gob.ar/uif |
| Ley Tarifaria CABA | Tope exención Sellos CABA (si se expande a CABA) | BOCBA |

---

## Checklist por año

### Paso 1: Actualizar `src/data/fiscal_config_[AÑO].json`

- [ ] **Sellos PBA**: verificar si la tasa sigue siendo 2% (`sellos.rate`)
- [ ] **Tope Vivienda Única**: actualizar `sellos.tope_vu_edificado` y `sellos.tope_vu_baldio`
- [ ] **Tope default Sellos**: actualizar `sellos.tope_default` si cambió
- [ ] **ITI**: verificar si la tasa sigue en 1.5% (`iti.rate`) — es ley nacional, rara vez cambia
- [ ] **IVA**: verificar si sigue en 21% (`iva.rate`) — ley nacional
- [ ] **Aportes**: actualizar `aportes.caja_notarial` y `aportes.colegio` si cambiaron las alícuotas
- [ ] **Tasa Retributiva 4‰**: verificar si ARBA la reinstauró (`tasa_retributiva.suspended`)
- [ ] **RPI mínimos**: actualizar `rpi.min_fee` y `rpi.prorroga`
- [ ] **Aporte mínimo notarial**: actualizar `aporte_min_notarial`
- [ ] **Unidad Tributaria ARBA**: actualizar `ut_arba`
- [ ] Cambiar `version` a `"[AÑO]"`

### Paso 2: Regenerar `src/data/acts_taxonomy_[AÑO].json`

- [ ] Obtener nueva tabla CESBA en PDF
- [ ] Parsear con script o manualmente los cambios
- [ ] Actualizar `stamp_duty_rate` por acto si hubo cambios
- [ ] Actualizar `fees_extracted` (honorarios mínimos) por acto
- [ ] Verificar si hay nuevos códigos de acto o códigos eliminados
- [ ] Verificar flags `suspended_rate_[AÑO]` — ¿se levantó alguna suspensión?

### Paso 3: Costos de trámites registrales

- [ ] Actualizar `src/data/catalogo_tramites_notariales.json` con nuevos montos fijos
- [ ] Certificados de dominio (simple, urgente, en el día)
- [ ] Certificados de inhibición
- [ ] Informes registrales
- [ ] Prórrogas

### Paso 4: UIF / Compliance

- [ ] Actualizar SMVM vigente para cálculo de umbral de reporte (750 SMVM)
- [ ] Verificar si UIF cambió los umbrales de reporte en resoluciones nuevas

### Paso 5: Verificación

- [ ] `npm run build` — sin errores
- [ ] Probar liquidación de una compraventa típica (ej: USD 100.000 a cotización actual)
- [ ] Comparar resultado con cálculo manual del escribano
- [ ] Verificar que el footer del panel muestra el año correcto
- [ ] Deploy a producción

---

## Notas importantes

- **NO hace falta tocar código TypeScript** para actualizar valores fiscales. Solo el JSON.
- La excepción es si ARBA/CESBA crean un **nuevo tipo de impuesto o tasa** que no existía antes.
- Si se expande a CABA u otra provincia, crear `fiscal_config_2026_caba.json` con sus propios valores.
- Git blame del JSON muestra exactamente quién y cuándo cambió cada valor.
