"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Calculator, Info, AlertTriangle, TrendingDown } from "lucide-react";

/* ══════════════════════════════════════════════════════════
   Motor de Cálculo Fiscal Notarial — Provincia de Buenos Aires
   Basado en: Ley Impositiva PBA, Ley ITI, Art. 305 CCyC
   ══════════════════════════════════════════════════════════ */

// Tasas vigentes (actualizables)
const TASAS = {
    SELLOS_PBA: 0.02,               // 2% - Impuesto de Sellos PBA
    ITI: 0.015,                     // 1.5% - Impuesto a la Transferencia Inmueble
    GANANCIAS_CEDULAR: 0.15,        // 15% - Sobre la diferencia (post-2018)
    IVA: 0.21,                      // 21% - IVA sobre honorarios
    APORTE_CAJA_NOTARIAL: 0.006,    // 0.6% - Caja Prev. para Escribanos PBA (sobre monto acto)
    APORTE_COLEGIO: 0.001,          // 0.1% - Aporte Colegio de Escribanos 
    TOPE_EXENCION_VU_2025: 182_750_000, // Tope exención vivienda única (Ley Impositiva 2025 PBA - referencia)
};

const HONORARIOS_SUGERIDOS = [
    { value: "1", label: "1% del Monto" },
    { value: "1.5", label: "1.5% del Monto" },
    { value: "2", label: "2% del Monto (Colegio)" },
    { value: "custom", label: "Monto fijo personalizado" },
];

interface LiquidacionPanelProps {
    valuacionFiscalInicial?: number;
    tipoActo?: string;
}

