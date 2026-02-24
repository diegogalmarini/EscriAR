"use client";

import { useState, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Printer, Download, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PaginationControls } from "@/components/PaginationControls";

interface ProtocoloRegistro {
    id?: string;
    nro_escritura: number | null;
    folios: string;
    dia: number | null;
    mes: number | null;
    anio: number;
    tipo_acto: string;
    es_errose: boolean;
    vendedor_acreedor: string;
    comprador_deudor: string;
    monto_usd: number | null;
    monto_ars: number | null;
    codigo_acto: string;
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

function extractFirstFolio(folios: string): number | null {
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
 * Genera entradas del índice desde los registros del protocolo.
 * Cada participante genera una línea:
 * - Vendedor: "VENDEDOR a COMPRADOR"
 * - Comprador: "COMPRADOR de VENDEDOR"
 */
function generateIndiceEntries(registros: ProtocoloRegistro[]): IndiceEntry[] {
    const entries: IndiceEntry[] = [];

    for (const reg of registros) {
        // Skip errose
        if (reg.es_errose || reg.tipo_acto?.toLowerCase().includes("errose")) continue;

        const fecha = formatFecha(reg.dia, reg.mes, reg.anio);
        const folio = extractFirstFolio(reg.folios);
        const operacion = capitalizeActo(reg.tipo_acto || "");

        // Entry for vendedor/acreedor/poderdante → "VENDEDOR a COMPRADOR"
        if (reg.vendedor_acreedor) {
            const interviniente = reg.comprador_deudor
                ? `${reg.vendedor_acreedor} a ${reg.comprador_deudor}`
                : reg.vendedor_acreedor;

            entries.push({
                interviniente,
                operacion,
                fecha,
                esc: reg.nro_escritura,
                folio,
                sortKey: reg.vendedor_acreedor.toUpperCase(),
            });
        }

        // Entry for comprador/deudor/apoderado → "COMPRADOR de VENDEDOR"
        if (reg.comprador_deudor) {
            const interviniente = reg.vendedor_acreedor
                ? `${reg.comprador_deudor} de ${reg.vendedor_acreedor}`
                : reg.comprador_deudor;

            entries.push({
                interviniente,
                operacion,
                fecha,
                esc: reg.nro_escritura,
                folio,
                sortKey: reg.comprador_deudor.toUpperCase(),
            });
        }
    }

    // Ordenar alfabéticamente por apellido
    entries.sort((a, b) => a.sortKey.localeCompare(b.sortKey, "es"));

    return entries;
}

export function IndiceProtocolo({ registros, anio, userName = "GONZALO" }: Props) {
    const [search, setSearch] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const printRef = useRef<HTMLDivElement>(null);

    // Generar todas las entradas del índice
    const allEntries = useMemo(() => generateIndiceEntries(registros), [registros]);

    // Filtrar por búsqueda
    const filteredEntries = useMemo(() => {
        if (!search.trim()) return allEntries;
        const q = search.toLowerCase();
        return allEntries.filter(e =>
            e.interviniente.toLowerCase().includes(q) ||
            e.operacion.toLowerCase().includes(q)
        );
    }, [allEntries, search]);

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
                        background: #4472C4;
                        color: white;
                        padding: 5px 6px;
                        font-size: 10px;
                        text-transform: uppercase;
                        font-weight: bold;
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
                            <th style="width:22%;">Operación</th>
                            <th style="width:13%;">Fecha</th>
                            <th style="width:8%;">Esc.</th>
                            <th style="width:12%;">Folio</th>
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
                    <div className="bg-[#4472C4] text-white text-[11px] font-bold uppercase tracking-wide grid grid-cols-[1fr_180px_100px_60px_70px]">
                        <div className="px-3 py-2.5">Intervinientes</div>
                        <div className="px-3 py-2.5 text-center">Operación</div>
                        <div className="px-3 py-2.5 text-center">Fecha</div>
                        <div className="px-3 py-2.5 text-center">Esc.</div>
                        <div className="px-3 py-2.5 text-center">Folio</div>
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
