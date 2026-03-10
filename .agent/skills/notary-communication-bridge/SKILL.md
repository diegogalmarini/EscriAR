---
name: notary-communication-bridge
description: Motor de generación de comunicaciones transaccionales contextuales. Redacta mensajes automáticos y personalizados (Correo Electrónico/WhatsApp) dirigidos al cliente, basándose en el estado del flujo de trabajo notarial (ej. Presupuesto listo, Certificados vencidos, Recordatorio de firma), utilizando un tono profesional adaptable.
license: Proprietary
---

# Notary Communication Bridge

## Overview

La experiencia del cliente (CX) en una escribanía suele ser fragmentada y manual. Esta habilidad actúa como el "Concierge Digital" de EscriAR. Su función es traducir eventos técnicos del sistema (ej. `status_certificados = 'APPROVED'`) en comunicaciones humanas claras y empáticas.

Reduce la carga operativa del equipo administrativo al generar borradores listos para enviar para situaciones repetitivas, asegurando que el cliente siempre esté informado del avance de su carpeta.

## Workflow Logic

### 1. Detección de Eventos (Event Listeners)
El sistema monitorea cambios de estado en la Carpeta Digital para disparar comunicaciones:
* **Evento A (Solicitud):** `notary-legal-validator` detecta falta de documentación (ej. falta boleta ABL). -> *Dispara: Solicitud de Documentación.*
* **Evento B (Hito):** `notary-timeline-planner` confirma fecha de firma. -> *Dispara: Agendamiento y Logística.*
* **Evento C (Post-Firma):** `notary-registration-exporter` confirma ingreso al registro. -> *Dispara: Informe de Ingreso.*

### 2. Selección de Canal y Tono (Channel Strategy)
* **Canal:**
    * **WhatsApp:** Para recordatorios rápidos, solicitudes de fotos de DNI, confirmaciones de hora.
    * **Email:** Para envío de presupuestos, borradores de escritura y facturas.
* **Tono:**
    * **Corporativo:** Si `cliente_tipo == 'BANCO'` o `JURIDICA`.
    * **Cercano:** Si `cliente_tipo == 'PARTICULAR'`.

### 3. Inyección de Variables (Template Rendering)
Utiliza motores de plantillas para personalizar el mensaje. No basta con "Hola Cliente". Debe ser "Hola Juan, te escribo por la venta de la calle Alem".
* **Variables Clave:** Nombre Pila, Domicilio Operación, Fecha/Hora Firma, Monto a traer (en letras y números), Documentación física requerida.

## Implementation Script (Python)

Este script utiliza `jinja2` (estándar de industria) para renderizar mensajes dinámicos y seguros.

```python
from datetime import datetime
from jinja2 import Template

class CommunicationBridge:
    def __init__(self):
        # En producción, estas plantillas viven en la Base de Conocimiento o DB
        self.templates = {
            "REQUEST_MISSING_DOCS": {
                "whatsapp": "Hola {{ nombre }}, soy {{ escribano }} de la Escribanía. Para avanzar con la escritura de {{ calle }}, necesitamos que nos envíes foto de: {{ lista_faltantes }}. ¡Gracias!",
                "email": """Estimado/a {{ nombre }}:
                
Nos ponemos en contacto en referencia a la operación del inmueble sito en {{ calle }}.
Para continuar con el estudio de títulos, requerimos la siguiente documentación pendiente:

{% for doc in lista_faltantes %}
- {{ doc }}
{% endfor %}

Puede enviarla por este medio o por WhatsApp.
Saludos cordiales,
{{ escribano_firma }}"""
            },
            "REMINDER_SIGNING": {
                "whatsapp": "📅 Recordatorio: Mañana {{ hora }} firmamos la escritura en {{ direccion_escribania }}. Recordá traer DNI físico y el dinero de los gastos ($ {{ gastos }}).",
                "email": """Hola {{ nombre }},

Te recordamos los detalles para la firma de la escritura programada para mañana:

📅 Fecha: {{ fecha }}
🕒 Hora: {{ hora }}
📍 Lugar: {{ direccion_escribania }}

IMPORTANTE A TRAER:
1. DNI Original (El digital de MiArgentina NO es válido para firmar).
{% if estado_civil == 'CASADO' %}2. Libreta de Matrimonio (si aplica).{% endif %}
3. Gastos de Escrituración: $ {{ gastos }} (si no fueron transferidos).

Cualquier duda, estamos a disposición.
"""
            }
        }

    def generate_message(self, trigger_event, context_data):
        """
        Genera el cuerpo del mensaje basado en un evento y datos del contexto.
        """
        template_group = self.templates.get(trigger_event)
        if not template_group:
            return {"error": f"No existe plantilla para el evento: {trigger_event}"}

        # Selección de canal preferido (Lógica de negocio)
        preferred_channel = context_data.get("preferred_channel", "whatsapp")
        raw_template = template_group.get(preferred_channel, template_group["email"])

        # Renderizado
        try:
            jinja_template = Template(raw_template)
            message_body = jinja_template.render(**context_data)
            
            return {
                "channel": preferred_channel,
                "recipient": context_data.get("contact_info"),
                "subject": f"Escribanía Galmarini - {context_data.get('calle', 'Operación en curso')}" if preferred_channel == "email" else None,
                "body": message_body.strip(),
                "status": "DRAFT_READY"
            }
        except Exception as e:
            return {"error": f"Error renderizando plantilla: {str(e)}"}

# --- CASOS DE PRUEBA ---

bridge = CommunicationBridge()

# Caso 1: Faltan papeles (WhatsApp informal)
ctx_missing = {
    "nombre": "Norman",
    "escribano": "Alejandro",
    "calle": "Av. Alem 1200",
    "lista_faltantes": ["Boleta Municipal al día", "Constancia de CUIL"],
    "preferred_channel": "whatsapp",
    "contact_info": "+549291..."
}

print("--- Test 1: WhatsApp Docs Request ---")
print(bridge.generate_message("REQUEST_MISSING_DOCS", ctx_missing))

# Caso 2: Recordatorio de Firma (Email Formal)
ctx_signing = {
    "nombre": "Roberto Gómez",
    "fecha": "Jueves 24 de Octubre",
    "hora": "10:30 hs",
    "direccion_escribania": "Sarmiento 123, Bahía Blanca",
    "gastos": "1.500.000",
    "estado_civil": "CASADO",
    "preferred_channel": "email",
    "contact_info": "roberto@email.com",
    "escribano_firma": "Escribanía Galmarini"
}

print("\n--- Test 2: Email Signing Reminder ---")
print(bridge.generate_message("REMINDER_SIGNING", ctx_signing))