export function LiquidacionPanel({ valuacionFiscalInicial, tipoActo }: LiquidacionPanelProps) {
    // ── Inputs ──
    const [precio, setPrecio] = useState<string>("");
    const [moneda, setMoneda] = useState<"ARS" | "USD">("USD");
    const [cotizacionUsd, setCotizacionUsd] = useState<string>("1200");
    const [valuacionFiscal, setValuacionFiscal] = useState<string>(
        valuacionFiscalInicial?.toString() || ""
    );
    const [esViviendaUnica, setEsViviendaUnica] = useState(false);
    const [fechaAdquisicionAnterior2018, setFechaAdquisicionAnterior2018] = useState(true);
    const [tieneExencionITI, setTieneExencionITI] = useState(false);
    const [honorariosTipo, setHonorariosTipo] = useState<string>("2");
    const [honorariosCustom, setHonorariosCustom] = useState<string>("");

    // ── Cálculos en tiempo real ──
    const calculo = useMemo(() => {
        const precioNum = parseFloat(precio) || 0;
        const cotizacion = moneda === "USD" ? (parseFloat(cotizacionUsd) || 1) : 1;
        const precioPesos = precioNum * cotizacion;
        const valFiscal = parseFloat(valuacionFiscal) || 0;

        if (precioPesos === 0 && valFiscal === 0) return null;

        // 1. Base Imponible = Mayor valor entre precio y valuación fiscal
        const baseImponible = Math.max(precioPesos, valFiscal);

        // 2. Impuesto de Sellos PBA
        let sellos = 0;
        if (esViviendaUnica) {
            const tope = TASAS.TOPE_EXENCION_VU_2025;
            if (baseImponible > tope) {
                sellos = (baseImponible - tope) * TASAS.SELLOS_PBA;
            }
            // Si base <= tope: exento total
        } else {
            sellos = baseImponible * TASAS.SELLOS_PBA;
        }

        // 3. ITI o Ganancias Cedulares
        let iti = 0;
        let gananciasCedulares = 0;
        let labelImpuestoVendedor = "";
        if (tieneExencionITI) {
            labelImpuestoVendedor = "ITI/Ganancias (Exento - Cert. No Retención)";
        } else if (fechaAdquisicionAnterior2018) {
            iti = precioPesos * TASAS.ITI;
            labelImpuestoVendedor = "ITI (Ley 23.905) — 1.5%";
        } else {
            // Post-2018: Ganancias Cedulares 15% sobre diferencia
            // Como no tenemos precio de compra, estimamos retencion a cuenta
            gananciasCedulares = precioPesos * 0.015; // Retención a cuenta simplificada
            labelImpuestoVendedor = "Ganancias Cedulares (retención a cuenta)";
        }

        // 4. Honorarios
        let honorarios = 0;
        if (honorariosTipo === "custom") {
            honorarios = parseFloat(honorariosCustom) || 0;
        } else {
            const pct = parseFloat(honorariosTipo) / 100;
            honorarios = precioPesos * pct;
        }
        const ivaHonorarios = honorarios * TASAS.IVA;

        // 5. Aportes
        const aporteCaja = baseImponible * TASAS.APORTE_CAJA_NOTARIAL;
        const aporteColegio = baseImponible * TASAS.APORTE_COLEGIO;

        // Total
        const totalGastos = sellos + iti + gananciasCedulares + honorarios + ivaHonorarios + aporteCaja + aporteColegio;

        return {
            precioPesos,
            baseImponible,
            sellos,
            iti,
            gananciasCedulares,
            labelImpuestoVendedor,
            honorarios,
            ivaHonorarios,
            aporteCaja,
            aporteColegio,
            totalGastos,
            totalGastosUsd: moneda === "USD" ? totalGastos / cotizacion : null,
            esExento: esViviendaUnica && baseImponible <= TASAS.TOPE_EXENCION_VU_2025,
        };
    }, [precio, moneda, cotizacionUsd, valuacionFiscal, esViviendaUnica, fechaAdquisicionAnterior2018, tieneExencionITI, honorariosTipo, honorariosCustom]);

    // ── Helpers ──
    const fmt = (val: number) =>
        new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(val);
    const fmtUsd = (val: number) =>
        new Intl.NumberFormat("es-AR", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);

    const esPoder = tipoActo?.toLowerCase().includes("poder");

    return (
        <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Calculator className="h-4 w-4" /> Liquidación Impositiva y Honorarios
            </h3>

            {esPoder && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex items-start gap-2">
                    <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-700">
                        Los poderes no generan impuesto de sellos o ITI. Solo se calculan honorarios y aportes.
                    </p>
                </div>
            )}

            {/* ── Formulario de Inputs ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Precio */}
                <div className="space-y-1.5">
                    <Label htmlFor="liq_precio" className="text-xs font-medium">
                        Precio de la Operación
                    </Label>
                    <div className="flex gap-2">
                        <Input
                            id="liq_precio"
                            type="number"
                            placeholder={moneda === "USD" ? "100000" : "120000000"}
                            value={precio}
                            onChange={(e) => setPrecio(e.target.value)}
                            className="h-9 flex-1"
                        />
                        <Select value={moneda} onValueChange={(v: "ARS" | "USD") => setMoneda(v)}>
                            <SelectTrigger className="w-[80px] h-9">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="USD">USD</SelectItem>
                                <SelectItem value="ARS">ARS</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Cotización USD */}
                {moneda === "USD" && (
                    <div className="space-y-1.5">
                        <Label htmlFor="liq_cotizacion" className="text-xs font-medium">
                            Cotización USD (BNA Vendedor)
                        </Label>
                        <Input
                            id="liq_cotizacion"
                            type="number"
                            value={cotizacionUsd}
                            onChange={(e) => setCotizacionUsd(e.target.value)}
                            className="h-9"
                        />
                    </div>
                )}

                {/* Valuación Fiscal */}
                <div className="space-y-1.5">
                    <Label htmlFor="liq_vf" className="text-xs font-medium">
                        Valuación Fiscal (ARS)
                    </Label>
                    <Input
                        id="liq_vf"
                        type="number"
                        value={valuacionFiscal}
                        onChange={(e) => setValuacionFiscal(e.target.value)}
                        placeholder="Ej: 50000000"
                        className="h-9"
                    />
                </div>

                {/* Honorarios */}
                <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Honorarios</Label>
                    <Select value={honorariosTipo} onValueChange={setHonorariosTipo}>
                        <SelectTrigger className="h-9">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {HONORARIOS_SUGERIDOS.map((h) => (
                                <SelectItem key={h.value} value={h.value}>
                                    {h.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {honorariosTipo === "custom" && (
                    <div className="space-y-1.5">
                        <Label htmlFor="liq_honorarios_custom" className="text-xs font-medium">
                            Monto Honorarios (ARS)
                        </Label>
                        <Input
                            id="liq_honorarios_custom"
                            type="number"
                            value={honorariosCustom}
                            onChange={(e) => setHonorariosCustom(e.target.value)}
                            className="h-9"
                        />
                    </div>
                )}
            </div>

            {/* ── Switches ── */}
            {!esPoder && (
                <div className="flex flex-wrap gap-x-6 gap-y-3 pt-1">
                    <div className="flex items-center gap-2">
                        <Switch
                            id="liq_vu"
                            checked={esViviendaUnica}
                            onCheckedChange={setEsViviendaUnica}
                        />
                        <Label htmlFor="liq_vu" className="text-xs cursor-pointer">
                            Vivienda Única (exención parcial Sellos)
                        </Label>
                    </div>

                    <div className="flex items-center gap-2">
                        <Switch
                            id="liq_pre2018"
                            checked={fechaAdquisicionAnterior2018}
                            onCheckedChange={setFechaAdquisicionAnterior2018}
                        />
                        <Label htmlFor="liq_pre2018" className="text-xs cursor-pointer">
                            Inmueble adquirido antes del 01/01/2018 (ITI)
                        </Label>
                    </div>

                    <div className="flex items-center gap-2">
                        <Switch
                            id="liq_exencion"
                            checked={tieneExencionITI}
                            onCheckedChange={setTieneExencionITI}
                        />
                        <Label htmlFor="liq_exencion" className="text-xs cursor-pointer">
                            Certificado de No Retención (reemplazo vivienda)
                        </Label>
                    </div>
                </div>
            )}

            {/* ── Tabla de Resultados ── */}
            {calculo && (
                <Card className="shadow-sm border-slate-200 overflow-hidden mt-2">
                    <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50/30 border-b p-4 pb-3">
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <DollarSign className="w-4 h-4 text-blue-600" />
                                    Estimación de Gastos
                                </CardTitle>
                                <CardDescription className="text-[11px] mt-0.5">
                                    Base imponible: {fmt(calculo.baseImponible)}
                                    {calculo.baseImponible === calculo.precioPesos
                                        ? " (precio de venta)"
                                        : " (valuación fiscal)"
                                    }
                                </CardDescription>
                            </div>
                            {calculo.esExento && (
                                <Badge variant="secondary" className="bg-green-100 text-green-700 text-[10px]">
                                    <TrendingDown className="h-3 w-3 mr-1" />
                                    Exento Sellos
                                </Badge>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader className="bg-slate-50/50">
                                <TableRow>
                                    <TableHead className="font-semibold text-[11px] uppercase tracking-wider">Concepto</TableHead>
                                    <TableHead className="text-right font-semibold text-[11px] uppercase tracking-wider">Quién paga</TableHead>
                                    <TableHead className="text-right font-semibold text-[11px] uppercase tracking-wider">Monto</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {/* Sellos */}
                                {!esPoder && (
                                    <TableRow>
                                        <TableCell className="text-sm">
                                            Impuesto de Sellos (PBA — {(TASAS.SELLOS_PBA * 100).toFixed(0)}%)
                                            {esViviendaUnica && (
                                                <span className="text-[10px] text-muted-foreground ml-1">
                                                    (exención VU aplicada)
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right text-xs text-muted-foreground">50/50</TableCell>
                                        <TableCell className="text-right font-medium text-sm">{fmt(calculo.sellos)}</TableCell>
                                    </TableRow>
                                )}

                                {/* ITI / Ganancias */}
                                {!esPoder && (
                                    <TableRow>
                                        <TableCell className="text-sm">
                                            {calculo.labelImpuestoVendedor}
                                        </TableCell>
                                        <TableCell className="text-right text-xs text-muted-foreground">Vendedor</TableCell>
                                        <TableCell className="text-right font-medium text-sm">
                                            {fmt(calculo.iti + calculo.gananciasCedulares)}
                                        </TableCell>
                                    </TableRow>
                                )}

                                {/* Honorarios */}
                                <TableRow>
                                    <TableCell className="text-sm">Honorarios Notariales</TableCell>
                                    <TableCell className="text-right text-xs text-muted-foreground">Según pacto</TableCell>
                                    <TableCell className="text-right font-medium text-sm">{fmt(calculo.honorarios)}</TableCell>
                                </TableRow>

                                {/* IVA */}
                                <TableRow>
                                    <TableCell className="text-sm text-muted-foreground pl-8">└ IVA (21%)</TableCell>
                                    <TableCell className="text-right text-xs text-muted-foreground"></TableCell>
                                    <TableCell className="text-right font-medium text-sm text-muted-foreground">{fmt(calculo.ivaHonorarios)}</TableCell>
                                </TableRow>

                                {/* Aportes */}
                                <TableRow>
                                    <TableCell className="text-sm">Aportes Caja Notarial (0.6%)</TableCell>
                                    <TableCell className="text-right text-xs text-muted-foreground">Escribano</TableCell>
                                    <TableCell className="text-right font-medium text-sm">{fmt(calculo.aporteCaja)}</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell className="text-sm">Aportes Colegio (0.1%)</TableCell>
                                    <TableCell className="text-right text-xs text-muted-foreground">Escribano</TableCell>
                                    <TableCell className="text-right font-medium text-sm">{fmt(calculo.aporteColegio)}</TableCell>
                                </TableRow>

                                {/* Total */}
                                <TableRow className="bg-blue-50/50 border-t-2 border-blue-200">
                                    <TableCell className="font-bold text-blue-900" colSpan={2}>
                                        GASTOS TOTALES (Estimado)
                                    </TableCell>
                                    <TableCell className="text-right font-bold text-blue-900 text-base">
                                        {fmt(calculo.totalGastos)}
                                    </TableCell>
                                </TableRow>

                                {calculo.totalGastosUsd && (
                                    <TableRow className="bg-blue-100/30">
                                        <TableCell className="text-xs text-blue-800 font-medium italic" colSpan={2}>
                                            Equivalente en Dólares (BNA Vendedor)
                                        </TableCell>
                                        <TableCell className="text-right text-xs text-blue-800 font-bold italic">
                                            {fmtUsd(calculo.totalGastosUsd)}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>

                        <div className="p-3 bg-slate-50 flex items-start gap-2 border-t">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                            <p className="text-[10px] leading-relaxed text-muted-foreground">
                                Estimación orientativa basada en tasas vigentes. Los valores finales pueden variar
                                según tasas municipales, cotización del día de firma, y situación fiscal particular
                                de las partes. Tope exención Vivienda Única: {fmt(TASAS.TOPE_EXENCION_VU_2025)} (referencia Ley Impositiva 2025 PBA).
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {!calculo && (
                <div className="border-2 border-dashed border-border rounded-lg py-8 px-4 text-center">
                    <Calculator className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                        Ingrese el precio de la operación para calcular automáticamente los impuestos, honorarios y aportes.
                    </p>
                </div>
            )}
        </div>
    );
}
