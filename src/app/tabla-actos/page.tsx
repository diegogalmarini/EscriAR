"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, FileSpreadsheet } from "lucide-react";
import actsData from "@/data/acts_taxonomy_2026.json";

// Type for act data
interface ActEntry {
    description: string;
    category: string;
    tax_variables: {
        stamp_duty_rate: number;
        min_fee_ars: number;
        fees_extracted: string[];
    };
    suspended_rate_2026: boolean;
    raw_row?: string[];
}

export default function TablaActosPage() {
    const [searchTerm, setSearchTerm] = useState("");

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
            return actsArray.slice(0, 100); // Show first 100 by default
        }

        const term = searchTerm.toLowerCase();
        return actsArray.filter(act =>
            act.code.toLowerCase().includes(term) ||
            act.description.toLowerCase().includes(term)
        ).slice(0, 200);
    }, [actsArray, searchTerm]);

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
                <Badge variant="outline" className="text-xs">
                    {actsArray.length} actos registrados
                </Badge>
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
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 h-12 text-base"
                        />
                    </div>
                    <p className="text-xs text-slate-400 mt-2">
                        {searchTerm ? `${filteredActs.length} resultados encontrados` : `Mostrando primeros 100 de ${actsArray.length} actos`}
                    </p>
                </CardContent>
            </Card>

            {/* Table */}
            <Card className="border-slate-200 shadow-sm overflow-hidden">
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
                            {filteredActs.map((act) => (
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
                                        {act.tax_variables.fees_extracted?.[0] || '-'}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono text-xs text-slate-600">
                                        {act.tax_variables.fees_extracted?.[1] || '-'}
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
            </Card>

            {/* Footer Note */}
            <p className="text-xs text-slate-400 text-center">
                Fuente: Tabla de Actos Notariales General - Extensión Jur. 01/01/2026 • CESBA
            </p>
        </div>
    );
}
