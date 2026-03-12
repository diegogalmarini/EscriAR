"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { FolderPlus, FilePlus, Calculator } from "lucide-react";
import { toast } from "sonner";
import { createFolder } from "@/app/actions/carpeta";

export function DashboardActions() {
    const router = useRouter();
    const [creatingFolder, setCreatingFolder] = useState(false);
    const [showDocDialog, setShowDocDialog] = useState(false);
    const [showPresupDialog, setShowPresupDialog] = useState(false);

    const handleNewCarpeta = async () => {
        setCreatingFolder(true);
        try {
            const res = await createFolder("Nueva Carpeta Manual");
            if (res.success && res.carpetaId) {
                toast.success("Carpeta creada");
                router.push(`/carpeta/${res.carpetaId}`);
            } else {
                toast.error(res.error || "Error al crear carpeta");
            }
        } catch {
            toast.error("Error al crear carpeta");
        } finally {
            setCreatingFolder(false);
        }
    };

    return (
        <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* +NUEVA CARPETA */}
                <Button
                    onClick={handleNewCarpeta}
                    disabled={creatingFolder}
                    className="h-14 text-base font-semibold shadow-lg shadow-primary/20 gap-2"
                >
                    <FolderPlus className="h-5 w-5" />
                    {creatingFolder ? "Creando..." : "Nueva Carpeta"}
                </Button>

                {/* +NUEVO DOCUMENTO */}
                <Button
                    variant="outline"
                    onClick={() => setShowDocDialog(true)}
                    className="h-14 text-base font-semibold border-2 border-slate-300 hover:border-slate-400 gap-2"
                >
                    <FilePlus className="h-5 w-5" />
                    Nuevo Documento
                </Button>

                {/* +NUEVO PRESUPUESTO */}
                <Button
                    variant="outline"
                    onClick={() => setShowPresupDialog(true)}
                    className="h-14 text-base font-semibold border-2 border-slate-300 hover:border-slate-400 gap-2"
                >
                    <Calculator className="h-5 w-5" />
                    Nuevo Presupuesto
                </Button>
            </div>

            {/* Dialog: Nuevo Documento (placeholder Fase 3) */}
            <Dialog open={showDocDialog} onOpenChange={setShowDocDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Nuevo Documento</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-4">
                        <p className="text-sm text-muted-foreground mb-4">
                            Elegí el tipo de documento a crear:
                        </p>
                        <Button
                            variant="outline"
                            className="w-full h-12 justify-start gap-3 text-left"
                            disabled
                        >
                            <FilePlus className="h-5 w-5 text-blue-600" />
                            <div>
                                <div className="font-medium">Escritura</div>
                                <div className="text-xs text-muted-foreground">Basada en un modelo de escritura pública</div>
                            </div>
                        </Button>
                        <Button
                            variant="outline"
                            className="w-full h-12 justify-start gap-3 text-left"
                            disabled
                        >
                            <FilePlus className="h-5 w-5 text-amber-600" />
                            <div>
                                <div className="font-medium">Instrumento Privado</div>
                                <div className="text-xs text-muted-foreground">Basado en un modelo de instrumento privado</div>
                            </div>
                        </Button>
                        <Button
                            variant="outline"
                            className="w-full h-12 justify-start gap-3 text-left"
                            disabled
                        >
                            <FilePlus className="h-5 w-5 text-slate-500" />
                            <div>
                                <div className="font-medium">Hoja en Blanco</div>
                                <div className="text-xs text-muted-foreground">Documento libre sin plantilla base</div>
                            </div>
                        </Button>
                        <p className="text-xs text-center text-slate-400 pt-2">
                            Próximamente — en desarrollo
                        </p>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Dialog: Nuevo Presupuesto (placeholder Fase 2) */}
            <Dialog open={showPresupDialog} onOpenChange={setShowPresupDialog}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Nuevo Presupuesto</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 text-center">
                        <Calculator className="mx-auto h-12 w-12 text-slate-300 mb-4" />
                        <p className="text-sm text-muted-foreground">
                            Próximamente podrás crear presupuestos independientes desde aquí.
                        </p>
                        <p className="text-xs text-slate-400 mt-2">
                            En desarrollo
                        </p>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
