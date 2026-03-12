# EscriAR — Roadmap de Desarrollo

> **Documento compartido entre todos los agentes.**
> Antes de comenzar cualquier tarea, consultar este roadmap para saber qué está hecho, qué falta, y en qué orden trabajar.
> Actualizar el estado de cada hito al completarlo.

---

## Estado General

| Etapa | Descripción | Estado |
|-------|------------|--------|
| **Fundación** | Infraestructura, extracción AI, datos base | COMPLETADA |
| **Etapa 1** | Certificados, estudio de título, liquidación impositiva | EN PROGRESO |
| **Etapa 2** | Redacción de escritura, sellos ARBA, firma | PENDIENTE |
| **Etapa 3** | Testimonio, minuta rogatoria, índice protocolar | PENDIENTE |

---

## Tareas Inmediatas (12-03-2026)

1. **Reorganización de UI**: Acomodar pestañas y temas de interfaz gráfica según indicaciones del Notario. ✅ COMPLETADO (Sesión 22)
2. **Módulo de Presupuestos (Paso Crítico Pre-Carpeta)**: Existen cantidad de presupuestos diferentes y cada uno es muy personalizado (campos personalizados y calculados). Este es el **primer paso absoluto** antes de crear una carpeta; si el cliente no acepta el presupuesto, la carpeta no se crea ni se guardan los datos finales.

---

## FUNDACIÓN (Completada)

Lo que ya está construido y funcionando en producción:

### Infraestructura
- [x] Dual pipeline de ingesta: sync Vercel (<500KB) + async Railway worker (cola)
- [x] Extracción AI con Gemini (texto + Vision OCR para escaneados)
- [x] Supabase: Auth, Storage bucket `escrituras`, PostgreSQL, pgvector
- [x] Sentry monitoring
- [x] 18 rutas de página, 8 endpoints API

### Datos Extraídos por AI
- [x] Escrituras: número, fecha, escribano, registro, folio
- [x] Operaciones: tipo de acto, monto ARS/USD, código CESBA
- [x] Personas: nombre, DNI/CUIT, nacionalidad, estado civil, domicilio, filiación, cónyuge
- [x] Inmuebles: partido, partida, nomenclatura, transcripción literal, título antecedente, valuación fiscal
- [x] Representación: apoderado → representado, poder otorgado (poder_detalle)

### Integridad de Datos
- [x] Dedup personas por DNI (FISICA) y CUIT (JURIDICA)
- [x] Dedup inmuebles por partido+partida (UNIQUE constraint)
- [x] Dedup escrituras por protocolo+registro
- [x] Normalización: partido Title Case sin tildes, partida sin puntos
- [x] Split de partidas múltiples ("X / Y" → 2 inmuebles)
- [x] Migraciones 001–029 ejecutadas

### UI
- [x] Dashboard, Carpetas, Clientes, Inmuebles, Tabla de Actos
- [x] Vista de carpeta (FolderWorkspace) con tarjetas de participantes
- [x] Visor de documentos con signed URLs
- [x] Búsqueda global (personas, inmuebles, carpetas)
- [x] Ficha pública compartible por link/token
- [x] Roles completos: COMPRADOR, VENDEDOR, CEDENTE, CESIONARIO, ACREEDOR, DEUDOR, APODERADO, CONDOMINO, DONANTE, DONATARIO, FIDUCIANTE, MUTUARIO, GARANTE, etc.

### Motor RAG ("La Biblia")
- [x] Base de conocimiento legal con pgvector embeddings
- [x] Conceptos hipotecarios documentados
- [x] Taxonomía CESBA 2026 con 200+ códigos verificados

### Skills Implementados (con código TS funcional)
- [x] `documentClassifier` — clasifica tipo de documento
- [x] `deedDrafter` — borrador de escritura AI
- [x] `taxCalculator` — cálculo de tasas y sellos (Actualizado: Derogación ITI / Ganancias Global)
- [x] `timelinePlanner` — planificación de plazos

