"use client";

import { Button } from "@/components/ui/button";
import { Copy, Check, FileText, File, FileType, Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { downloadAsTxt, downloadAsPdf, downloadAsDocx } from "@/lib/downloadUtils";


interface InmuebleToolbarProps {
    inmueble: any;
    className?: string;
}

export function InmuebleToolbar({ inmueble, className }: InmuebleToolbarProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(inmueble.transcripcion_literal || "");
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            toast.success("Texto copiado al portapapeles");
        } catch (err) {
            console.error("Failed to copy:", err);
            toast.error("Error al copiar");
        }
    };

    const filename = `Inmueble_${inmueble.nro_partida || 'sin-partida'}`;

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            {/* Copy Button */}
            <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="gap-2 h-8 text-xs font-medium"
                disabled={!inmueble.transcripcion_literal}
                title="Copiar texto al portapapeles"
            >
                {copied ? (
                    <>
                        <Check size={14} className="text-green-600" />
                        <span className="text-green-600">Copiado</span>
                    </>
                ) : (
                    <>
                        <Copy size={14} />
                        <span>Copiar Texto</span>
                    </>
                )}
            </Button>

            {/* Separator / Divider - optional styling preference */}
            <div className="h-4 w-[1px] bg-slate-200 mx-1" />

            {/* Download Buttons Group */}
            <div className="flex bg-slate-50 rounded-md border border-slate-200 p-0.5">
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-auto px-2 text-xs gap-1.5 hover:bg-white hover:text-blue-600 hover:shadow-sm"
                    onClick={() => downloadAsTxt(filename, inmueble)}
                    title="Descargar TXT"
                >
                    <FileText size={14} /> TXT
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-auto px-2 text-xs gap-1.5 hover:bg-white hover:text-red-600 hover:shadow-sm"
                    onClick={() => downloadAsPdf(filename, inmueble)}
                    title="Descargar PDF"
                >
                    <File size={14} /> PDF
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-auto px-2 text-xs gap-1.5 hover:bg-white hover:text-blue-800 hover:shadow-sm"
                    onClick={() => downloadAsDocx(filename, inmueble)}
                    title="Descargar Word"
                >
                    <FileType size={14} /> DOCX
                </Button>
            </div>
        </div>
    );
}
