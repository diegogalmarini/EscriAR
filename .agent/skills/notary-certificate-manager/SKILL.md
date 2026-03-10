---
name: notary-certificate-manager
description: Gestiona el ciclo de vida y vigencia de los certificados registrales (Dominio, Inhibición) según la Ley 17.801. Calcula fechas exactas de vencimiento (el "Semáforo") basándose en la jurisdicción del escribano y la fecha de expedición, determinando si una escritura tiene "Reserva de Prioridad" válida.
license: Proprietary
---

# Notary Certificate Manager

## Overview

Esta habilidad implementa la lógica del **Módulo C (El Semáforo)** descrita en el Roadmap de EscriAR. A diferencia del validador (que solo dice si está vencido hoy), esta habilidad **proyecta** fechas y gestiona los plazos legales de la "Reserva de Prioridad" registral.

Es fundamental para evitar que una escritura se firme con certificados vencidos, lo cual podría resultar en la pérdida de la protección registral frente a embargos posteriores.

## Workflow Logic

### 1. Determinación del Plazo Legal (Ley 17.801 Art. 24)
El sistema debe calcular la vigencia del certificado basándose en la ubicación del Registro vs. la ubicación del Escribano:
* **15 días:** Si el Escribano y el Registro están en la misma ciudad.
* **25 días:** Si están en distintas ciudades pero dentro de la misma provincia (Caso típico Bahía Blanca -> RPI La Plata).
* **30 días:** Si están en distintas provincias (Extraña Jurisdicción).

### 2. Cálculo de Fechas Críticas
* **Fecha de Expedición (Día 0):** Fecha desde la cual corre el plazo (habitualmente 00:00hs de la fecha de ingreso/expedición).
* **Fecha de Vencimiento:** `Fecha Expedición + Plazo Legal` (Días corridos, aunque se extiende si cae inhábil, esta skill usa la fecha nominal para seguridad).
* **Semáforo:**
    * 🟢 **VERDE:** > 10 días restantes.
    * 🟡 **AMARILLO:** <= 10 días restantes (Alerta de priorización).
    * 🔴 **ROJO:** Vencido (Bloqueo de firma).

### 3. Lógica de Actualización (Update Check)
Si se detecta un certificado vencido, esta habilidad debe sugerir la acción: "Solicitar ampliación" o "Solicitar nuevo certificado", conservando el número de entrada del anterior si es necesario para relacionar tracto abreviado.

## Implementation Script (Python)

Este script encapsula la lógica de tiempos de la Ley Registral Nacional y normativas bonaerenses.

```python
from datetime import datetime, timedelta

def calculate_certificate_status(cert_type, issue_date_str, jurisdiction_scope="PROVINCIAL_INTERIOR"):
    """
    Calcula la vigencia de un certificado registral.
    
    Args:
        cert_type (str): 'DOMINIO', 'INHIBICION', 'CATASTRO'.
        issue_date_str (str): Fecha en formato 'YYYY-MM-DD'.
        jurisdiction_scope (str): 
            'LOCAL' (15 días), 
            'PROVINCIAL_INTERIOR' (25 días - Default Bahía/PBA), 
            'EXTRA_JURISDICCION' (30 días).
    """
    
    try:
        issue_date = datetime.strptime(issue_date_str, "%Y-%m-%d")
    except ValueError:
        return {"error": "Invalid date format. Use YYYY-MM-DD"}

    # 1. Definir Plazo según Ley 17.801
    legal_days = 0
    
    if cert_type in ['DOMINIO', 'INHIBICION']:
        if jurisdiction_scope == 'LOCAL':
            legal_days = 15
        elif jurisdiction_scope == 'PROVINCIAL_INTERIOR':
            legal_days = 25  # Caso más común para Escribanía en Bahía Blanca con RPI en La Plata
        elif jurisdiction_scope == 'EXTRA_JURISDICCION':
            legal_days = 30
    elif cert_type == 'CATASTRO':
        legal_days = 30 # Catastro suele tener vigencia distinta, aproximamos norma general o ARBA
    else:
        legal_days = 30 # Default preventivo

    # 2. Calcular Vencimiento
    expiration_date = issue_date + timedelta(days=legal_days)
    today = datetime.now()
    
    # Días restantes (pueden ser negativos si venció)
    days_remaining = (expiration_date - today).days

    # 3. Determinar Semáforo
    status = ""
    color = ""
    action = ""

    if days_remaining < 0:
        status = "VENCIDO"
        color = "RED"
        action = "CRÍTICO: Solicitar nuevo certificado inmediatamente. No firmar."
    elif days_remaining <= 5:
        status = "POR_VENCER_CRITICO"
        color = "RED"
        action = "URGENTE: Firmar antes del vencimiento o pedir ampliación."
    elif days_remaining <= 10:
        status = "ADVERTENCIA"
        color = "YELLOW"
        action = "Planificar firma. Monitorear."
    else:
        status = "VIGENTE"
        color = "GREEN"
        action = "Documento válido."

    return {
        "certificate_type": cert_type,
        "issue_date": issue_date.strftime("%d/%m/%Y"),
        "expiration_date": expiration_date.strftime("%d/%m/%Y"),
        "legal_term_days": legal_days,
        "days_remaining": days_remaining,
        "traffic_light": color,
        "status_code": status,
        "recommended_action": action
    }

# --- CASOS DE PRUEBA (Escenarios Escribanía Galmarini) ---

# Caso 1: Certificado recién pedido (Bahía Blanca -> La Plata)
print(f"--- TEST 1: Certificado Nuevo ---")
print(calculate_certificate_status(
    cert_type="DOMINIO", 
    issue_date_str=datetime.now().strftime("%Y-%m-%d"), 
    jurisdiction_scope="PROVINCIAL_INTERIOR"
))

# Caso 2: Certificado de hace 20 días (Peligro)
past_date = (datetime.now() - timedelta(days=20)).strftime("%Y-%m-%d")
print(f"\n--- TEST 2: Certificado al límite (20 días antig) ---")
print(calculate_certificate_status(
    cert_type="INHIBICION", 
    issue_date_str=past_date, 
    jurisdiction_scope="PROVINCIAL_INTERIOR"
))

# Caso 3: Certificado Vencido
old_date = "2023-01-01"
print(f"\n--- TEST 3: Certificado Viejo ---")
print(calculate_certificate_status(
    cert_type="DOMINIO", 
    issue_date_str=old_date, 
    jurisdiction_scope="PROVINCIAL_INTERIOR"
))