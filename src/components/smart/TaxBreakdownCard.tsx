"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, Wallet } from "lucide-react";

interface TaxBreakdownProps {
    taxData: {
        baseCalculoArs: number;
        detail: {
            sellosPba: number;
            gananciasGlobalAfip: number;
            honorarios: number;
            iva21: number;
            aportesNotariales: number;
        };
        totalExpensesArs: number;
        totalExpensesUsd?: number;
    };
}

export function TaxBreakdownCard({ taxData }: TaxBreakdownProps) {
    if (!taxData) return (
        <Card className="bg-slate-50/50 border-dashed">
            <CardContent className="h-40 flex items-center justify-center text-muted-foreground italic text-sm">
                No hay estimación presupuestaria disponible.
            </CardContent>
        </Card>
    );

    const formatCurrency = (val: number, isUsd = false) => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: isUsd ? 'USD' : 'ARS'
        }).format(val);
    };

    const detail = taxData.detail || { sellosPba: 0, gananciasGlobalAfip: 0, honorarios: 0, iva21: 0, aportesNotariales: 0 };

    const rows = [
        { label: 'Impuesto de Sellos (PBA)', value: detail.sellosPba || 0, color: 'text-slate-700' },
        { label: 'Ganancias Global (AFIP)', value: detail.gananciasGlobalAfip || 0, color: 'text-slate-700' },
        { label: 'Honorarios Notariales', value: detail.honorarios || 0, color: 'text-slate-700' },
        { label: 'IVA (21%)', value: detail.iva21 || 0, color: 'text-slate-700' },
        { label: 'Aportes (Caja Notarial)', value: detail.aportesNotariales || 0, color: 'text-slate-700' },
    ];

    return (
        <Card className="shadow-md border-slate-200 overflow-hidden">
            <CardHeader className="bg-slate-50 border-b p-4">
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Wallet className="w-5 h-5 text-blue-600" />
                            Presupuesto Estimado
                        </CardTitle>
                        <CardDescription>Cálculo determinístico basado en valores de mercado.</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader className="bg-slate-100/50">
                        <TableRow>
                            <TableHead className="font-semibold text-xs">CONCEPTO</TableHead>
                            <TableHead className="text-right font-semibold text-xs">MONTO (ARS)</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((row, i) => (
                            <TableRow key={i} className="hover:bg-transparent">
                                <TableCell className="text-sm">{row.label}</TableCell>
                                <TableCell className={`text-right font-medium text-sm ${row.color}`}>{formatCurrency(row.value)}</TableCell>
                            </TableRow>
                        ))}
                        <TableRow className="bg-blue-50/50 border-t-2">
                            <TableCell className="font-bold text-blue-900">GASTOS TOTALES (Estimado)</TableCell>
                            <TableCell className="text-right font-bold text-blue-900 text-base">
                                {formatCurrency(taxData.totalExpensesArs)}
                            </TableCell>
                        </TableRow>
                        {taxData.totalExpensesUsd && (
                            <TableRow className="bg-blue-100/50">
                                <TableCell className="text-xs text-blue-800 font-medium italic">Equivalente en Dólares (BILLETE)</TableCell>
                                <TableCell className="text-right text-xs text-blue-800 font-bold italic">
                                    {formatCurrency(taxData.totalExpensesUsd, true)}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>

                <div className="p-4 bg-slate-50 flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-full">
                        <DollarSign className="w-4 h-4 text-blue-700" />
                    </div>
                    <div className="text-[11px] leading-tight text-slate-500">
                        * Base de cálculo: {formatCurrency(taxData.baseCalculoArs)}. <br />
                        Los valores pueden variar según la vigencia de tasas municipales y cotizaciones.
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
