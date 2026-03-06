"use client";

import { useState, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Printer, Download, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PaginationControls } from "@/components/PaginationControls";

interface ProtocoloRegistro {
    id?: string;
    nro_escritura: number | null;
    folios: string | null;
    dia: number | null;
    mes: number | null;
    anio: number;
    tipo_acto: string | null;
    es_errose: boolean;
    vendedor_acreedor: string | null;
    comprador_deudor: string | null;
    monto_usd: number | null;
    monto_ars: number | null;
    codigo_acto: string | null;
}

interface IndiceEntry {
    interviniente: string; // "APELLIDO, Nombre de/a APELLIDO, Nombre"
    operacion: string;     // tipo_acto formateado
    fecha: string;         // dd/mm/yy
    esc: number | null;
    folio: number | null;  // primer folio
    sortKey: string;       // para ordenar alfabéticamente
}

interface Props {
    registros: ProtocoloRegistro[];
    anio: number;
    userName?: string;
}

// ── Helpers ──

function extractFirstFolio(folios: string | null): number | null {
    if (!folios) return null;
    const match = folios.match(/^(\d+)/);
    return match ? parseInt(match[1], 10) : null;
}

function formatFecha(dia: number | null, mes: number | null, anio: number): string {
    if (!dia || !mes) return "";
    const yy = String(anio).slice(-2);
    return `${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${yy}`;
}

