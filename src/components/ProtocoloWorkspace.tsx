"use client";

import { useState, useCallback, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Plus, Trash2, ClipboardList, BookOpen,
    AlertTriangle, Search,
    ArrowUpDown, ArrowUp, ArrowDown,
    Eye, FolderOpen, ExternalLink, Pencil, Loader2
} from "lucide-react";

import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
    AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PaginationControls } from "@/components/PaginationControls";
import { IndiceProtocolo } from "@/components/IndiceProtocolo";
import { getSignedUrl } from "@/app/actions/storageSync";
import { deleteProtocoloRegistro, ProtocoloRegistro } from "@/app/actions/protocolo";
import { EscrituraDialog } from "@/components/EscrituraDialog";

interface Props {
    registros: ProtocoloRegistro[];
    anio: number;
}

const COLUMN_HEADERS = [
    { key: "nro_escritura", label: "Esc.", width: "w-[60px]", align: "text-center" },
    { key: "folios", label: "Folios", width: "w-[100px]", align: "text-center" },
    { key: "dia", label: "Día", width: "w-[55px]", align: "text-center" },
    { key: "mes", label: "Mes", width: "w-[55px]", align: "text-center" },
    { key: "tipo_acto", label: "Acto", width: "w-[180px]", align: "text-left" },
    { key: "vendedor_acreedor", label: "Vendedor / Acreedor / Poderdante", width: "min-w-[220px] flex-1", align: "text-left" },
    { key: "comprador_deudor", label: "Comprador / Deudor / Apoderado", width: "min-w-[220px] flex-1", align: "text-left" },
    { key: "codigo_acto", label: "Código Acto", width: "w-[120px]", align: "text-center" },
];

