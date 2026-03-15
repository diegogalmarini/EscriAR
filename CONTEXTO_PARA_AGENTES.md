# EscriAR: Arquitectura, Dominio y Propósito (Contexto para Agentes de IA)

> **NOTA PARA AGENTES DE IA:** Lee este documento antes de proponer cambios arquitectónicos, escribir lógica de negocios, o interactuar con la Base de Datos. Contiene las reglas del dominio y el motivo de existencia del proyecto.

## 1. Visión General del Proyecto
**EscriAR** es un ecosistema de software (SaaS + Herramientas de Autoría) diseñado para resolver la gestión operativa, redacción documental y cálculo arancelario de las escribanías (notarías) en la Provincia de Buenos Aires (PBA), Argentina. 

El sistema no es un simple "procesador de textos de Word web", sino un **motor de inyección de datos tipados en plantillas legales estandarizadas**, acoplado a un motor de cálculo de impuestos y honorarios notariales basado en la taxonomía oficial de la CESBA (Caja de Seguridad Social para Escribanos de la PBA).

## 2. El Problema: El "Dolor" de las Escribanías
El flujo de trabajo tradicional en una escribanía es altamente ineficiente y riesgoso:
1. **Redacción por "Frankenstein" (Copy-Paste):** Los escribanos redactan nuevos documentos copiando y pegando documentos viejos de Word. Esto genera errores catastróficos (nombres que quedaron del documento anterior, DNIs erróneos, fechas mal puestas). Un error en una escritura puede generar un rechazo en el Registro de la Propiedad o la nulidad del acto.
2. **Carga duplicada de datos:** Los datos de una persona (ej. Juan Pérez, DNI X, CUIT Y, estado civil, cónyuge, domicilio) se tipean múltiples veces: en el presupuesto, en la escritura, en los formularios de impuestos, en los anexos.
3. **Complejidad Arancelaria y Tributaria:** La escribanía actúa como agente de retención del Estado. Cada acto notarial (compraventa, poder, acta de constatación, donación) tiene un código taxativo de la CESBA. Ese código define si el acto paga Impuesto de Sellos (ej. 1.2%, 2%), si está exento (0%), cuáles son los honorarios mínimos y cuáles los aportes de terceros. Calcular esto a mano es propenso a errores y requiere buscar en tablas PDF constantemente.
4. **Desactualización normativa:** Los valores y alícuotas cambian anualmente. Si el sistema no está parametrizado centralmente, el escribano liquida mal los impuestos.

## 3. La Solución: Las Virtudes de EscriAR
El SaaS de EscriAR resuelve esto **separando la lógica del "Dato Documental" de la "Redacción del Texto"**. Lo resolvemos a través de dos piezas de software que dialogan entre sí.

### Virtud 1: Carga Única y Fuente de Verdad (Single Source of Truth)
En lugar de escribir en un Word, el usuario crea una **"Carpeta"** (un expediente) en el SaaS. 
Dentro de la carpeta, el usuario carga entidades relacionales fuertemente tipadas:
*   **Comparecientes:** Personas físicas o jurídicas completas (Nombre, DNI, CUIT, Domicilio, UIF, PEP, etc.).
*   **Inmuebles / Objetos:** Datos catastrales, nomenclatura, valuaciones fiscales.
*   **Actos:** Qué se va a hacer (ej. "Acta de Comprobación", "Poder Especial", "Compraventa").

### Virtud 2: Motor de Inyección de Plantillas determinístico
Una vez cargados los datos, el sistema toma la "Plantilla" (Modelo de Acto) y reemplaza automáticamente los tokens (variables) con los datos de las entidades de la Carpeta. Se generan los documentos finales listos para imprimir y firmar. Cero copy-paste = Cero riesgo de heredar nombres de otro cliente.

### Virtud 3: Taxonomía CESBA Embebida
La plataforma incorpora un nomenclador completo (JSON) con los más de 800 actos notariales de la Provincia de Buenos Aires (ej. `100-00` Compraventa, `800-32` Actas no gravadas). Al elegir un acto, el sistema ya sabe la alícuota de sellos, el honorario y el aporte aplicable, facilitando la creación del **Presupuesto pre-carpeta** sin hacer cálculos manuales.

---

## 4. Arquitectura y Stack Tecnológico (El "Cómo")

Para preservar la flexibilidad de los escribanos pero garantizar la estructuración de datos, el proyecto se divide en dos aplicaciones:

### A) EscriAR Template Builder (App Local / Herramienta de Autoría)
*   **Tecnología:** Python 3.13 + Streamlit.
*   **Propósito:** Herramienta para construir "Modelos de Actos". Lee un `.docx` con variables (ej. `{{COMPARECIENTE_1_NOMBRE}}`), las extrae, las valida, asocia el modelo a un Código CESBA, y empaqueta todo en un `.zip` (que contiene el `.docx` modificado y `metadata.json`).
*   **Output:** Genera los archivos ZIP que nutren al SaaS.

### B) EscriAR SaaS (Plataforma Core en la Nube)
*   **Frontend/Backend:** Next.js (App Router, React 19) alojado en Vercel.
*   **Base de Datos y Auth:** Supabase (PostgreSQL, Storage para guardar los Word, y Authentication).
*   **Procesamiento asíncrono:** Worker en Node / Python hosteado en Railway para tareas pesadas de IA y generación documental.
*   **Propósito:** ERP / CRM diario de la Escribanía. Aquí se crean las carpetas, se cruzan datos con los Modelos, se calculan presupuestos y se emiten PDFs/Word finales limpios.

---

## 5. Complejidades Técnicas y Reglas Inquebrantables (Para los Agentes de IA)

1. **La Taxonomía es Ley:** Los códigos de la CESBA **no** deben hardcodearse aleatoriamente. Asignar un código erróneo a un acto (ej. mezclar un acto de 1.2% de sellos con uno Exento 0%) o no usar los códigos oficiales (ej. `800-32`, `100-00`) vuelve inútil el SaaS, ya que el escribano pagaría mal los impuestos.
2. **Estructura Dinámica vs Fija:** En Supabase, la tabla `modelos_actos` tiene un campo `metadata` (JSONB) que define qué variables requiere ese modelo. Del otro lado, la tabla `carpetas` tiene los datos relacionales cargados. El puente consiste en "mapear" los datos de Supabase hacia los tokens dinámicos del documento Word.
3. **Flujo Causal:** Todo nace de un **Presupuesto**. El Presupuesto define los actos y los costos (aranceles). Luego los actos se instancian en la **Carpeta**, se asocian personas a "roles" (Comprador, Vendedor) y finalmente se inyecta la plantilla.
4. **Respetar RLS e Identidad:** La DB de Supabase usa **Row Level Security (RLS)** estricto atado al sistema de Autenticación y esquema Tenant (por Escribanía). Nunca omitir el paso del `auth.users()` o bypass del RLS al diseñar queries o mutations en el backend.
5. **No inventes soluciones UI complejas innecesariamente:** La experiencia de usuario debe priorizar minimizar los clicks y el movimiento del mouse. El usuario "tipea mucho" (data-entry pesado).
