"use client";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import { useState } from "react";
import { deleteCarpeta } from "@/app/actions/carpeta";
import { toast } from "sonner";

interface DeleteCarpetaDialogProps {
    carpetaId: string;
    caratula?: string;
    onCarpetaDeleted?: () => void;
}

export function DeleteCarpetaDialog({ carpetaId, caratula, onCarpetaDeleted }: DeleteCarpetaDialogProps) {
    const [open, setOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        setIsDeleting(true);
        const res = await deleteCarpeta(carpetaId);
        setIsDeleting(false);

        if (res.success) {
            toast.success("Carpeta eliminada correctamente");
            setOpen(false);
            if (onCarpetaDeleted) {
                onCarpetaDeleted();
            } else {
                window.location.reload();
            }
        } else {
            toast.error(res.error || "No se pudo eliminar la carpeta.", {
                duration: 5000
            });
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-50 text-red-600">
                    <Trash2 size={16} />
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Esta acción no se puede deshacer. Se eliminará la carpeta {caratula ? `"${caratula}"` : ""} con todas sus escrituras, operaciones y archivos asociados.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={(e) => {
                            e.preventDefault();
                            handleDelete();
                        }}
                        className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                        disabled={isDeleting}
                    >
                        {isDeleting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Eliminando...
                            </>
                        ) : (
                            "Eliminar"
                        )}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
