"use client";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, FileText, File, FileType } from "lucide-react";
import { downloadAsTxt, downloadAsPdf, downloadAsDocx } from "@/lib/downloadUtils";

interface VerInmuebleDialogProps {
    inmueble: any;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    hideTrigger?: boolean;
}

export function VerInmuebleDialog({ inmueble, open, onOpenChange, hideTrigger }: VerInmuebleDialogProps) {
    const filename = `Inmueble_${inmueble.nro_partida || 'sin-partida'}`;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {!hideTrigger && (
                <DialogTrigger asChild>
                    <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-blue-50 text-blue-600">
                            <Search size={16} />
                        </Button>
                    </div>
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[1200px] w-[95vw] max-h-[90vh] flex flex-col p-10">
                <DialogHeader>
                    <div className="flex justify-between items-start pr-8">
                        <div>
                            <DialogTitle>Detalle del Inmueble</DialogTitle>
                            <DialogDescription>
                                {inmueble.nomenclatura || "Sin nomenclatura"}
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-3 mt-2">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                            <p className="text-xs text-muted-foreground font-medium">Partido / Dpto</p>
                            <p className="font-semibold">{inmueble.partido_id || "No especificado"}</p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground font-medium">Número Partida</p>
                            <p className="font-semibold">{inmueble.nro_partida || "No especificado"}</p>
                        </div>
                    </div>
                </div>

                <div className="flex-1 min-h-0 mt-4 border rounded-md bg-slate-50 p-6 flex flex-col overflow-hidden">
                    <div className="flex justify-between items-center mb-4 flex-shrink-0">
                        <p className="text-sm font-semibold text-slate-700">Transcripción Literal:</p>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs gap-2 px-3 shadow-sm hover:bg-white"
                                onClick={() => downloadAsTxt(filename, inmueble)}
                                title="Descargar como TXT"
                            >
                                <FileText className="h-3.5 w-3.5" /> TXT
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs gap-2 px-3 shadow-sm hover:bg-white"
                                onClick={() => downloadAsPdf(filename, inmueble)}
                                title="Descargar como PDF"
                            >
                                <File className="h-3.5 w-3.5" /> PDF
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs gap-2 px-3 shadow-sm hover:bg-white"
                                onClick={() => downloadAsDocx(filename, inmueble)}
                                title="Descargar como DOCX"
                            >
                                <FileType className="h-3.5 w-3.5" /> DOCX
                            </Button>
                        </div>
                    </div>
                    <ScrollArea className="flex-1 pr-4 text-justify text-sm leading-relaxed whitespace-pre-wrap font-mono text-slate-600 bg-white p-4 rounded border shadow-inner">
                        {inmueble.transcripcion_literal || "No hay transcripción disponible."}
                    </ScrollArea>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export function DownloadInmuebleButton({ inmueble }: { inmueble: any }) {
    return null;
}