### Skills Definidos (solo prompt/spec, sin TS)
- [ ] `notary-certificate-manager` — validar vencimientos de certificados
- [ ] `notary-entity-extractor` — extracción de entidades (cubierto por pipeline)
- [ ] `notary-identity-vision` — OCR de DNI/pasaporte
- [ ] `notary-mortgage-reader` — lectura de cláusulas hipotecarias
- [ ] `notary-property-extractor` — extracción de inmuebles (cubierto por pipeline)
- [ ] `notary-registration-exporter` — generación de minuta XML/JSON para RPI
- [ ] `notary-rpi-reader` — análisis de certificados RPI (gravámenes, inhibiciones)
- [ ] `notary-tax-calculator` — ya existe como `taxCalculator`
- [ ] `notary-uif-compliance` — compliance AML/UIF
- [ ] `notary-audit-logger` — trazabilidad
- [ ] `notary-legal-validator` — validación legal automática

---

## ETAPA 1 — Estudio de Título y Liquidación Impositiva

> **Objetivo**: El escribano abre una carpeta, sube el PDF del título antecedente, y EscriAR le presenta toda la información necesaria para redactar: certificados vigentes, estudio de dominio, datos de las partes, y liquidación de impuestos.

### Hito 1.1: Gestor de Certificados
**Prioridad**: ALTA | **Dependencias**: ninguna

El escribano necesita solicitar y trackear certificados obligatorios antes de escriturar.

- [x] Crear tabla `certificados` en BD:
  ```
  id UUID PK, carpeta_id FK, tipo TEXT (DOMINIO, INHIBICION, CATASTRAL, DEUDA_MUNICIPAL, DEUDA_ARBA, RENTAS, AFIP, ANOTACIONES_PERSONALES),
  estado TEXT (PENDIENTE, SOLICITADO, RECIBIDO, VENCIDO),
  fecha_solicitud DATE, fecha_recepcion DATE, fecha_vencimiento DATE,
  nro_certificado TEXT, organismo TEXT, observaciones TEXT, pdf_url TEXT
  ```
- [x] UI: Panel de certificados en FolderWorkspace con semáforo (verde/amarillo/rojo por vencimiento)
- [x] Lógica de vencimiento automática: certificados de dominio vencen a los 15/30 días según jurisdicción
- [x] Alerta visual cuando un certificado está por vencer o ya venció
- [x] Posibilidad de adjuntar PDF del certificado recibido

**Criterio de aceptación**: El escribano ve en la carpeta un panel con todos los certificados requeridos, su estado, y alertas de vencimiento. ✅ COMPLETADO

---

### Hito 1.2: Lector de Certificados RPI (Dominio e Inhibición)
**Prioridad**: ALTA | **Dependencias**: Hito 1.1

El escribano sube el certificado de dominio/inhibición y EscriAR extrae automáticamente gravámenes, embargos, hipotecas, inhibiciones.

- [x] Implementar skill `notary-rpi-reader` en TypeScript:
  - Subir PDF del certificado → extraer con Gemini
  - Detectar: EMBARGO (preventivo/ejecutivo/definitivo), HIPOTECA VIGENTE, INHIBICION GENERAL, BIEN DE FAMILIA, USUFRUCTO, LITIS
  - Extraer por cada gravamen: tipo, monto, autos, juzgado, fecha inscripción
- [x] Crear tabla `gravamenes` en BD:
  ```
  id UUID PK, inmueble_id FK, tipo TEXT, monto NUMERIC, moneda TEXT,
  autos TEXT, juzgado TEXT, fecha_inscripcion DATE, estado TEXT (VIGENTE, CANCELADO),
  certificado_id FK → certificados
  ```
- [x] UI: Sección "Estudio de Dominio" en FolderWorkspace con lista de gravámenes y semáforo
- [x] Cruce automático: si hay inhibición sobre alguna de las partes → alerta bloqueante

**Criterio de aceptación**: El escribano sube un certificado de dominio, ve los gravámenes extraídos, y recibe alertas si hay impedimentos para escriturar. ✅ COMPLETADO

---

### Hito 1.3: Ficha Completa del Comprador / Requirente
**Prioridad**: ALTA | **Dependencias**: ninguna

Ampliar los datos del cliente para cubrir todo lo que necesita la escritura.

- [x] Agregar campos faltantes a tabla `personas`:
  - `profesion TEXT`, `nro_documento_conyugal TEXT`, `regimen_patrimonial TEXT` (separación de bienes / comunidad)
  - `email TEXT`, `telefono TEXT`
