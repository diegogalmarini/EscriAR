"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, FileSpreadsheet, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import actsData from "@/data/acts_taxonomy_2026.json";

// Type for act data
interface ActEntry {
    description: string;
    category: string;
    tax_variables: {
        stamp_duty_rate: number;
        min_fee_ars: number;
        fees_extracted: (number | string)[] | null;
        coef?: number | null;
    };
    suspended_rate_2026: boolean;
    raw_row?: string[];
}

export default function TablaActosPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(50);

    // Convert object to array for easier handling
    const actsArray = useMemo(() => {
        return Object.entries(actsData as Record<string, ActEntry>).map(([code, data]) => ({
            code,
            ...data
        }));
    }, []);

    // Filter acts based on search term
    const filteredActs = useMemo(() => {
        if (!searchTerm.trim()) {
            return actsArray;
        }

        const term = searchTerm.toLowerCase();
        return actsArray.filter(act =>
            act.code.toLowerCase().includes(term) ||
            act.description.toLowerCase().includes(term)
        );
    }, [actsArray, searchTerm]);

    const totalPages = Math.ceil(filteredActs.length / itemsPerPage);

    const paginatedActs = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredActs.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredActs, currentPage, itemsPerPage]);

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    return (
        <div className="min-h-screen bg-slate-50/50 flex flex-col">
            {/* Sticky Header: Title + Search + Table Column Headers */}
            <div className="sticky top-0 z-20 bg-slate-50 border-b border-slate-300 px-6 md:px-8 pt-6 pb-0 shadow-sm">
                {/* Title Row + Search + Actions */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3 shrink-0">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <FileSpreadsheet className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">Tabla de Actos 01/2026</h1>
                            <p className="text-sm text-slate-500">CESBA - Colegio de Escribanos de Buenos Aires</p>
                        </div>
                    </div>

                    <div className="flex-1 max-w-2xl relative w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            type="text"
                            placeholder="Buscar por código (ej: 100-00) o descripción (ej: COMPRAVENTA)..."
                            value={searchTerm}
                            onChange={handleSearch}
                            className="pl-10 h-10 w-full bg-white transition-shadow focus-visible:ring-1 focus-visible:ring-slate-300 border-slate-200"
                        />
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                        <Button variant="outline" size="sm" asChild>
                            <a href="/Tabla_Actos_Notariales_2026.pdf" target="_blank" rel="noopener noreferrer">
                                <Download className="mr-2 h-4 w-4" />
                                Ver PDF Oficial
                            </a>
                        </Button>
                        <Badge variant="outline" className="text-xs">
                            {filteredActs.length} actos registrados
                        </Badge>
                    </div>
                </div>

                {/* Column Headers */}
                <table className="w-full text-sm table-fixed">
                    <colgroup>
                        <col style={{ width: '7%' }} />
                        <col style={{ width: '23%' }} />
                        <col style={{ width: '10%' }} />
                        <col style={{ width: '6%' }} />
                        <col style={{ width: '6%' }} />
                        <col style={{ width: '12%' }} />
                        <col style={{ width: '10%' }} />
                        <col style={{ width: '10%' }} />
                        <col style={{ width: '7%' }} />
                        <col style={{ width: '9%' }} />
                    </colgroup>
                    <thead>
                        <tr className="text-[10px] uppercase text-slate-600 font-semibold tracking-wider text-center divide-x divide-slate-200 bg-slate-50">
                            <th colSpan={2} className="px-2 py-2">
                                NOTARIOS DE EXTRAÑA JURISDICCIÓN<br />
                                TABLA CON TODOS LOS ACTOS<br />
                                AGRUPADOS CORRELATIVAMENTE POR CÓDIGO
                            </th>
                            <th colSpan={3} className="px-2 py-2">
                                OBLIGACIÓN FISCAL
                            </th>
                            <th colSpan={2} className="px-2 py-2">
                                ARANCEL<br />
                                LEY 6925 PCIA. DE BUENOS AIRES
                            </th>
                            <th colSpan={3} className="px-2 py-2">
                                APORTE NOTARIAL<br />
                                Ley 6983 (Modif. por Ley 12172)
                            </th>
                        </tr>
                        <tr className="text-[10px] uppercase text-slate-700 font-bold text-center divide-x divide-slate-200 bg-slate-100 border-b border-slate-300">
                            <th className="px-1 py-2">CÓDIGO</th>
                            <th className="px-2 py-2 text-left">TIPO DE ACTO</th>
                            <th className="px-1 py-2">BASE IMPONIBLE</th>
                            <th className="px-1 py-2 leading-tight">Impuesto<br />o Tasa</th>
                            <th className="px-1 py-2 leading-tight">Artículo<br />Número</th>
                            <th className="px-1 py-2">BASE DE CÁLCULO</th>
                            <th className="px-1 py-2 leading-tight">Honorario<br />Mínimo</th>
                            <th className="px-1 py-2">BASE DE CÁLCULO</th>
                            <th className="px-1 py-2">Coeficiente</th>
                            <th className="px-1 py-2 leading-tight">Aporte<br />Mínimo</th>
                        </tr>
                    </thead>
                </table>
            </div>

            {/* Scrollable Table Body */}
            <div className="flex-1 overflow-y-auto px-6 md:px-8">
                <table className="w-full text-sm table-fixed">
                    <colgroup>
                        <col style={{ width: '7%' }} />
                        <col style={{ width: '23%' }} />
                        <col style={{ width: '10%' }} />
                        <col style={{ width: '6%' }} />
                        <col style={{ width: '6%' }} />
                        <col style={{ width: '12%' }} />
                        <col style={{ width: '10%' }} />
                        <col style={{ width: '10%' }} />
                        <col style={{ width: '7%' }} />
                        <col style={{ width: '9%' }} />
                    </colgroup>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {paginatedActs.map((act) => {
                            const row = act.raw_row || [];
                            const codigo = row[1] || act.code;
                            const tipoActo = row[2] || act.description;
                            const baseImponible = row[3] || '-';
                            const impuestoTasa = row[4] || '-';
                            const articuloNumero = row[5] || '-';
                            const baseCalculoArancel = row[6] || '-';
                            const honorarioMinimo = row[7] || '-';
                            const baseCalculoAporte = row[8] || '-';
                            const coeficiente = row[10] || '-';
                            const aporteMinimo = row[11] || '-';

                            return (
                                <tr key={act.code} className="hover:bg-slate-50 transition-colors divide-x divide-slate-100 text-xs">
                                    <td className="px-2 py-3 text-center align-top">
                                        <code className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-mono text-[11px] whitespace-nowrap">
                                            {codigo}
                                        </code>
                                    </td>
                                    <td className="px-2 py-3 text-slate-800 font-medium align-top">
                                        {tipoActo}
                                        {act.suspended_rate_2026 && (
                                            <Badge variant="secondary" className="ml-2 text-[9px] px-1 py-0 float-right mt-0.5">SUSP. 2026</Badge>
                                        )}
                                    </td>
                                    <td className="px-2 py-3 text-slate-600 text-[10px] align-top">{baseImponible}</td>
                                    <td className="px-2 py-3 text-center align-top">
                                        <span className={`font-bold ${impuestoTasa.includes('EXENT') || impuestoTasa.includes('NO GRAV') ? 'text-emerald-600' : 'text-slate-700'}`}>
                                            {impuestoTasa}
                                        </span>
                                    </td>
                                    <td className="px-2 py-3 text-center text-slate-500 text-[11px] align-top">{articuloNumero}</td>
                                    <td className="px-2 py-3 text-slate-600 text-[10px] align-top">{baseCalculoArancel}</td>
                                    <td className="px-2 py-3 text-right font-mono text-slate-800 whitespace-nowrap align-top">{honorarioMinimo}</td>
                                    <td className="px-2 py-3 text-slate-600 text-[10px] align-top">{baseCalculoAporte}</td>
                                    <td className="px-2 py-3 text-center font-mono text-slate-800 text-[11px] whitespace-nowrap align-top">{coeficiente}</td>
                                    <td className="px-2 py-3 text-right font-mono text-slate-800 whitespace-nowrap align-top">{aporteMinimo}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {filteredActs.length === 0 && (
                    <div className="text-center py-12 text-slate-400">
                        <FileSpreadsheet className="mx-auto h-10 w-10 opacity-30 mb-3" />
                        <p>No se encontraron actos con ese criterio de búsqueda.</p>
                    </div>
                )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between px-6 md:px-8 py-3 border-t border-slate-200 gap-4 bg-white shrink-0">
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                        <div className="flex items-center gap-2">
                            <span>Filas por página</span>
                            <Select
                                value={itemsPerPage.toString()}
                                onValueChange={(value) => {
                                    setItemsPerPage(Number(value));
                                    setCurrentPage(1);
                                }}
                            >
                                <SelectTrigger className="h-8 w-[70px]">
                                    <SelectValue placeholder={itemsPerPage} />
                                </SelectTrigger>
                                <SelectContent position="popper" side="top" sideOffset={4}>
                                    <SelectItem value="10">10</SelectItem>
                                    <SelectItem value="20">20</SelectItem>
                                    <SelectItem value="50">50</SelectItem>
                                    <SelectItem value="100">100</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <span>
                            Mostrando <span className="font-medium text-slate-700">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="font-medium text-slate-700">{Math.min(currentPage * itemsPerPage, filteredActs.length)}</span> de <span className="font-medium text-slate-700">{filteredActs.length}</span> actos
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="h-8 shadow-sm"
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Anterior
                        </Button>
                        <div className="text-sm font-medium text-slate-600 px-3 py-1 bg-white border border-slate-200 rounded-md">
                            {currentPage} / {totalPages}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="h-8 shadow-sm"
                        >
                            Siguiente
                            <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </div>
                </div>
            )}

        </div>
    );
}
