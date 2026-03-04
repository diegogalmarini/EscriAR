"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Edit2 } from "lucide-react";
import { PersonForm } from "./PersonForm";

interface Persona {
    id?: string;
    dni: string;
    cuit?: string;
    nombre_completo: string;
    nacionalidad?: string;
    fecha_nacimiento?: string;
    estado_civil_detalle?: string;
    nombres_padres?: string;
    datos_conyuge?: { nombre?: string; nombre_completo?: string };
    domicilio_real?: { literal?: string } | string;
    contacto?: {
        email?: string;
        telefono?: string;
    };
    profesion?: string;
    regimen_patrimonial?: string;
    nro_documento_conyugal?: string;
    tipo_persona?: string;
    cuit_tipo?: string;
    cuit_is_formal?: boolean;
}

interface EditarClienteDialogProps {
    persona: Persona;
}

export function EditarClienteDialog({ persona }: EditarClienteDialogProps) {
    const [open, setOpen] = useState(false);
    const router = useRouter();

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="group-hover:bg-slate-100">
                    <Edit2 size={16} />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Editar Cliente</DialogTitle>
                    <DialogDescription>
                        Modifique los datos personales y vinculaciones. Los cambios se aplicarán globalmente.
                    </DialogDescription>
                </DialogHeader>

                <PersonForm
                    initialData={persona}
                    onSuccess={() => {
                        setOpen(false);
                        router.refresh();
                    }}
                    onCancel={() => setOpen(false)}
                />
            </DialogContent>
        </Dialog>
    );
}