- [x] Mejorar ficha pública (`/ficha/[token]`): formulario completo para que el cliente llene sus datos antes de la escritura
- [x] UI: tarjeta de persona expandida en FolderWorkspace con todos los campos

**Criterio de aceptación**: La ficha del cliente tiene todos los campos que aparecen en una escritura estándar. El cliente puede completar sus datos via link público. ✅ COMPLETADO

---

### Hito 1.4: Determinación Automática del Acto
**Prioridad**: MEDIA | **Dependencias**: Taxonomía CESBA (ya existe)

Mejorar la asignación del código CESBA para que sea más precisa.

- [ ] Subcódigos automáticos: detectar vivienda única (`-51`), plan social (`-24`), operaciones entre familiares
- [ ] UI: selector de código con búsqueda y descripción, permitir override manual
- [ ] Validación: si el monto es $0 en compraventa → advertencia

**Criterio de aceptación**: El código CESBA se asigna correctamente en el 90%+ de los casos, con opción de corrección manual.

---

### Hito 1.5: Liquidación Impositiva Completa
**Prioridad**: ALTA | **Dependencias**: Hito 1.4

Calcular todos los impuestos y tasas que el escribano debe liquidar.

- [ ] Implementar cálculo completo:
  - **Tasa ARBA** (Impuesto de Sellos): % sobre mayor valor entre precio y valuación fiscal
  - **Tasa RPI** (inscripción): según tipo de acto
  - **Tasa de Justicia**: si aplica
  - **Arancel notarial**: según monto y tabla CANN (Colegio de Escribanos)
  - **Ganancias Global (AFIP)**: Retención 3% para empresas/habitualistas (L. 27.743)
  - **Ganancias Cedular**: Nota informativa 15% (no retención notarial)
  - **Arancel notarial**: según monto y tabla CANN (Colegio de Escribanos)
- [x] Tabla de aranceles CANN (necesitamos datos actualizados 2026)
- [x] UI: `TaxBreakdownCard` expandido con desglose completo por concepto (Actualizado: Ganancias Global)
- [x] Exportar liquidación a PDF/DOCX para entregar al cliente

**Criterio de aceptación**: El escribano ve un desglose completo de impuestos con totales, puede exportarlo, y los montos coinciden con la liquidación manual.

---

### Hito 1.6: Compliance UIF/AML Básico
**Prioridad**: MEDIA | **Dependencias**: Hito 1.3

Verificaciones obligatorias de Lavado de Activos.

- [ ] Implementar skill `notary-uif-compliance`:
  - Verificar si monto > umbral UIF (actualmente ~$7.245.000 para inmuebles)
  - Marcar PEP (Persona Expuesta Políticamente) — por ahora flag manual, luego API
  - Checklist UIF: declaración jurada de fondos, origen de fondos documentado
- [ ] UI: semáforo compliance en carpeta (verde/amarillo/rojo)
- [ ] Checklist de documentación UIF requerida según monto y tipo de operación

**Criterio de aceptación**: La carpeta muestra el estado de compliance UIF con checklist de documentos requeridos.

---

### MILESTONE ETAPA 1 COMPLETA
> El escribano puede: abrir carpeta → ver certificados con semáforo → revisar estudio de dominio → tener datos completos de las partes → ver liquidación impositiva → verificar compliance UIF.
> **Todo antes de empezar a redactar la escritura.**

---

## ETAPA 2 — Redacción de Escritura y Firma

> **Objetivo**: EscriAR genera un borrador de escritura basado en los datos de la carpeta, el escribano lo revisa/edita, calcula sellos ARBA, y gestiona la firma.

### Hito 2.1: Biblioteca de Templates de Escritura
**Prioridad**: ALTA | **Dependencias**: Etapa 1 completa

- [ ] Crear templates DOCX/HTML para los actos más comunes:
  - Compraventa estándar
  - Compraventa con hipoteca simultánea
  - Donación
  - Cesión de derechos
  - Poder general / especial
  - Cancelación de hipoteca
  - Reglamento de PH
  - Fideicomiso
- [ ] Motor de templates con variables: `{{comprador.nombre}}`, `{{inmueble.nomenclatura}}`, `{{precio}}`, etc.
- [ ] Almacenar templates en tabla BD o filesystem (configurable por escribanía)

