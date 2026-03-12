"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2, FileText } from "lucide-react";
import { SUPPORTED_ACT_TYPES } from "@/app/actions/modelos-types";
import { categoriaForActType, ACTOS_OCULTOS } from "@/app/actions/actuaciones-types";

interface GenerarActuacionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    defaultCategoria: "PRIVADO" | "PROTOCOLAR";
    /** Callback when user confirms. Parent handles create + generate. */
    onConfirm: (actType: string, categoria: "PRIVADO" | "PROTOCOLAR") => Promise<void>;
    /** List of act_types that have active models (to filter available options) */
    activeModelTypes?: string[];
}

export default function GenerarActuacionDialog({
    open,
    onOpenChange,
    defaultCategoria,
    onConfirm,
    activeModelTypes,
}: GenerarActuacionDialogProps) {
    const [selectedActType, setSelectedActType] = useState<string>("");
    const [isGenerating, setIsGenerating] = useState(false);

    // Reset on open
    useEffect(() => {
        if (open) {
            setSelectedActType("");
            setIsGenerating(false);
        }
    }, [open]);

    // Filter options: only show types matching this modal's category + ambiguos
    // HIDDEN types never show. No "Otros tipos" cross-category leak.
    const options = SUPPORTED_ACT_TYPES.filter((t) => {
        const cat = categoriaForActType(t.value);
        // Never show hidden acts
        if (cat === "HIDDEN") return false;
        // If we have a list of active models, only show those
        if (activeModelTypes && activeModelTypes.length > 0) {
            if (!activeModelTypes.includes(t.value)) return false;
        }
        // Ambiguos appear in both modals
        if (cat === "AMBIGUO") return true;
        // Otherwise only show matching category
        return cat === defaultCategoria;
    });

    const handleConfirm = async () => {
        if (!selectedActType) return;
        setIsGenerating(true);
        try {
            const cat = categoriaForActType(selectedActType);
            // Ambiguos adopt the category of the modal they were picked from
            const finalCat = cat === "AMBIGUO" ? defaultCategoria : cat;
            await onConfirm(selectedActType, finalCat as "PRIVADO" | "PROTOCOLAR");
            onOpenChange(false);
        } catch {
            // Error handled by parent
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[450px]">
                <DialogHeader>
                    <DialogTitle>
                        Nuevo {defaultCategoria === "PRIVADO" ? "Instrumento Privado" : "Escritura"}
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">
                            Tipo de acto
                        </label>
                        <Select value={selectedActType} onValueChange={setSelectedActType}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Seleccione el tipo de acto..." />
                            </SelectTrigger>
                            <SelectContent>
                                {options.map((t) => (
                                    <SelectItem key={t.value} value={t.value}>
                                        {t.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {selectedActType && categoriaForActType(selectedActType) === "AMBIGUO" && (
                            <p className="text-xs text-muted-foreground mt-1.5">
                                Se guardará como: {defaultCategoria === "PRIVADO"
                                    ? "Instrumento Privado (no impacta Protocolo)"
                                    : "Escritura (impacta Protocolo)"}
                            </p>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={isGenerating}
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleConfirm}
                            disabled={!selectedActType || isGenerating}
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Generando...
                                </>
                            ) : (
                                <>
                                    <FileText className="h-4 w-4 mr-2" />
                                    Crear y Generar
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
