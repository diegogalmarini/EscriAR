
export function normalizeID(id: string | null | undefined): string | null {
    if (!id) return null;
    // Remove all non-alphanumeric characters
    const cleaned = id.replace(/[^a-zA-Z0-9]/g, '');
    return cleaned.length > 0 ? cleaned : null;
}

export function toTitleCase(str: string | null | undefined): string | null {
    if (!str) return null;
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

/**
 * Normaliza el nombre de un Partido/Departamento a Title Case canónico.
 * "MONTE HERMOSO" → "Monte Hermoso", "bahia blanca" → "Bahia Blanca"
 */
export function normalizePartido(partido: string | null | undefined): string {
    if (!partido || !partido.trim()) return 'Sin Partido';
    return partido.trim().toLowerCase().split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * Normaliza un número de partida inmobiliaria: quita puntos decorativos.
 * "126.559" → "126559", "7.205.976" → "7205976", "2.780" → "2780"
 * Conserva guiones y barras que son parte de la estructura (ej: "126-017.871-3" → "126-017871-3")
 */
export function normalizePartida(partida: string | null | undefined): string {
    if (!partida || !partida.trim()) return '000000';
    // Remove dots used as thousand separators in partida numbers
    return partida.trim().replace(/\./g, '');
}

/**
 * Separa partidas múltiples: "126-017.871-3 / 126-022.080" → ["126-017871-3", "126-022080"]
 * Detecta separadores: " / ", " y ", " - " (con espacios), " e "
 */
export function splitMultiplePartidas(partida: string | null | undefined): string[] {
    if (!partida || !partida.trim()) return [];
    // Split by " / " or " y " or " e " (with spaces to avoid splitting within partida numbers)
    const parts = partida.split(/\s+[\/yYeE]\s+/).map(p => normalizePartida(p)).filter(p => p && p !== '000000');
    return parts.length > 0 ? parts : [normalizePartida(partida)];
}

/**
 * Formatea un CUIT/CUIL al formato argentino estándar: XX-XXXXXXXX-X
 * Si el CUIT no tiene exactamente 11 dígitos, lo devuelve sin cambios.
 */
export function formatCUIT(cuit: string | null | undefined): string | null {
    if (!cuit) return null;

    // Limpiar caracteres no numéricos
    const clean = cuit.replace(/\D/g, "");

    // Si tiene menos de 11, devolvemos lo que hay (formateo parcial si es posible)
    if (clean.length < 11) {
        if (clean.length > 2 && clean.length <= 10) return `${clean.slice(0, 2)}-${clean.slice(2)}`;
        if (clean.length > 10) return `${clean.slice(0, 2)}-${clean.slice(2, 10)}-${clean.slice(10)}`;
        return clean;
    }

    // Formatear estándar: XX-XXXXXXXX-X (tomando solo los primeros 11 si hubiera más)
    const fixed = clean.slice(0, 11);
    return `${fixed.slice(0, 2)}-${fixed.slice(2, 10)}-${fixed.slice(10)}`;
}

/**
 * Detects if a persona is a legal entity based on tipo_persona, CUIT prefix, or name keywords.
 */
const JURIDICA_NAME_KEYWORDS = ['BANCO', 'S.A.', 'S.R.L.', 'S.A.U.', 'S.A.S.', 'S.C.A.', 'SOCIEDAD', 'FIDEICOMISO', 'FUNDACION', 'ASOCIACION', 'COOPERATIVA', 'CONSORCIO', 'MUTUAL'];

export function isLegalEntity(persona: any): boolean {
    if (!persona) return false;
    if (persona.tipo_persona === 'JURIDICA' || persona.tipo_persona === 'FIDEICOMISO') return true;

    // Check CUIT/CUIL
    const cuit = (persona.cuit_cuil || persona.cuit)?.toString()?.replace(/\D/g, '') || '';
    if (['30', '33', '34'].some(prefix => cuit.startsWith(prefix))) return true;

    // Fallback: detect by name keywords when tipo_persona is not set correctly
    const nombre = (persona.nombre_completo || persona.full_name || '').toUpperCase();
    return JURIDICA_NAME_KEYWORDS.some(kw => nombre.includes(kw));
}

/**
 * Formats a person/entity name for display.
 * - Legal Entities (JURIDICA): "BANCO DE LA NACION ARGENTINA" (Fixes "ARGENTINA, BANCO...")
 * - Natural Persons (FISICA): "APELLIDO, Nombre" (Standardizes "Juan PEREZ" -> "PEREZ, Juan")
 */
export function formatClienteDisplayName(persona: any): string {
    if (!persona?.nombre_completo) return "DESCONOCIDO";

    const nombre = persona.nombre_completo.trim();
    const esJuridica = isLegalEntity(persona);

    if (esJuridica) {
        // Fix "ARGENTINA, BANCO DE LA NACION" -> "BANCO DE LA NACION ARGENTINA"
        if (nombre.includes(",")) {
            const parts = nombre.split(",").map((s: string) => s.trim());
            if (parts.length >= 2) {
                return `${parts[1]} ${parts[0]}`.toUpperCase();
            }
        }
        return nombre.toUpperCase();
    } else {
        // Natural Person: "APELLIDO, Nombre"

        // Case 1: Already has comma -> "APELLIDO, Nombre"
        if (nombre.includes(",")) {
            const [surname, ...names] = nombre.split(",").map((s: string) => s.trim());
            return `${surname.toUpperCase()}, ${names.join(" ")}`;
        }

        // Case 2: No comma. Check for uppercase words (potential surnames)
        const parts = nombre.split(/\s+/);

        // Find if there are words in ALL CAPS (length > 1 to avoid initials)
        // We use a looser regex if standard one fails, or just prioritize clearly uppercase parts.
        const upperParts = parts.filter((p: string) => p.length > 1 && p === p.toUpperCase() && /[A-ZÑÁÉÍÓÚ]/.test(p));

        if (upperParts.length > 0 && upperParts.length < parts.length) {
            // "Ramsés Antonio CASTILLO MARACAY"
            const surnames = upperParts.join(" ");
            const names = parts.filter((p: string) => !upperParts.includes(p)).join(" ");
            return `${surnames.toUpperCase()}, ${names}`;
        }

        // Case 3: Standard heuristic (Last word is surname)
        if (parts.length > 1) {
            const last = parts.pop();
            const first = parts.join(" ");
            return `${last?.toUpperCase()}, ${first}`;
        }

        // Case 4: Single word
        return nombre.toUpperCase();
    }
}

/**
 * Legacy helper, keeping for compatibility but aliasing or simplifying.
 */
export function formatPersonName(fullname: string | null | undefined): string {
    // This was used for "Name SURNAME", but we are moving to specific context formatters.
    // Let's keep it as is or redirect?
    // The previous implementation was:
    if (!fullname) return "";
    if (fullname.includes(",")) {
        const [last, ...firstParts] = fullname.split(",").map(s => s.trim());
        return `${firstParts.join(" ")} ${last.toUpperCase()}`;
    }
    const parts = fullname.trim().split(/\s+/);
    if (parts.length >= 2) {
        const last = parts.pop()!.toUpperCase();
        return `${parts.join(" ")} ${last}`;
    }
    return fullname.toUpperCase();
}

export function getCuitLabel(tipo: 'CUIT' | 'CUIL' | string | null | undefined, isFormal: boolean = true): string {
    const t = (tipo || 'CUIT').toUpperCase();
    if (isFormal) {
        return t === 'CUIL' ? 'C.U.I.L.' : 'C.U.I.T.';
    }
    return t;
}