**Criterio de aceptación**: Existen al menos 5 templates funcionales que se auto-completan con datos de la carpeta.

---

### Hito 2.2: Generador de Escritura (Deed Drafter mejorado)
**Prioridad**: ALTA | **Dependencias**: Hito 2.1

- [ ] Mejorar `deedDrafter` para usar templates + datos de carpeta
- [ ] `SmartDeedEditor`: editor WYSIWYG con sugerencias AI en tiempo real
- [ ] Validaciones legales automáticas:
  - Art. 470 CCyC (asentimiento conyugal)
  - Verificar que todas las partes tengan DNI/CUIT
  - Verificar que el inmueble coincida con el certificado de dominio
- [ ] Exportar a DOCX para impresión

**Criterio de aceptación**: El escribano genera un borrador completo de escritura desde la carpeta, lo edita, y lo exporta.

---

### Hito 2.3: Liquidación de Sellos ARBA
**Prioridad**: ALTA | **Dependencias**: Hito 1.5

- [ ] Cálculo preciso de Impuesto de Sellos según tabla ARBA vigente
- [ ] Soporte para exenciones (vivienda única, plan social, operaciones entre familiares)
- [ ] Generación de formulario/boleta para presentar en ARBA
- [ ] (Futuro) Integración directa con sistema ARBA online

**Criterio de aceptación**: El monto de sellos calculado coincide con el que calcula ARBA manualmente.

---

### Hito 2.4: Workflow de Firma
**Prioridad**: MEDIA | **Dependencias**: Hito 2.2

- [ ] Estado de carpeta: BORRADOR → PARA FIRMA → FIRMADA → PROTOCOLIZADA
- [ ] Checklist pre-firma: ¿certificados vigentes? ¿sellos pagos? ¿documentación UIF completa?
- [ ] Agenda de firma: fecha, hora, lugar (integración con `/agenda`)
- [ ] Notificación a las partes (futuro: via Resend email)

**Criterio de aceptación**: El escribano tiene un flujo claro desde borrador hasta firma con checklist de requisitos.

---

### MILESTONE ETAPA 2 COMPLETA
> El escribano puede: seleccionar template → generar borrador → editar → calcular sellos → coordinar firma.
> **La escritura está firmada y lista para protocolizar.**

---

## ETAPA 3 — Post-Firma: Testimonio, Inscripción y Protocolo

> **Objetivo**: Después de la firma, EscriAR genera el testimonio, la minuta rogatoria para el RPI, y mantiene el índice protocolar del año.

### Hito 3.1: Generador de Testimonio
**Prioridad**: ALTA | **Dependencias**: Etapa 2 completa

- [ ] Generar testimonio (copia autenticada) a partir de la escritura firmada
- [ ] Formato: encabezado del registro + texto de escritura + fórmula de cierre
- [ ] Exportar a DOCX/PDF
- [ ] Trackear cuántos testimonios se emitieron (primero, segundo, ulteriores)

**Criterio de aceptación**: El escribano genera un testimonio completo con formato legal correcto.

---

### Hito 3.2: Minuta Rogatoria Completa
**Prioridad**: ALTA | **Dependencias**: Hito 3.1

Mejorar el `MinutaGenerator` existente:

- [ ] Mapeo completo a códigos RPI (ya existe parcialmente en `notary-registration-exporter`)
- [ ] Secciones completas: Encabezado, Datos del Inmueble, Datos de la Operación, Titulares Origen, Titulares Destino
- [ ] Soporte multi-inmueble (una escritura puede afectar varios inmuebles)
- [ ] Validación: todos los campos requeridos por RPI están presentes
- [ ] Exportar DOCX con formato RPI oficial
- [ ] (Futuro) Exportar XML para presentación digital al RPI

**Criterio de aceptación**: La minuta generada tiene todos los campos que el RPI requiere y se puede presentar sin correcciones.

---

### Hito 3.3: Índice Protocolar
**Prioridad**: MEDIA | **Dependencias**: Etapa 2 completa

El escribano debe llevar un índice anual de todas las escrituras.

- [ ] Crear tabla `protocolo_indice`:
  ```
  id UUID PK, anio INT, nro_escritura INT, fecha DATE,
  tipo_acto TEXT, codigo_cesba TEXT, otorgantes TEXT,
  folio_inicio INT, folio_fin INT, registro TEXT
  ```
