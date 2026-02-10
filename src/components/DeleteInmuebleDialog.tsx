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
import { deleteInmueble } from "@/app/actions/inmuebles";
import { toast } from "sonner";

import { useRouter } from "next/navigation";

interface DeleteInmuebleDialogProps {
    inmuebleId: string;
    nomenclatura?: string;
    onInmuebleDeleted?: () => void;
    redirectTo?: string;
}

export function DeleteInmuebleDialog({ inmuebleId, nomenclatura, onInmuebleDeleted, redirectTo }: DeleteInmuebleDialogProps) {
    const [open, setOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const router = useRouter();

    const handleDelete = async () => {
        setIsDeleting(true);
        const res = await deleteInmueble(inmuebleId);
        setIsDeleting(false);

        if (res.success) {
            toast.success("Inmueble eliminado correctamente");
            setOpen(false);
            if (onInmuebleDeleted) {
                onInmuebleDeleted();
            } else if (redirectTo) {
                router.push(redirectTo);
            } else {
                window.location.reload();
            }
        } else {
            // Error handling for foreign key or general failure
            toast.error(res.error || "No se pudo eliminar el inmueble. Verifique si está vinculado a una escritura.", {
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
                        Esta acción no se puede deshacer. Se eliminará el inmueble {nomenclatura ? `"${nomenclatura}"` : ""} de la base de datos permanentemente.
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
