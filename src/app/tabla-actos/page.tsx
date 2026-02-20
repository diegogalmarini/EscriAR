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

    // Extract stamp duty from raw_row if available
    const getStampDuty = (act: ActEntry & { code: string }) => {
        const raw = act.raw_row || [];
        const stampIndex = raw.findIndex(v => v && (v.includes('%') || v === 'EXENTO' || v === 'NO GRAV.'));
        return stampIndex >= 0 ? raw[stampIndex] : '-';
    };

    return (
        <div className="min-h-screen bg-slate-50/50 p-6 md:p-8 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <FileSpreadsheet className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">Tabla de Actos 01/2026</h1>
                            <p className="text-sm text-slate-500">CESBA - Colegio de Escribanos de Buenos Aires</p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" asChild>
                        <a href="/Tabla_Actos_Notariales_2026.pdf" target="_blank" rel="noopener noreferrer">
                            <Download className="mr-2 h-4 w-4" />
                            Ver PDF Oficial
                        </a>
                    </Button>
                    <Badge variant="outline" className="text-xs">
                        {actsArray.length} actos registrados
                    </Badge>
                </div>
            </div>

            {/* Search */}
            <Card className="border-slate-200 shadow-sm">
                <CardContent className="pt-6">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            type="text"
                            placeholder="Buscar por código (ej: 100-00) o descripción (ej: COMPRAVENTA)..."
                            value={searchTerm}
                            onChange={handleSearch}
                            className="pl-10 h-12 text-base"
                        />
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                        {filteredActs.length} {filteredActs.length === 1 ? 'resultado encontrado' : 'resultados encontrados'}
                    </p>
                </CardContent>
            </Card>

            {/* Table */}
            <Card className="border-slate-200 shadow-sm relative">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-100 border-b">
                            <tr>
                                <th className="px-4 py-3 text-left font-semibold text-slate-700 w-24">Código</th>
                                <th className="px-4 py-3 text-left font-semibold text-slate-700">Descripción</th>
                                <th className="px-4 py-3 text-center font-semibold text-slate-700 w-24">Sellos</th>
                                <th className="px-4 py-3 text-right font-semibold text-slate-700 w-32">Honorario Mín.</th>
                                <th className="px-4 py-3 text-right font-semibold text-slate-700 w-28">Aporte 3ros</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {paginatedActs.map((act) => (
                                <tr key={act.code} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-4 py-3">
                                        <code className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-mono text-xs">
                                            {act.code}
                                        </code>
                                    </td>
                                    <td className="px-4 py-3 text-slate-700">
                                        {act.description}
                                        {act.suspended_rate_2026 && (
                                            <Badge variant="secondary" className="ml-2 text-[10px]">EXENTO</Badge>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span className={`text-xs font-medium ${getStampDuty(act) === 'EXENTO' || getStampDuty(act) === 'NO GRAV.'
                                            ? 'text-green-600'
                                            : 'text-slate-600'
                                            }`}>
                                            {getStampDuty(act)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono text-xs text-slate-600">
                                        {act.tax_variables.fees_extracted?.[0] ? `$ ${new Intl.NumberFormat('es-AR').format(Number(act.tax_variables.fees_extracted[0]))}` : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono text-xs text-slate-600">
                                        {act.tax_variables.fees_extracted?.[1] ? `$ ${new Intl.NumberFormat('es-AR').format(Number(act.tax_variables.fees_extracted[1]))}` : '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {filteredActs.length === 0 && (
                    <div className="text-center py-12 text-slate-400">
                        <FileSpreadsheet className="mx-auto h-10 w-10 opacity-30 mb-3" />
                        <p>No se encontraron actos con ese criterio de búsqueda.</p>
                    </div>
                )}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between p-4 border-t border-slate-100 gap-4 bg-slate-50/50">
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
            </Card>

            {/* Footer Note */}
            <p className="text-xs text-slate-400 text-center">
                Fuente: Tabla de Actos Notariales General - Extensión Jur. 01/01/2026 • CESBA
            </p>
        </div>
    );
}
