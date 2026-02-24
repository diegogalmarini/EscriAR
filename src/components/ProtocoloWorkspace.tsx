"use client";

import { useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Plus, Save, Trash2, ClipboardList, BookOpen,
    AlertTriangle, Check, Loader2
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PaginationControls } from "@/components/PaginationControls";
import { IndiceProtocolo } from "@/components/IndiceProtocolo";

interface ProtocoloRegistro {
    id?: string;
    nro_escritura: number;
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
    notas: string;
    // UI state
    _isNew?: boolean;
    _isDirty?: boolean;
}

interface Props {
    registros: ProtocoloRegistro[];
    anio: number;
}

const COLUMN_HEADERS = [
    { key: "nro_escritura", label: "ESC", width: "w-[60px]", align: "text-center" },
    { key: "folios", label: "FOLIOS", width: "w-[100px]", align: "text-center" },
    { key: "dia", label: "DÍA", width: "w-[55px]", align: "text-center" },
    { key: "mes", label: "MES", width: "w-[55px]", align: "text-center" },
    { key: "tipo_acto", label: "ACTO", width: "w-[160px]", align: "text-left" },
    { key: "vendedor_acreedor", label: "VENDEDOR / ACREEDOR / PODERDANTE", width: "min-w-[200px] flex-1", align: "text-left" },
    { key: "comprador_deudor", label: "COMPRADOR / DEUDOR / APODERADO", width: "min-w-[200px] flex-1", align: "text-left" },
    { key: "monto_usd", label: "USD", width: "w-[120px]", align: "text-right" },
    { key: "monto_ars", label: "$", width: "w-[140px]", align: "text-right" },
    { key: "codigo_acto", label: "CÓDIGO ACTO", width: "w-[120px]", align: "text-center" },
];

function emptyRow(anio: number, nextNro: number): ProtocoloRegistro {
    return {
        nro_escritura: nextNro,
        folios: "",
        dia: null,
        mes: null,
        anio,
        tipo_acto: "",
        es_errose: false,
        vendedor_acreedor: "",
        comprador_deudor: "",
        monto_usd: null,
        monto_ars: null,
        codigo_acto: "",
        notas: "",
        _isNew: true,
        _isDirty: true,
    };
}