- [ ] UI: Vista de índice protocolar con filtros por año, tipo de acto
- [ ] Exportar índice completo a XLSX/PDF (formato requerido por el Colegio)
- [ ] Auto-numeración de folios consecutivos

**Criterio de aceptación**: El índice protocolar se genera automáticamente con todas las escrituras del año en formato exportable.

---

### Hito 3.4: Tracker de Inscripción RPI
**Prioridad**: MEDIA | **Dependencias**: Hito 3.2

- [ ] Mejorar `InscriptionTracker` existente:
  - Estado: PENDIENTE → PRESENTADA → OBSERVADA → INSCRIPTA
  - Fecha de presentación, número de entrada RPI
  - Observaciones del RPI y resolución
- [ ] UI: timeline de inscripción por carpeta
- [ ] Vista global: todas las inscripciones pendientes/observadas

**Criterio de aceptación**: El escribano puede trackear el estado de inscripción de cada escritura ante el RPI.

---

### MILESTONE ETAPA 3 COMPLETA
> El escribano puede: generar testimonio → crear minuta rogatoria → presentar al RPI → trackear inscripción → mantener índice protocolar.
> **El ciclo completo de la escritura está cubierto.**

---

## Mejoras Transversales (sin etapa fija)

Estas mejoras se pueden implementar en cualquier momento cuando aporten valor:

| Mejora | Descripción | Prioridad |
|--------|-------------|-----------|
| **num2words español** | Convertir montos a letras: "$1.500.000" → "PESOS UN MILLON QUINIENTOS MIL" | ALTA (necesario para escrituras) |
| **Resend emails** | Notificaciones por email a clientes (recordatorios, fichas) | MEDIA |
| **API PEP/RePET** | Consulta automática de Personas Expuestas Políticamente | MEDIA |
| **OCR DNI** | Extraer datos de foto de DNI con Vision AI | BAJA |
| **Multi-tenancy** | Soporte para múltiples escribanías | BAJA |
| **Audit log** | Trazabilidad completa de cambios (quién/cuándo/qué) | MEDIA |
| **Tests** | Suite de tests unitarios e integración | MEDIA |

---

## Datos y Recursos Necesarios

Para avanzar en las etapas necesitamos:

| Recurso | Para qué | Estado |
|---------|----------|--------|
| Tabla aranceles CANN 2026 | Hito 1.5 (arancel notarial) | FALTA |
| Tabla tasas RPI 2026 | Hito 1.5 (tasa inscripción) | FALTA |
| Tabla sellos ARBA 2026 | Hito 2.3 (impuesto de sellos) | PARCIAL (en taxonomía) |
| Templates de escritura modelo | Hito 2.1 (biblioteca templates) | FALTA |
| Formato minuta RPI oficial | Hito 3.2 (minuta rogatoria) | PARCIAL |
| Formato índice protocolar Colegio | Hito 3.3 (índice anual) | FALTA |
| Umbrales UIF vigentes 2026 | Hito 1.6 (compliance) | FALTA |

---

## Orden de Ejecución Sugerido

```
1.3 Ficha Comprador  ─┐
1.1 Certificados      ─┤── pueden ir en paralelo
1.4 Determinación Acto ─┘
         │
1.2 Lector RPI (necesita 1.1)
         │
1.5 Liquidación Impositiva (necesita 1.4)
         │
1.6 Compliance UIF (necesita 1.3)
         │
    ══ MILESTONE ETAPA 1 ══
         │
2.1 Templates ─────────┐
2.3 Sellos ARBA ────────┤── pueden ir en paralelo
         │              │
2.2 Generador Escritura (necesita 2.1)
         │
2.4 Workflow Firma (necesita 2.2 + 2.3)
         │
    ══ MILESTONE ETAPA 2 ══
         │
3.1 Testimonio ─────────┐
3.3 Índice Protocolar ──┤── pueden ir en paralelo
         │               │
3.2 Minuta Rogatoria (necesita 3.1)
         │
3.4 Tracker RPI (necesita 3.2)
         │
    ══ MILESTONE ETAPA 3 ══
```

---

> **Última actualización**: 2026-03-12 — Antigravity (Reorganización de Sidebar / Nombres de Actos)
