# Diario de Proyecto - NotiAR

Este documento registra los hitos alcanzados y las funcionalidades que han sido validadas y se consideran **ESTABLES**. El objetivo es preservar esta lógica mientras se avanza en nuevas capacidades.

## Hitos Alcanzados (Enero 2026)

### 1. Extracción de Inmuebles (Literal) ✅
- **Estado:** Estable / No tocar.
- **Logro:** El sistema extrae la transcripción técnica completa de los inmuebles sin recortes (medidas, linderos y superficies íntegros).
- **Componente:** `notary-property-extractor`.

### 2. Gestión Integral de Clientes ✅
- **Estado:** Estable / No tocar.
- **Logro:** Extracción completa de datos personales y biográficos. Fuente única de verdad (la edición en carpeta actualiza la ficha global).
- **Control:** Prevención de duplicados por DNI/Upsert.

### 3. Diferenciación de Personas Jurídicas ✅
- **Estado:** Estable / No tocar.
- **Logro:** Identificación automática de bancos/empresas por CUIT. UI adaptada (etiquetas "Const:", ocultamiento de DNI).

### 4. Estandarización de Apellidos ✅
- **Estado:** Estable / No tocar.
- **Logro:** Apellidos siempre en MAYÚSCULAS (incluyendo cónyuges). Soporte para apellidos compuestos.

### 5. Especialización en Fideicomisos y Cesiones ✅
- **Estado:** Estable / No tocar.
- **Logro:** Extracción de roles complejos (Cedente, Cesionario, Fiduciaria) y doble precio (ARS histórico / USD mercado).
- **Componente:** `normalizeAIData` + Sanitizador Semántico.

### 6. Hipotecas UVA y Créditos Bancarios ✅
- **Estado:** Estable / No tocar.
- **Logro:** Extracción de condiciones financieras BNA (TNA, UVA, Plazo). Priorización de roles Acreedor/Deudor.
- **Componente:** `notary-mortgage-reader`.

### 7. Motor de Inteligencia RAG (La Biblia) ✅
- **Estado:** Estable / No tocar.
- **Logro:** Conexión del cerebro AI con base de conocimiento legal dinámica. Búsqueda semántica para inyectar expertiz en tiempo real.
- **Componente:** `SkillExecutor` + `RAG (Supabase Vector)`.
- **Chunking RAG:** `knowledge.ts` → 1000 chars con 200 overlap para embeddings.

### 8. Mega-Document Chunking (49+ páginas) ✅
- **Estado:** Estable / En observación.
- **Logro:** Procesamiento de escrituras muy largas (hipotecas UVA BNA, condominios complejos). División por secciones legales (PARTE I/II/III, CLAUSULAS).
- **Componente:** `SkillExecutor.chunkMegaDocument()` + `mergeExtractionResults()`.
- **Chunking Extracción:** 20.000 chars por chunk, merge con deduplicación por DNI/CUIT.
- **Trigger:** Documentos > 25.000 caracteres (~18 páginas).

---

## Hitos Alcanzados (Febrero 2026)

### 9. Fix: Actualización de Contacto de Clientes ✅
- **Fecha:** 2026-02-09
- **Problema:** Error "Cannot coerce the result to a single JSON object" al editar clientes sin DNI.
- **Solución:** `updatePersona` ahora busca por UUID (id), DNI o CUIT según corresponda.
- **Componente:** `src/app/actions/personas.ts`

### 10. Nuevo Cliente: Modo Dual (Rápido + Completo) ✅
- **Fecha:** 2026-02-09
- **Logro:** `NuevoClienteDialog` con dos modos:
  - **Rápido + Link:** Solo nombre + teléfono/email → genera link automático para que el cliente complete.
  - **Formulario Completo:** Carga manual de todos los datos.
- **UX:** Toggle en la UI para cambiar entre modos.
- **Componente:** `src/components/NuevoClienteDialog.tsx`

### 11. Ficha Pública: Campo Cónyuge Dinámico ✅
- **Fecha:** 2026-02-09
- **Logro:** Cuando el cliente escribe "Casado/a" en estado civil, aparece automáticamente el campo "Nombre del Cónyuge" (obligatorio).
- **Componente:** `src/app/ficha/[token]/FichaForm.tsx`, `src/app/actions/fichas.ts`

### 12. Formatos de Archivo Soportados ✅
- **Fecha:** 2026-02-09
- **Cambio:** Removido soporte para `.doc` (formato antiguo). Solo se aceptan **PDF** y **DOCX**.
- **Componente:** `src/components/MagicDropzone.tsx`

---

## Próximos Desafíos
- [ ] Identificación de nuevos modelos de documentos.
- [ ] Lectura de documentos no identificados.
- [ ] Validaciones legales automáticas (Art. 470 CCyC).

> **Aviso:** No modificar la lógica de normalización ni extracción de inmuebles sin revisión previa, dado el alto nivel de satisfacción actual.