export function ProtocoloWorkspace({ registros: initialRegistros, anio }: Props) {
    const [registros, setRegistros] = useState<ProtocoloRegistro[]>(
        initialRegistros.map(r => ({ ...r, _isNew: false, _isDirty: false }))
    );
    const [saving, setSaving] = useState(false);
    const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // ── Paginación ──
    const totalPages = Math.max(1, Math.ceil(registros.length / pageSize));
    const pageOffset = (currentPage - 1) * pageSize;
    const paginatedRegistros = registros.slice(pageOffset, pageOffset + pageSize);

    // ── Agregar fila ──
    const addRow = useCallback(() => {
        const maxNro = registros.length > 0
            ? Math.max(...registros.map(r => r.nro_escritura))
            : 0;
        setRegistros(prev => [...prev, emptyRow(anio, maxNro + 1)]);
    }, [registros, anio]);

    // ── Agregar fila errose ──
    const addErrose = useCallback(() => {
        const maxNro = registros.length > 0
            ? Math.max(...registros.map(r => r.nro_escritura))
            : 0;
        const row = emptyRow(anio, maxNro + 1);
        row.tipo_acto = "errose";
        row.es_errose = true;
        setRegistros(prev => [...prev, row]);
    }, [registros, anio]);

    // ── Actualizar celda ──
    const updateCell = useCallback((index: number, key: string, value: any) => {
        setRegistros(prev => {
            const updated = [...prev];
            const row = { ...updated[index] };
            (row as any)[key] = value;
            row._isDirty = true;

            // Auto-detect errose
            if (key === "tipo_acto") {
                row.es_errose = value.toLowerCase().includes("errose");
            }

            updated[index] = row;
            return updated;
        });
    }, []);

    // ── Eliminar fila ──
    const deleteRow = useCallback(async (index: number) => {
        const row = registros[index];
        if (row.id) {
            const { error } = await supabase
                .from("protocolo_registros")
                .delete()
                .eq("id", row.id);
            if (error) {
                toast.error("Error al eliminar: " + error.message);
                return;
            }
        }
        setRegistros(prev => prev.filter((_, i) => i !== index));
        toast.success(`Escritura ${row.nro_escritura} eliminada`);
    }, [registros]);

    // ── Guardar todo ──
    const saveAll = useCallback(async () => {
        const dirtyRows = registros.filter(r => r._isDirty);
        if (dirtyRows.length === 0) {
            toast.info("No hay cambios para guardar");
            return;
        }

        setSaving(true);
        let errors = 0;

        for (const row of dirtyRows) {
            const payload = {
                nro_escritura: row.nro_escritura,
                folios: row.folios || null,
                dia: row.dia,
                mes: row.mes,
                anio: row.anio,
                tipo_acto: row.tipo_acto || null,
                es_errose: row.es_errose,
                vendedor_acreedor: row.vendedor_acreedor || null,
                comprador_deudor: row.comprador_deudor || null,
                monto_usd: row.monto_usd,
                monto_ars: row.monto_ars,
                codigo_acto: row.codigo_acto || null,
                notas: row.notas || null,
            };

            if (row._isNew) {
                const { data, error } = await supabase
                    .from("protocolo_registros")
                    .insert(payload)
                    .select()
                    .single();
                if (error) {
                    toast.error(`Error fila ${row.nro_escritura}: ${error.message}`);
                    errors++;
                } else {
                    // Update with real ID
                    setRegistros(prev => prev.map(r =>
                        r.nro_escritura === row.nro_escritura && r._isNew
                            ? { ...r, id: data.id, _isNew: false, _isDirty: false }
                            : r
                    ));
                }
            } else if (row.id) {
                const { error } = await supabase
                    .from("protocolo_registros")
                    .update(payload)
                    .eq("id", row.id);
                if (error) {
                    toast.error(`Error fila ${row.nro_escritura}: ${error.message}`);
                    errors++;
                } else {
                    setRegistros(prev => prev.map(r =>
                        r.id === row.id ? { ...r, _isDirty: false } : r
                    ));
                }
            }
        }

        setSaving(false);
        if (errors === 0) {
            toast.success(`${dirtyRows.length} registro(s) guardados`);
        }
    }, [registros]);

    const hasDirtyRows = registros.some(r => r._isDirty);

    // ── Format helpers ──
    const fmtMoney = (val: number | null) => {
        if (val === null || val === undefined) return "";
        return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(val);
    };

    return (
        <Tabs defaultValue="seguimiento" className="space-y-4">
            <TabsList className="bg-slate-100">
                <TabsTrigger value="seguimiento" className="gap-2">
                    <ClipboardList className="h-4 w-4" />
                    Seguimiento de Escrituras
                </TabsTrigger>
                <TabsTrigger value="indice" className="gap-2">
                    <BookOpen className="h-4 w-4" />
                    Índice del Protocolo {anio}
                </TabsTrigger>
            </TabsList>

            {/* ── TAB 1: Seguimiento ── */}
            <TabsContent value="seguimiento" className="space-y-4">
                {/* Toolbar */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                        <Button onClick={addRow} size="sm" variant="outline" className="gap-1.5">
                            <Plus className="h-4 w-4" /> Nueva Escritura
                        </Button>
                        <Button onClick={addErrose} size="sm" variant="outline" className="gap-1.5 text-amber-700 border-amber-300 hover:bg-amber-50">
                            <AlertTriangle className="h-4 w-4" /> Errose
                        </Button>
                    </div>
                    <div className="flex items-center gap-2">
                        {hasDirtyRows && (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-800 text-xs">
                                Cambios sin guardar
                            </Badge>
                        )}
                        <Button
                            onClick={saveAll}
                            size="sm"
                            disabled={!hasDirtyRows || saving}
                            className="gap-1.5"
                        >
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Guardar Todo
                        </Button>
                    </div>
                </div>

                {/* Spreadsheet */}
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
                    <div className="overflow-x-auto">
                        {/* Header row — sticky */}
                        <div className="flex bg-[#4472C4] text-white text-[11px] font-bold uppercase tracking-wide min-w-fit sticky top-0 z-10">
                            {COLUMN_HEADERS.map(col => (
                                <div
                                    key={col.key}
                                    className={cn(
                                        "px-2 py-2.5 border-r border-[#3563a8] shrink-0",
                                        col.width, col.align
                                    )}
                                >
                                    {col.label}
                                </div>
                            ))}
                            <div className="w-[40px] shrink-0 px-1 py-2.5" />
                        </div>

                        {/* Data rows */}
                        {registros.length === 0 && (
                            <div className="py-16 text-center text-muted-foreground text-sm">
                                <ClipboardList className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                                <p>No hay escrituras registradas en el protocolo {anio}.</p>
                                <p className="text-xs mt-1">Presione &quot;Nueva Escritura&quot; para agregar la primera fila.</p>
                            </div>
                        )}

                        {paginatedRegistros.map((row, localIndex) => {
                            const realIndex = pageOffset + localIndex;
                            const isErrose = row.es_errose || row.tipo_acto?.toLowerCase().includes("errose");
                            const isEven = localIndex % 2 === 0;

                            return (
                                <div
                                    key={row.id || `new-${realIndex}`}
                                    className={cn(
                                        "flex min-w-fit border-b border-slate-100 group",
                                        isErrose
                                            ? "bg-amber-50/70"
                                            : isEven
                                                ? "bg-white"
                                                : "bg-slate-50/50",
                                        row._isDirty && "ring-1 ring-inset ring-blue-200"
                                    )}
                                >
                                    {COLUMN_HEADERS.map(col => {
                                        const isEditing = editingCell?.row === realIndex && editingCell?.col === col.key;
                                        const rawValue = (row as any)[col.key];
                                        const displayValue = (col.key === "monto_usd" || col.key === "monto_ars")
                                            ? fmtMoney(rawValue)
                                            : rawValue ?? "";

                                        return (
                                            <div
                                                key={col.key}
                                                className={cn(
                                                    "px-1 py-0.5 border-r border-slate-100 shrink-0 flex items-center",
                                                    col.width, col.align
                                                )}
                                                onClick={() => setEditingCell({ row: realIndex, col: col.key })}
                                            >
                                                {isEditing ? (
                                                    <input
                                                        autoFocus
                                                        type={["nro_escritura", "dia", "mes", "monto_usd", "monto_ars"].includes(col.key) ? "number" : "text"}
                                                        className="w-full h-7 px-1 text-xs border border-blue-400 rounded bg-white outline-none focus:ring-1 focus:ring-blue-400"
                                                        defaultValue={rawValue ?? ""}
                                                        onBlur={(e) => {
                                                            const val = e.target.value;
                                                            const numFields = ["nro_escritura", "dia", "mes", "monto_usd", "monto_ars"];
                                                            updateCell(
                                                                realIndex,
                                                                col.key,
                                                                numFields.includes(col.key) ? (val ? parseFloat(val) : null) : val
                                                            );
                                                            setEditingCell(null);
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                                                            if (e.key === "Escape") setEditingCell(null);
                                                        }}
                                                    />
                                                ) : (
                                                    <span className={cn(
                                                        "w-full text-xs truncate px-1 py-1 cursor-text rounded hover:bg-blue-50/50 min-h-[28px] flex items-center",
                                                        col.align === "text-right" && "justify-end",
                                                        col.align === "text-center" && "justify-center",
                                                        isErrose && col.key === "tipo_acto" && "text-amber-700 font-semibold italic"
                                                    )}>
                                                        {displayValue}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}

                                    {/* Delete button */}
                                    <div className="w-[40px] shrink-0 flex items-center justify-center">
                                        <button
                                            onClick={() => deleteRow(realIndex)}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600"
                                            title="Eliminar fila"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer con paginación — mismo componente que el resto del sitio */}
                <PaginationControls
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={registros.length}
                    pageSize={pageSize}
                    onPageChange={setCurrentPage}
                    onPageSizeChange={setPageSize}
                />
            </TabsContent>

            {/* ── TAB 2: Índice ── */}
            <TabsContent value="indice">
                <IndiceProtocolo registros={registros} anio={anio} />
            </TabsContent>
        </Tabs>
    );
}
