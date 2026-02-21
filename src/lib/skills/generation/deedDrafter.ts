import { formatNotaryMoney, formatNotaryDate, formatNotaryName } from "../../utils/formatters";

export interface DraftingContext {
    numero_escritura: string;
    acto_titulo: string;
    fecha: string; // YYYY-MM-DD
    escribano: string;
    registro: string;
    caracter_escribano?: string; // TITULAR, A_CARGO, ADSCRIPTO, INTERINO
    distrito_notarial?: string;
    clientes: any[];
    inmuebles: any[];
    tax_calculation: any;
    compliance: any;
    mortgage?: any; // New optional mortgage details
    operation_type?: string;
}

/**
 * DeedDrafter: Generates the legal text of a deed using dynamic composition.
 * Following logic from notary-deed-drafter skill.
 */
export class DeedDrafter {
    static generate(context: DraftingContext): string {
        const {
            numero_escritura,
            acto_titulo,
            fecha,
            escribano,
            registro,
            clientes,
            inmuebles,
            tax_calculation,
            compliance
        } = context;

        const safeClientes = clientes || [];
        const safeInmuebles = inmuebles || [];
        const dateTxt = fecha ? formatNotaryDate(fecha) : "FECHA PENDIENTE";
        const isMortgage = acto_titulo?.toUpperCase().includes('HIPOTECA') || context.operation_type === 'HIPOTECA';

        const vendors = safeClientes.filter(c => c.rol?.includes('VENDEDOR') || c.rol?.includes('ACREEDOR'));
        const buyers = safeClientes.filter(c => c.rol?.includes('COMPRADOR') || c.rol?.includes('DEUDOR'));

        let text = `ESCRITURA NUMERO ${(numero_escritura || "___").toUpperCase()}.- ${(acto_titulo || "ACTO").toUpperCase()}.- `;
        text += `En la ciudad de Bahía Blanca, provincia de Buenos Aires, a los ${dateTxt}, `;
        const caracterLabel = context.caracter_escribano === 'A_CARGO' ? 'a cargo del'
            : context.caracter_escribano === 'ADSCRIPTO' ? 'Adscripto al'
            : context.caracter_escribano === 'INTERINO' ? 'Interino del'
            : 'Titular del';
        const distrito = context.distrito_notarial || 'Bahía Blanca';
        text += `ante mí, ${(escribano || "ESCRIBANO").toUpperCase()}, Escribano ${caracterLabel} Registro número ${(registro || "___")}, del Distrito Notarial de ${distrito}, COMPARECEN: `;

        // Comparecencia
        safeClientes.forEach((c, i) => {
            const formattedName = formatNotaryName(c.nombre_completo || "SIN NOMBRE");
            text += `por una parte ${formattedName}, ${c.nacionalidad || 'argentino'}, DNI ${c.dni || "___"}${i === safeClientes.length - 1 ? '.' : '; '}`;
        });

        text += `\n\nINTERVENCION: Los comparecientes intervienen por su propio derecho. `;

        if (isMortgage) {
            text += `Y el deudor DICE: Que CONSTITUYE DERECHO REAL DE HIPOTECA en primer grado de privilegio, a favor de la parte acreedora, sobre el siguiente Inmueble: `;
        } else {
            text += `Y el vendedor DICE: Que VENDE, CEDE y TRANSFIERE a favor de la parte compradora, el siguiente Inmueble: `;
        }

        // Inmueble
        safeInmuebles.forEach(i => {
            text += `\n${i.transcripcion_literal || '[FALTA DESCRIPCION TECNICA]'}`;
        });

        // Precio / Capital
        if (isMortgage && context.mortgage) {
            const m = context.mortgage.financial_terms;
            const capitalTxt = formatNotaryMoney(m.capital?.valor || 0, m.capital?.currency || 'UVA');
            text += `\n\nCAPITAL Y CLAUSULAS FINANCIERAS: La presente hipoteca se constituye por la suma de ${capitalTxt}. `;
            text += `Se conviene una tasa de interés de ${m.rate?.valor || '___'}, bajo el sistema de amortización ${m.system?.valor || 'FRANCES'}. `;
            if (context.mortgage.legal_status?.letra_hipotecaria) {
                text += `Se procede a la creación de la respectiva Letra Hipotecaria Escritural. `;
            }
        } else {
            const moneyTxt = formatNotaryMoney(tax_calculation?.baseCalculoArs || 0, 'ARS');
            text += `\n\nPRECIO: La presente operación se realiza por el precio total de ${moneyTxt}, que la parte vendedora manifiesta haber recibido con anterioridad a este acto.`;
        }

        // Compliance & PEPs
        if (compliance?.risk_level === 'HIGH' || compliance?.alerts?.length > 0) {
            text += `\n\nCONSTANCIAS UIF: `;
            compliance.alerts.forEach((alert: string) => {
                text += `\n- ${alert}`;
            });

            if (compliance.alerts.some((a: string) => a.includes('PEP'))) {
                text += `\nManifestando el comprador bajo fe de juramento su condición de Persona Expuesta Políticamente (PEP).`;
            }
        }

        // Taxes
        text += `\n\nIMPUESTOS Y TASAS: Se hace constar que se retienen las siguientes sumas: `;
        text += `Impuesto de Sellos: ${formatNotaryMoney(tax_calculation?.detail?.sellosPba || 0, 'ARS')}; `;
        text += `ITI: ${formatNotaryMoney(tax_calculation?.detail?.itiAfip || 0, 'ARS')}. `;

        text += `\n\nCIERRE: Leo a los comparecientes, quienes se ratifican en su contenido y firman ante mí, de lo que doy fe.`;

        return text;
    }
}
