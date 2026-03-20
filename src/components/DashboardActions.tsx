"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { FolderPlus, FilePlus, Calculator, ArrowLeft, FileText, FileSignature, File, Loader2, Package } from "lucide-react";
import { toast } from "sonner";
import { createFolder } from "@/app/actions/carpeta";
import { createBorrador } from "@/app/actions/borradores";
import { getModelos } from "@/app/actions/modelos";
import { type ModeloActo, type InstrumentCategory } from "@/app/actions/modelos-types";

type DocDialogStep = "choose-type" | "choose-model";

export function DashboardActions() {
    const router = useRouter();
    const [creatingFolder, setCreatingFolder] = useState(false);
    const [showDocDialog, setShowDocDialog] = useState(false);

    // Nuevo Documento flow
    const [docStep, setDocStep] = useState<DocDialogStep>("choose-type");
    const [selectedCategory, setSelectedCategory] = useState<InstrumentCategory | null>(null);
    const [modelos, setModelos] = useState<ModeloActo[]>([]);
    const [loadingModelos, setLoadingModelos] = useState(false);
    const [creatingDoc, setCreatingDoc] = useState(false);

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

    // Reset dialog state when closing
    const handleDocDialogChange = (open: boolean) => {
        setShowDocDialog(open);
        if (!open) {
            setDocStep("choose-type");
            setSelectedCategory(null);
            setModelos([]);
        }
    };

    // Load active models for category
    const handleSelectCategory = async (category: InstrumentCategory) => {
        setSelectedCategory(category);
        setDocStep("choose-model");
        setLoadingModelos(true);
        try {
            const res = await getModelos(category);
            if (res.success && res.data) {
                setModelos(res.data.filter(m => m.is_active));
            }
        } catch {
            toast.error("Error al cargar modelos");
        } finally {
            setLoadingModelos(false);
        }
    };

    // Create borrador from selected model
    const handleSelectModel = async (modelo: ModeloActo) => {
        setCreatingDoc(true);
        try {
            const res = await createBorrador({
                tipo: "DOCUMENTO",
                nombre: modelo.label || modelo.act_type,
                instrument_category: modelo.instrument_category,
                act_type: modelo.act_type,
                modelo_id: modelo.id,
                metadata: {
                    template_name: modelo.template_name,
                    variables: modelo.metadata?.required_variables || [],
                    total_variables: modelo.total_variables,
                    categories: modelo.categories,
                },
            });
            if (res.success) {
                toast.success(`Borrador "${modelo.label || modelo.act_type}" creado`);
                handleDocDialogChange(false);
                router.refresh();
            } else {
                toast.error(res.error || "Error al crear borrador");
            }
        } catch {
            toast.error("Error al crear borrador");
        } finally {
            setCreatingDoc(false);
        }
    };

    // Create blank document
    const handleBlankDoc = async () => {
        setCreatingDoc(true);
        try {
            const res = await createBorrador({
                tipo: "DOCUMENTO",
                nombre: "Documento en blanco",
            });
            if (res.success) {
                toast.success("Documento en blanco creado");
                handleDocDialogChange(false);
                router.refresh();
            } else {
                toast.error(res.error || "Error al crear borrador");
            }
        } catch {
            toast.error("Error al crear borrador");
        } finally {
            setCreatingDoc(false);
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
                    onClick={() => router.push("/presupuesto")}
                    className="h-14 text-base font-semibold border-2 border-slate-300 hover:border-slate-400 gap-2"
                >
                    <Calculator className="h-5 w-5" />
                    Nuevo Presupuesto
                </Button>
            </div>

            {/* ── Dialog: Nuevo Documento ── */}
            <Dialog open={showDocDialog} onOpenChange={handleDocDialogChange}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {docStep === "choose-model" && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 -ml-1"
                                    onClick={() => { setDocStep("choose-type"); setModelos([]); }}
                                >
                                    <ArrowLeft size={16} />
                                </Button>
                            )}
                            {docStep === "choose-type" ? "Nuevo Documento" : (
                                selectedCategory === "ESCRITURA_PUBLICA" ? "Elegir Escritura" : "Elegir Instrumento Privado"
                            )}
                        </DialogTitle>
                    </DialogHeader>

                    {/* Step 1: Choose type */}
                    {docStep === "choose-type" && (
                        <div className="space-y-3 py-2">
                            <p className="text-sm text-muted-foreground mb-2">
                                Elegí el tipo de documento a crear:
                            </p>
                            <button
                                onClick={() => handleSelectCategory("ESCRITURA_PUBLICA")}
                                className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors text-left"
                            >
                                <FileText className="h-5 w-5 text-blue-600 shrink-0" />
                                <div>
                                    <div className="font-medium text-sm">Escritura</div>
                                    <div className="text-xs text-muted-foreground">Basada en un modelo de escritura pública</div>
                                </div>
                            </button>
                            <button
                                onClick={() => handleSelectCategory("INSTRUMENTO_PRIVADO")}
                                className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-amber-300 hover:bg-amber-50/50 transition-colors text-left"
                            >
                                <FileSignature className="h-5 w-5 text-amber-600 shrink-0" />
                                <div>
                                    <div className="font-medium text-sm">Instrumento Privado</div>
                                    <div className="text-xs text-muted-foreground">Basado en un modelo de instrumento privado</div>
                                </div>
                            </button>
                            <button
                                onClick={handleBlankDoc}
                                disabled={creatingDoc}
                                className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition-colors text-left disabled:opacity-50"
                            >
                                <File className="h-5 w-5 text-slate-500 shrink-0" />
                                <div>
                                    <div className="font-medium text-sm">Hoja en Blanco</div>
                                    <div className="text-xs text-muted-foreground">Documento libre sin plantilla base</div>
                                </div>
                            </button>
                        </div>
                    )}

                    {/* Step 2: Choose model */}
                    {docStep === "choose-model" && (
                        <div className="py-2">
                            {loadingModelos ? (
                                <div className="flex justify-center py-8">
                                    <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                                </div>
                            ) : modelos.length === 0 ? (
                                <div className="text-center py-8">
                                    <Package className="mx-auto h-10 w-10 text-slate-200 mb-3" />
                                    <p className="text-sm text-muted-foreground">
                                        No hay modelos activos de este tipo.
                                    </p>
                                    <p className="text-xs text-slate-400 mt-1">
                                        Subí un modelo desde la sección Modelos.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                    <p className="text-sm text-muted-foreground mb-2">
                                        Seleccioná el modelo a usar como base:
                                    </p>
                                    {modelos.map((m) => (
                                        <button
                                            key={m.id}
                                            onClick={() => handleSelectModel(m)}
                                            disabled={creatingDoc}
                                            className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors text-left disabled:opacity-50"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                                                <div className="min-w-0">
                                                    <div className="font-medium text-sm truncate">
                                                        {m.label || m.act_type}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        v{m.version} · {m.total_variables} variables
                                                        {m.act_code && ` · Cód. ${m.act_code}`}
                                                    </div>
                                                </div>
                                            </div>
                                            {creatingDoc && (
                                                <Loader2 className="h-4 w-4 animate-spin text-slate-400 shrink-0" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

        </>
    );
}
