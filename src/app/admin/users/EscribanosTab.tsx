"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import {
    Trash2,
    Edit,
    Star,
    UserPlus,
    MapPin,
    FileText,
    Award,
    Phone,
    Mail,
    Building
} from "lucide-react";
import { Escribano, deleteEscribano, setDefaultEscribano } from "@/app/actions/escribanos";
import { NuevoEscribanoDialog } from "./NuevoEscribanoDialog";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface EscribanosTabProps {
    escribanos: Escribano[];
    loading: boolean;
    onRefresh: () => void;
}

export function EscribanosTab({ escribanos, loading, onRefresh }: EscribanosTabProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [currentEscribano, setCurrentEscribano] = useState<Escribano | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    const handleDeleteConfirm = async () => {
        if (!deleteTargetId) return;
        setDeleting(true);
        const res = await deleteEscribano(deleteTargetId);
        if (res.success) {
            toast.success("Escribano eliminado correctamente");
            onRefresh();
        } else {
            toast.error(res.error || "Error al eliminar");
        }
        setDeleting(false);
        setDeleteTargetId(null);
    };

    const handleSetDefault = async (id: string) => {
        const res = await setDefaultEscribano(id);
        if (res.success) {
            toast.success("Escribano predeterminado actualizado");
            onRefresh();
        } else {
            toast.error(res.error || "Error al actualizar");
        }
    };

    const handleEdit = (escribano: Escribano) => {
        setCurrentEscribano(escribano);
        setIsEditing(true);
        setIsDialogOpen(true);
    };

    const handleNew = () => {
        setCurrentEscribano(null);
        setIsEditing(false);
        setIsDialogOpen(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Escribanos Autorizantes</h2>
                    <p className="text-slate-500">Gestión de los firmantes oficiales de la notaría</p>
                </div>
                <Button onClick={handleNew} className="bg-blue-600 hover:bg-blue-700">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Nuevo Escribano
                </Button>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {loading ? (
                    <div className="py-10 text-center text-slate-400">Cargando escribanos...</div>
                ) : escribanos.length === 0 ? (
                    <Card className="border-dashed border-2">
                        <CardContent className="py-12 text-center">
                            <Award className="mx-auto h-12 w-12 text-slate-300 mb-4" />
                            <p className="text-slate-500">No hay escribanos registrados todavía.</p>
                            <Button variant="outline" className="mt-4" onClick={handleNew}>
                                Agregar el primero
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    escribanos.map((esc) => (
                        <Card key={esc.id} className={cn(
                            "overflow-hidden border-slate-200 transition-all hover:shadow-md",
                            esc.is_default && "border-blue-200 bg-blue-50/30 ring-1 ring-blue-100"
                        )}>
                            <CardContent className="p-0">
                                <div className="flex flex-col md:flex-row">
                                    <div className="p-6 flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="text-xl font-bold text-slate-900">{esc.nombre_completo}</h3>
                                            <Badge variant="secondary" className="bg-slate-100 text-slate-700">
                                                {esc.caracter === 'A_CARGO' ? 'A CARGO' : esc.caracter}
                                            </Badge>
                                            {esc.is_default && (
                                                <Badge className="bg-blue-600">
                                                    PREDETERMINADO
                                                </Badge>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 gap-x-8 text-sm text-slate-600">
                                            <div className="flex items-center gap-2">
                                                <Award size={14} className="text-slate-400 shrink-0" />
                                                <span>Registro N° {esc.numero_registro || 'N/A'} - {esc.distrito_notarial || 'N/A'}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <FileText size={14} className="text-slate-400 shrink-0" />
                                                <span>Matrícula: {esc.matricula || 'N/A'}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <MapPin size={14} className="text-slate-400 shrink-0" />
                                                <span>{esc.domicilio_legal || 'Sin domicilio legal'}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Building size={14} className="text-slate-400 shrink-0" />
                                                <span>CUIT: {esc.cuit || 'N/A'}</span>
                                            </div>
                                            {esc.telefono && (
                                                <div className="flex items-center gap-2">
                                                    <Phone size={14} className="text-slate-400 shrink-0" />
                                                    <span>{esc.telefono}</span>
                                                </div>
                                            )}
                                            {esc.email && (
                                                <div className="flex items-center gap-2">
                                                    <Mail size={14} className="text-slate-400 shrink-0" />
                                                    <span>{esc.email}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="bg-slate-50/50 border-t md:border-t-0 md:border-l border-slate-100 p-4 flex md:flex-col justify-center gap-2">
                                        {!esc.is_default && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 justify-start"
                                                onClick={() => handleSetDefault(esc.id)}
                                            >
                                                <Star size={16} className="mr-2" />
                                                <span className="hidden md:inline">Hacer Predeterminado</span>
                                                <span className="md:hidden">Predet.</span>
                                            </Button>
                                        )}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-slate-600 hover:text-slate-900 hover:bg-slate-200 justify-start"
                                            onClick={() => handleEdit(esc)}
                                        >
                                            <Edit size={16} className="mr-2" />
                                            <span>Editar</span>
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-red-600 hover:text-red-700 hover:bg-red-50 justify-start"
                                            onClick={() => setDeleteTargetId(esc.id)}
                                        >
                                            <Trash2 size={16} className="mr-2" />
                                            <span>Eliminar</span>
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            <NuevoEscribanoDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                onSuccess={() => {
                    setIsDialogOpen(false);
                    onRefresh();
                }}
                escribano={currentEscribano}
                mode={isEditing ? 'edit' : 'create'}
            />

            <ConfirmDeleteDialog
                open={!!deleteTargetId}
                onOpenChange={(open) => { if (!open) setDeleteTargetId(null); }}
                onConfirm={handleDeleteConfirm}
                loading={deleting}
                description="Se eliminará este escribano del sistema. Esta acción no se puede deshacer."
            />
        </div>
    );
}
