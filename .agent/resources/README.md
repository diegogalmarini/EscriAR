# Manual del Ecosistema de Modelos Notariales (SOP para Agentes)

Este documento es el Manual de Operaciones Estandarizado (SOP) para cualquier agente de IA (como `notary-deed-drafter`, u otros) encargado de procesar, leer e inyectar datos en Modelos de Actos Notariales dentro del ecosistema NotiAr.

Toda la lógica de recolección de datos y generación de documentos finales DEBE basarse siempre en la lectura previa del modelo correspondiente ubicado en el directorio `/modelos_actos/`. 

Existen dos estrategias principales de plantillas dependiendo del formato de la misma: **Plantillas en Texto Plano (.md, .txt)** y **Plantillas de Formato Estricto (.docx)**.

---

## 1. Plantillas de Formato Estricto (DOCX)
**Objetivo:** Preservar al 100% el diseño original del escribano (márgenes, tipografías exactas, justificaciones, saltos de página e interlineados).

### Reglas para el Usuario (Creador de la Plantilla)
Para crear una plantilla DOCX válida para el sistema:
1. Toma el documento de Word original finalizado de un acto anterior.
2. Reemplaza todos los datos que formarán parte de la próxima escritura por **etiquetas Jinja2 (doble llave)**.
   - *Directrices:* `{{numero_escritura}}`, `{{vendedores[0].nombre}}`, `{{precio_letras}}`.
3. Para bloques de texto opcionales, usa lógicas condicionales Jinja2:
   - `{% if moneda == 'USD' %} Entrega billetes estadounidenses... {% endif %}`
4. Para iteraciones (listas de compradores, linderos), usa bucles Jinja2:
   - `{% for comp en compradores %}{{comp.nombre}} (DNI {{comp.dni}}) {% endfor %}`
5. Guarda el archivo `.docx` en la carpeta `modelos_actos/`.

### Reglas de Ejecución para el Agente (Procesamiento)
Cuando se te asigne redactar un acto y la plantilla base encontrada en `modelos_actos/` tenga extensión `.docx`, debes actuar EXACTAMENTE bajo este flujo:

1. **PROHIBIDO CONVERTIR A MARKDOWN/TEXTO:** **NUNCA** intentes abrir el archivo `.docx` para analizarlo visualmente (usando `cat`, convirtiéndolo a texto, etc) ni generes la respuesta en Markdown a menos que el usuario lo pida explícitamente como borrador visual. Romper el archivo DOCX original destruirá su formato.
2. **Generación del Contexto de Datos (Payload):**
   * Prepara un diccionario estructurado (JSON) exhaustivo con todas las variables deducidas de los documentos originales de la operación o provistas por el usuario.
   * Debes realizar las conversiones previas necesarias (ej. ejecutar la conversión de fechas numéricas a fechas en letras, montos a letras largas con el formato exigido notarialmente).
3. **Invocación del Generador DOCX:**
   * Utiliza el script utilitario oficial provisto en el sistema: `notary_docx_builder.py`.
   * Pásale la ruta de la plantilla original `.docx`, la ruta destino (ej. `.agent/output/PODER_COMPLETADO.docx`), y el string JSON con toda la data.
   * *Ejemplo de llamada:* `python .agent/resources/notary_docx_builder.py "modelos_actos/poder.docx" "output/resultado.docx" '{"poderdante": "Juan", ...}'`
4. **Respuesta al Usuario:** Confirma que el documento final ha sido generado y brinda la ruta exacta.

---

## 2. Plantillas de Texto Plano (Markdown `.md` o Texto `.txt`)
**Objetivo:** Redacciones base donde el formato rígido no es crítico, o cuando el documento se exportará posteriormente mediante APIs externas u otros servicios que no requieren un diseño visual incrustado en el archivo.

### Reglas para el Usuario (Creador de la Plantilla)
1. Escribe el cuerpo de la escritura en formato de texto.
2. Usa **corchetes simples** para identificar datos inyectables: `[NOMBRE_CLIENTE]`, `[FECHA_LETRAS]`.
3. Para insertar lógica condicional, marca el párrafo explícitamente: 
   - `CONDICIONAL [Si_Asentimiento]: Acá va el inciso de asentimiento 470 CCYC...`

### Reglas de Ejecución para el Agente (Procesamiento)
Cuando la plantilla encontrada sea `.md` o `.txt`, debes actuar de esta manera:

1. **Lectura y Parsing Semántico:** Usa la herramienta `view_file` para leer completo el archivo `.md`.
2. **Reemplazo e Inyección:** Como agente, procesa el texto en tu "mente". Reemplaza los `[VALORES_DENTRO_DE_CORCHETES]` con los datos reales del cliente.
3. **Resolución de Condicionales:** Analiza todos los bloques marcados como `CONDICIONAL [...]`. Si la condición según las Reglas de Negocio se cumple, elimina el tag "CONDICIONAL [...]" y deja el párrafo limpio en el documento final. Si la condición no se cumple (ej. es soltero así que no hay asentimiento conyugal), elimina el párrafo entero.
4. **Generación de Salida:** Puedes imprimir el texto resultante directamente en el chat, o usar la herramienta `write_to_file` para crear un archivo nuevo en disco (ej. `BORRADOR_COMPRAVENTA_GARCIA.md`).

---

## Consideraciones Adicionales para el Agente
- **Autonomía:** Siempre debes asumir que la plantilla de la carpeta `modelos_actos` es **la fuente única de verdad** para la estructura de la escritura. No asumas ni impongas estructuras legales alternativas que hayas aprendido externamente si contradicen a la plantilla.
- **Variables Críticas Obligatorias:** Independientemente de la plantilla, como mínimo siempre debes extraer: Nombres completos, tipos y números de documentos, nacionalidad, estado civil y domicilio (según exigencia Ley 17.801 y CCyC). Si faltan, debes consultarlos al usuario antes de redactar.
