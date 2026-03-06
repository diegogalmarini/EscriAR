"use client";

import { useState, useCallback, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Plus, Save, Trash2, ClipboardList, BookOpen,
    AlertTriangle, Check, Loader2, Search,
    ArrowUpDown, ArrowUp, ArrowDown,
    Eye, FolderOpen
} from "lucide-react";

import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PaginationControls } from "@/components/PaginationControls";
import { IndiceProtocolo } from "@/components/IndiceProtocolo";
import { getSignedUrl } from "@/app/actions/storageSync";

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
    pdf_storage_path?: string | null;
    carpeta_id?: string | null;
    // UI state
    _isNew?: boolean;
    _isDirty?: boolean;
}

interface Props {
    registros: ProtocoloRegistro[];
    anio: number;
}

const COLUMN_HEADERS = [
    { key: "nro_escritura", label: "Esc.", width: "w-[60px]", align: "text-center" },
    { key: "folios", label: "Folios", width: "w-[100px]", align: "text-center" },
    { key: "dia", label: "Día", width: "w-[55px]", align: "text-center" },
    { key: "mes", label: "Mes", width: "w-[55px]", align: "text-center" },
    { key: "tipo_acto", label: "Acto", width: "w-[160px]", align: "text-left" },
    { key: "vendedor_acreedor", label: "Vendedor / Acreedor / Poderdante", width: "min-w-[200px] flex-1", align: "text-left" },
    { key: "comprador_deudor", label: "Comprador / Deudor / Apoderado", width: "min-w-[200px] flex-1", align: "text-left" },
    { key: "codigo_acto", label: "Código Acto", width: "w-[120px]", align: "text-center" },
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
    const [sortCol, setSortCol] = useState<string>("folios");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
    const [searchQuery, setSearchQuery] = useState("");
    const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(null);

    // ── Sort handler ──
    const handleSort = useCallback((key: string) => {
        setSortCol(prev => {
            if (prev === key) {
                setSortDir(d => d === "asc" ? "desc" : "asc");
                return key;
            }
            setSortDir("asc");
            return key;
        });
    }, []);

    // ── Filtrado + Ordenamiento + Paginación ──
    const processedData = useMemo(() => {
        let data = registros.map((r, originalIndex) => ({ ...r, _originalIndex: originalIndex }));

        // Filtrar por búsqueda
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            data = data.filter(r =>
                String(r.nro_escritura).includes(q) ||
                (r.tipo_acto || "").toLowerCase().includes(q) ||
                (r.vendedor_acreedor || "").toLowerCase().includes(q) ||
                (r.comprador_deudor || "").toLowerCase().includes(q) ||
                (r.folios || "").toLowerCase().includes(q) ||
                (r.codigo_acto || "").toLowerCase().includes(q)
            );
        }

        // Ordenar
        data.sort((a, b) => {
            const aVal = (a as any)[sortCol];
            const bVal = (b as any)[sortCol];
            if (aVal === null || aVal === undefined || aVal === "") return 1;
            if (bVal === null || bVal === undefined || bVal === "") return -1;
            const cmp = typeof aVal === "number" && typeof bVal === "number"
                ? aVal - bVal
                : String(aVal).localeCompare(String(bVal), "es", { numeric: true });
            return sortDir === "asc" ? cmp : -cmp;
        });

        return data;
    }, [registros, searchQuery, sortCol, sortDir]);

    // ── Paginación ──
    const totalPages = Math.max(1, Math.ceil(processedData.length / pageSize));
    const pageOffset = (currentPage - 1) * pageSize;
    const paginatedRegistros = processedData.slice(pageOffset, pageOffset + pageSize);

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

    // ── Eliminar fila (con confirmación obligatoria) ──
    const confirmDelete = useCallback(async () => {
        if (pendingDeleteIndex === null) return;
        const row = registros[pendingDeleteIndex];
        if (row.id) {
            const { error } = await supabase
                .from("protocolo_registros")
                .delete()
                .eq("id", row.id);
            if (error) {
                toast.error("Error al eliminar: " + error.message);
                setPendingDeleteIndex(null);
                return;
            }
        }
        setRegistros(prev => prev.filter((_, i) => i !== pendingDeleteIndex));
        toast.success(`Escritura ${row.nro_escritura ?? "errose"} eliminada`);
        setPendingDeleteIndex(null);
    }, [registros, pendingDeleteIndex]);

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
        <>
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
                        <div className="relative ml-2">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setCurrentPage(1);
                                }}
                                className="pl-8 h-9 w-[220px]"
                            />
                        </div>
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
                        <div className="flex bg-[#e1e1e1] text-black text-[11px] font-semibold tracking-wide min-w-fit sticky top-0 z-10">
                            {COLUMN_HEADERS.map(col => (
                                <div
                                    key={col.key}
                                    className={cn(
                                        "px-2 py-2.5 border-r border-[#ccc] shrink-0 cursor-pointer select-none hover:bg-[#d5d5d5] transition-colors flex items-center gap-1",
                                        col.width, col.align
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
                            {/* Action column headers */}
                            <div className="w-[72px] shrink-0 px-1 py-2.5 border-r border-[#ccc] text-center" />
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
                            const realIndex = (row as any)._originalIndex;
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
                                        const displayValue = rawValue ?? "";

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
                                                        type={["nro_escritura", "dia", "mes"].includes(col.key) ? "number" : "text"}
                                                        className="w-full h-7 px-1 text-xs border border-blue-400 rounded bg-white outline-none focus:ring-1 focus:ring-blue-400"
                                                        defaultValue={rawValue ?? ""}
                                                        onBlur={(e) => {
                                                            const val = e.target.value;
                                                            const numFields = ["nro_escritura", "dia", "mes"];
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

                                    {/* Action buttons: PDF + Carpeta + Delete */}
                                    <div className="w-[72px] shrink-0 flex items-center justify-center gap-0.5">
                                        <button
                                            onClick={async () => {
                                                if (row.pdf_storage_path) {
                                                    const result = await getSignedUrl("protocolo", row.pdf_storage_path);
                                                    if (result.success && result.url) {
                                                        window.open(result.url, "_blank");
                                                    } else {
                                                        toast.error("Error al obtener el PDF");
                                                    }
                                                }
                                            }}
                                            disabled={!row.pdf_storage_path}
                                            className={cn(
                                                "p-1 rounded transition-all",
                                                row.pdf_storage_path
                                                    ? "text-blue-500 hover:text-blue-700 hover:bg-blue-50 cursor-pointer"
                                                    : "text-slate-300 cursor-not-allowed"
                                            )}
                                            title={row.pdf_storage_path ? "Ver PDF" : "Sin PDF cargado"}
                                        >
                                            <Eye className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                            disabled={!row.carpeta_id}
                                            className={cn(
                                                "p-1 rounded transition-all",
                                                row.carpeta_id
                                                    ? "text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                                                    : "text-slate-300 cursor-not-allowed"
                                            )}
                                            title={row.carpeta_id ? "Ir a carpeta" : "Sin carpeta vinculada"}
                                        >
                                            <FolderOpen className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                            onClick={() => setPendingDeleteIndex(realIndex)}
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
                    totalItems={processedData.length}
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

            {/* ── Modal de confirmación de borrado ── */}
            <AlertDialog open={pendingDeleteIndex !== null} onOpenChange={(open) => { if (!open) setPendingDeleteIndex(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar este registro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {pendingDeleteIndex !== null && registros[pendingDeleteIndex] && (
                                <>
                                    Estás por eliminar{" "}
                                    <strong>
                                        {registros[pendingDeleteIndex].es_errose
                                            ? `Errose (folios ${registros[pendingDeleteIndex].folios})`
                                            : `Escritura ${registros[pendingDeleteIndex].nro_escritura} — ${registros[pendingDeleteIndex].tipo_acto || "sin tipo"}`
                                        }
                                    </strong>.
                                    Esta acción no se puede deshacer.
                                </>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
