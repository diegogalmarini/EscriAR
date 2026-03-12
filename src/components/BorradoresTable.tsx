"use client";

import { useState, useEffect } from "react";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Calculator, Trash2, Edit, FolderInput, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getBorradores, deleteBorrador, type Borrador } from "@/app/actions/borradores";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";

export function BorradoresTable() {
    const [borradores, setBorradores] = useState<Borrador[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleteTarget, setDeleteTarget] = useState<Borrador | null>(null);
    const [deleting, setDeleting] = useState(false);

    const loadBorradores = async () => {
        setLoading(true);
        try {
            const res = await getBorradores();
            if (res.success && res.data) {
                setBorradores(res.data);
            }
        } catch {
            // silently fail on dashboard
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadBorradores();
    }, []);

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        const res = await deleteBorrador(deleteTarget.id);
        if (res.success) {
            toast.success("Borrador eliminado");
            loadBorradores();
        } else {
            toast.error(res.error || "Error al eliminar");
        }
        setDeleting(false);
        setDeleteTarget(null);
    };

    if (loading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
        );
    }

    if (borradores.length === 0) {
        return (
            <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-lg">
                <FileText className="mx-auto h-10 w-10 text-slate-200 mb-3" />
                <p className="text-sm text-muted-foreground">
                    No hay borradores aún. Creá un documento o presupuesto para empezar.
                </p>
            </div>
        );
    }

    return (
        <>
            <div className="rounded-md border border-slate-200 overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                            <TableHead>Nombre</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Acto</TableHead>
                            <TableHead>Fecha</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {borradores.map((b) => (
                            <TableRow key={b.id} className="group">
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                        {b.tipo === "DOCUMENTO" ? (
                                            <FileText size={16} className="text-blue-500" />
                                        ) : (
                                            <Calculator size={16} className="text-emerald-500" />
                                        )}
                                        {b.nombre}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="outline" className="text-xs">
                                        {b.tipo === "DOCUMENTO"
                                            ? (b.instrument_category === "INSTRUMENTO_PRIVADO"
                                                ? "Inst. Privado"
                                                : b.instrument_category === "ESCRITURA_PUBLICA"
                                                    ? "Escritura"
                                                    : "Documento")
                                            : "Presupuesto"}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-sm text-slate-500">
                                    {b.act_type || "—"}
                                </TableCell>
                                <TableCell className="text-sm text-slate-500">
                                    {new Date(b.updated_at).toLocaleDateString("es-AR", {
                                        day: "numeric",
                                        month: "short",
                                        year: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                    })}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                                            title="Editar"
                                            disabled
                                        >
                                            <Edit size={16} />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                                            title="Convertir en Carpeta"
                                            disabled
                                        >
                                            <FolderInput size={16} />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                            title="Eliminar"
                                            onClick={() => setDeleteTarget(b)}
                                        >
                                            <Trash2 size={16} />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <ConfirmDeleteDialog
                open={!!deleteTarget}
                onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
                onConfirm={handleDelete}
                loading={deleting}
                description={
                    deleteTarget
                        ? `Se eliminará el borrador "${deleteTarget.nombre}". Esta acción no se puede deshacer.`
                        : ""
                }
            />
        </>
    );
}