export function ProtocoloWorkspace({ registros: initialRegistros, anio }: Props) {
    const [registros, setRegistros] = useState<ProtocoloRegistro[]>(initialRegistros);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [sortCol, setSortCol] = useState<string>("folios");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
    const [searchQuery, setSearchQuery] = useState("");
    const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(null);
    const [deleting, setDeleting] = useState(false);

    // Dialog state
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingRegistro, setEditingRegistro] = useState<ProtocoloRegistro | undefined>(undefined);

    // ── Computed: next escritura number ──
    const nextNro = useMemo(() => {
        const nums = registros.map(r => r.nro_escritura).filter((n): n is number => n !== null);
        return nums.length > 0 ? Math.max(...nums) + 1 : 1;
    }, [registros]);

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

    const totalPages = Math.max(1, Math.ceil(processedData.length / pageSize));
    const pageOffset = (currentPage - 1) * pageSize;
    const paginatedRegistros = processedData.slice(pageOffset, pageOffset + pageSize);

    // ── Open dialog for new escritura ──
    const openNewDialog = useCallback(() => {
        setEditingRegistro(undefined);
        setDialogOpen(true);
    }, []);

    // ── Open dialog for editing ──
    const openEditDialog = useCallback((row: ProtocoloRegistro) => {
        setEditingRegistro(row);
        setDialogOpen(true);
    }, []);

    // ── Refresh after dialog save - reload from server ──
    const handleDialogSuccess = useCallback(() => {
        // Trigger a full page refresh to get fresh data from server
        window.location.reload();
    }, []);

    // ── Delete with confirmation ──
    const confirmDelete = useCallback(async () => {
        if (pendingDeleteIndex === null) return;
        const row = registros[pendingDeleteIndex];
        if (!row.id) return;

        setDeleting(true);
        try {
            await deleteProtocoloRegistro(row.id);
            setRegistros(prev => prev.filter((_, i) => i !== pendingDeleteIndex));
            toast.success(`Escritura ${row.nro_escritura ?? "errose"} eliminada`);
        } catch (error: any) {
            toast.error("Error al eliminar: " + error.message);
        } finally {
            setDeleting(false);
            setPendingDeleteIndex(null);
        }
    }, [registros, pendingDeleteIndex]);

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
                            <Button onClick={openNewDialog} size="sm" variant="outline" className="gap-1.5">
                                <Plus className="h-4 w-4" /> Nueva Escritura
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
                        <Badge variant="secondary" className="text-xs text-slate-500">
                            {registros.length} registros
                        </Badge>
                    </div>

                    {/* Spreadsheet (read-only) */}
                    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
                        <div className="overflow-x-auto">
                            {/* Header row */}
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
                                {/* Action column header */}
                                <div className="w-[90px] shrink-0 px-1 py-2.5 border-r border-[#ccc] text-center" />
                            </div>

                            {/* Empty state */}
                            {registros.length === 0 && (
                                <div className="py-16 text-center text-muted-foreground text-sm">
                                    <ClipboardList className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                                    <p>No hay escrituras registradas en el protocolo {anio}.</p>
                                    <p className="text-xs mt-1">Presione &quot;Nueva Escritura&quot; para agregar la primera.</p>
                                </div>
                            )}

                            {/* Data rows (read-only) */}
                            {paginatedRegistros.map((row, localIndex) => {
                                const realIndex = (row as any)._originalIndex;
                                const isErrose = row.es_errose || row.tipo_acto?.toLowerCase().includes("errose");
                                const isEven = localIndex % 2 === 0;

                                return (
                                    <div
                                        key={row.id || `row-${realIndex}`}
                                        className={cn(
                                            "flex min-w-fit border-b border-slate-100 group",
                                            isErrose
                                                ? "bg-amber-50/70"
                                                : isEven
                                                    ? "bg-white"
                                                    : "bg-slate-50/50"
                                        )}
                                    >
                                        {COLUMN_HEADERS.map(col => {
                                            const rawValue = (row as any)[col.key];
                                            const displayValue = rawValue ?? "";

                                            return (
                                                <div
                                                    key={col.key}
                                                    className={cn(
                                                        "px-1 py-0.5 border-r border-slate-100 shrink-0 flex items-start",
                                                        col.width, col.align
                                                    )}
                                                >
                                                    <span className={cn(
                                                        "w-full text-xs break-words px-1 py-1 rounded min-h-[28px] flex items-start",
                                                        col.align === "text-right" && "justify-end",
                                                        col.align === "text-center" && "justify-center",
                                                        isErrose && col.key === "tipo_acto" && "text-amber-700 font-semibold italic"
                                                    )}>
                                                        {displayValue}
                                                        {(col.key === "vendedor_acreedor" || col.key === "comprador_deudor") && displayValue && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    window.open(`/clientes?q=${encodeURIComponent(String(displayValue).trim())}`, "_blank");
                                                                }}
                                                                className="ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-indigo-50 text-indigo-400 hover:text-indigo-600"
                                                                title="Buscar en Clientes"
                                                            >
                                                                <ExternalLink className="h-3 w-3" />
                                                            </button>
                                                        )}
                                                    </span>
                                                </div>
                                            );
                                        })}

                                        {/* Action buttons: Edit + PDF + Carpeta + Delete */}
                                        <div className="w-[90px] shrink-0 flex items-center justify-center gap-0.5">
                                            <button
                                                onClick={() => openEditDialog(row)}
                                                className="p-1 rounded transition-all text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                                                title="Editar"
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </button>
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
                                                onClick={() => {
                                                    if (row.carpeta_id) {
                                                        window.open(`/carpeta/${row.carpeta_id}`, "_blank");
                                                    }
                                                }}
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
                                                title="Eliminar"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

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

            {/* ── Escritura Dialog (Create / Edit) ── */}
            <EscrituraDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                registro={editingRegistro}
                anio={anio}
                nextNro={nextNro}
                onSuccess={handleDialogSuccess}
            />

            {/* ── Delete confirmation ── */}
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
                                    {registros[pendingDeleteIndex].pdf_storage_path && (
                                        <> El PDF asociado también será eliminado.</>
                                    )}
                                </>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            disabled={deleting}
                            className="bg-red-600 hover:bg-red-700 text-white"
                        >
                            {deleting ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Eliminando...</> : "Eliminar"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