function capitalizeActo(acto: string): string {
    if (!acto) return "";
    // Capitalize first letter of each word
    return acto.replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Separa un campo multi-persona en nombres individuales.
 * Ej: "LAVAYEN, Walter y BROGGI, Marina" → ["LAVAYEN, Walter", "BROGGI, Marina"]
 * Ej: "JUAN, Ana y otro" → ["JUAN, Ana y otro"] (no se splitea, "y otro" es calificador)
 * Ej: "MOSCARDI, Juan y otros" → ["MOSCARDI, Juan y otros"] (no se splitea)
 */
function splitPersonas(campo: string): string[] {
    if (!campo) return [];

    // Buscar posiciones de " y " en el texto
    const parts: string[] = [];
    let remaining = campo;

    while (true) {
        // Buscar " y " seguido de algo que parece un nuevo apellido (mayúscula + coma posterior)
        const match = remaining.match(/^(.+?)\s+y\s+(?=[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ]*\s*,)/);
        if (match) {
            parts.push(match[1].trim());
            remaining = remaining.slice(match[0].length).trim();
        } else {
            // También split cuando " y " seguido de apellido compuesto sin coma pero con patrón
            // "APELLIDO APELLIDO, Nombre"
            const match2 = remaining.match(/^(.+?)\s+y\s+(?=[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ]+\s+[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ]*\s*,)/);
            if (match2) {
                parts.push(match2[1].trim());
                remaining = remaining.slice(match2[0].length).trim();
            } else {
                parts.push(remaining.trim());
                break;
            }
        }
    }

    return parts.filter(p => p.length > 0);
}

/**
 * Formatea la referencia a la contraparte.
 * Si hay una sola persona, muestra su nombre completo.
 * Si hay varias, muestra la primera "y otro" / "y otros".
 */
function formatContraparte(personas: string[], count: number): string {
    if (count === 0) return "";
    const primera = personas[0];
    if (count === 1) return primera;
    return `${primera} y otro`;
}

/**
 * Genera entradas del índice desde los registros del protocolo.
 * Cada persona individual genera su propia línea, replicando exactamente
 * el formato del PDF "Listado de Control" del escribano:
 * - Por cada vendedor: "VENDEDOR y otro a COMPRADOR y otro"
 * - Por cada comprador: "COMPRADOR y otro de VENDEDOR y otro"
 */
function generateIndiceEntries(registros: ProtocoloRegistro[]): IndiceEntry[] {
    const entries: IndiceEntry[] = [];

    for (const reg of registros) {
        // Skip errose
        if (reg.es_errose || reg.tipo_acto?.toLowerCase().includes("errose")) continue;

        const fecha = formatFecha(reg.dia, reg.mes, reg.anio);
        const folio = extractFirstFolio(reg.folios);
        const operacion = capitalizeActo(reg.tipo_acto || "");

        const vendedores = splitPersonas(reg.vendedor_acreedor || "");
        const compradores = splitPersonas(reg.comprador_deudor || "");

        // Para cada vendedor individual → "VENDEDOR (y otro) a COMPRADOR (y otro)"
        for (const vendedor of vendedores) {
            const otrosVendedores = vendedores.length > 1 ? ` y otro` : "";
            const contraRef = compradores.length > 0
                ? ` a ${formatContraparte(compradores, compradores.length)}`
                : "";
            const interviniente = `${vendedor}${otrosVendedores}${contraRef}`;

            entries.push({
                interviniente,
                operacion,
                fecha,
                esc: reg.nro_escritura,
                folio,
                sortKey: vendedor.toUpperCase(),
            });
        }

        // Para cada comprador individual → "COMPRADOR (y otro) de VENDEDOR (y otro)"
        for (const comprador of compradores) {
            const otrosCompradores = compradores.length > 1 ? ` y otro` : "";
            const contraRef = vendedores.length > 0
                ? ` de ${formatContraparte(vendedores, vendedores.length)}`
                : "";
            const interviniente = `${comprador}${otrosCompradores}${contraRef}`;

            entries.push({
                interviniente,
                operacion,
                fecha,
                esc: reg.nro_escritura,
                folio,
                sortKey: comprador.toUpperCase(),
            });
        }
    }

    return entries;
}

export function IndiceProtocolo({ registros, anio, userName = "GONZALO" }: Props) {
    const [search, setSearch] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [sortCol, setSortCol] = useState<keyof IndiceEntry>("esc");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
    const printRef = useRef<HTMLDivElement>(null);

    // Sort handler
    const handleSort = (key: keyof IndiceEntry) => {
        if (sortCol === key) {
            setSortDir(d => d === "asc" ? "desc" : "asc");
        } else {
            setSortCol(key);
            setSortDir("asc");
        }
        setCurrentPage(1);
    };

    // Generar todas las entradas del índice
    const allEntries = useMemo(() => generateIndiceEntries(registros), [registros]);

    // Filtrar por búsqueda
    const filteredEntries = useMemo(() => {
        let data = allEntries;
        if (search.trim()) {
            const q = search.toLowerCase();
            data = data.filter(e =>
                e.interviniente.toLowerCase().includes(q) ||
                e.operacion.toLowerCase().includes(q)
            );
        }
        // Ordenar
        data = [...data].sort((a, b) => {
            const aVal = a[sortCol];
            const bVal = b[sortCol];
            if (aVal === null || aVal === undefined || aVal === "") return 1;
            if (bVal === null || bVal === undefined || bVal === "") return -1;
            const cmp = typeof aVal === "number" && typeof bVal === "number"
                ? aVal - bVal
                : String(aVal).localeCompare(String(bVal), "es", { numeric: true });
            return sortDir === "asc" ? cmp : -cmp;
        });
        return data;
    }, [allEntries, search, sortCol, sortDir]);

    // Paginación
    const totalPages = Math.max(1, Math.ceil(filteredEntries.length / pageSize));
    const pageOffset = (currentPage - 1) * pageSize;
    const paginatedEntries = filteredEntries.slice(pageOffset, pageOffset + pageSize);

    // ── Imprimir / PDF ──
    const handlePrint = () => {
        const now = new Date();
        const dateStr = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
        const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

        const printWindow = window.open("", "_blank");
        if (!printWindow) return;

        const rows = filteredEntries.map((entry, i) => `
            <tr style="${i % 2 === 0 ? "" : "background:#f8f9fa;"}">
                <td style="padding:3px 6px;border-bottom:1px solid #e2e8f0;font-size:11px;">${entry.interviniente}</td>
                <td style="padding:3px 6px;border-bottom:1px solid #e2e8f0;font-size:11px;text-align:center;">${entry.operacion}</td>
                <td style="padding:3px 6px;border-bottom:1px solid #e2e8f0;font-size:11px;text-align:center;">${entry.fecha}</td>
                <td style="padding:3px 6px;border-bottom:1px solid #e2e8f0;font-size:11px;text-align:center;">${entry.esc ?? ""}</td>
                <td style="padding:3px 6px;border-bottom:1px solid #e2e8f0;font-size:11px;text-align:center;">${entry.folio ?? ""}</td>
            </tr>
        `).join("");

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Índice del Protocolo ${anio}</title>
                <style>
                    @page {
                        size: A4;
                        margin: 15mm 12mm 20mm 12mm;
                    }
                    body { font-family: Arial, sans-serif; margin: 0; padding: 0; color: #1a1a1a; }
                    .header { text-align: center; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #333; }
                    .header h1 { font-size: 14px; margin: 0 0 4px 0; font-weight: bold; }
                    .header p { font-size: 11px; margin: 0; color: #555; }
                    table { width: 100%; border-collapse: collapse; }
                    thead th {
                        background: #e1e1e1;
                        color: #1a1a1a;
                        padding: 5px 6px;
                        font-size: 10px;
                        font-weight: 600;
                        text-align: left;
                        letter-spacing: 0.3px;
                    }
                    thead th:not(:first-child) { text-align: center; }
                    .footer {
                        position: fixed;
                        bottom: 0;
                        left: 0;
                        right: 0;
                        display: flex;
                        justify-content: space-between;
                        font-size: 9px;
                        color: #666;
                        padding: 6px 12mm;
                        border-top: 1px solid #ccc;
                    }
                    @media print {
                        .footer { position: fixed; bottom: 0; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Listado de Control desde 01/01/${anio} hasta 31/12/${anio}</h1>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style="width:45%;">Intervinientes</th>
                            <th style="width:22%;text-align:center;">Operación</th>
                            <th style="width:13%;text-align:center;">Fecha</th>
                            <th style="width:8%;text-align:center;">Esc.</th>
                            <th style="width:12%;text-align:center;">Folio</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
                <div class="footer">
                    <span>Índice ${anio}</span>
                    <span>Usuario: ${userName} — ${dateStr} ${timeStr}</span>
                </div>
            </body>
            </html>
        `);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 300);
    };

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-1 max-w-sm">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por nombre o acto..."
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="pl-8 h-9"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                        {filteredEntries.length} entradas
                        {search && ` (de ${allEntries.length} total)`}
                    </span>
                    <Button onClick={handlePrint} size="sm" variant="outline" className="gap-1.5">
                        <Printer className="h-4 w-4" /> Imprimir PDF
                    </Button>
                </div>
            </div>

            {/* Tabla del Índice */}
            <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
                <div className="overflow-x-auto">
                    {/* Header */}
                    <div className="bg-[#e1e1e1] text-black text-[11px] font-semibold tracking-wide grid grid-cols-[1fr_180px_100px_60px_70px]">
                        {([
                            { key: "interviniente" as keyof IndiceEntry, label: "Intervinientes", align: "text-left" },
                            { key: "operacion" as keyof IndiceEntry, label: "Operación", align: "text-center" },
                            { key: "fecha" as keyof IndiceEntry, label: "Fecha", align: "text-center" },
                            { key: "esc" as keyof IndiceEntry, label: "Esc.", align: "text-center" },
                            { key: "folio" as keyof IndiceEntry, label: "Folio", align: "text-center" },
                        ]).map(col => (
                            <div
                                key={col.key}
                                className={cn(
                                    "px-3 py-2.5 cursor-pointer select-none hover:bg-[#d5d5d5] transition-colors flex items-center gap-1",
                                    col.align
                                )}
                                onClick={() => handleSort(col.key)}
                            >
                                <span>{col.label}</span>
                                {sortCol === col.key ? (
                                    sortDir === "asc"
                                        ? <ArrowUp className="h-3 w-3 shrink-0" />
                                        : <ArrowDown className="h-3 w-3 shrink-0" />
                                ) : (
                                    <ArrowUpDown className="h-3 w-3 shrink-0 opacity-30" />
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Empty state */}
                    {filteredEntries.length === 0 && (
                        <div className="py-12 text-center text-muted-foreground text-sm">
                            {search
                                ? `No se encontraron resultados para "${search}".`
                                : "No hay entradas en el índice. Agregue escrituras en el Seguimiento."
                            }
                        </div>
                    )}

                    {/* Data rows */}
                    {paginatedEntries.map((entry, i) => (
                        <div
                            key={`${entry.sortKey}-${entry.esc}-${i}`}
                            className={cn(
                                "grid grid-cols-[1fr_180px_100px_60px_70px] border-b border-slate-100",
                                i % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                            )}
                        >
                            <div className="px-3 py-1.5 text-xs">{entry.interviniente}</div>
                            <div className="px-3 py-1.5 text-xs text-center">{entry.operacion}</div>
                            <div className="px-3 py-1.5 text-xs text-center font-mono">{entry.fecha}</div>
                            <div className="px-3 py-1.5 text-xs text-center font-mono">{entry.esc ?? ""}</div>
                            <div className="px-3 py-1.5 text-xs text-center font-mono">{entry.folio ?? ""}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Paginación — mismo componente que el resto del sitio */}
            <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredEntries.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
            />
        </div>
    );
}
