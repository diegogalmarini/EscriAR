"use client";

import React, { useState } from "react";
import { FolderPlus, Upload, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export function MagicDropzone() {
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const router = useRouter();

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const files = Array.from(e.dataTransfer.files);
        const validExtensions = [".pdf", ".doc", ".docx"];
        const file = files.find(f => {
            const fileName = f.name.toLowerCase();
            return validExtensions.some(ext => fileName.endsWith(ext));
        });

        if (!file) {
            toast.error("Por favor, arrastra un archivo válido (PDF, DOC o DOCX).");
            return;
        }

        await processFile(file);
    };

    const processFile = async (file: File) => {
        setIsUploading(true);
        const toastId = toast.loading(`Subiendo ${file.name}...`);

        try {
            // 1. Provide a unique path for the file in the bucket
            // In a real scenario we could put it under the user's ID directory if needed
            const fileExt = file.name.split('.').pop();
            const filePath = `user_uploads/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

            // Note: the RLS policy might require it to be within a specific folder or just the bucket. 
            // The bucket allows authenticated users to insert.
            const { error: uploadError } = await supabase.storage
                .from('escrituras')
                .upload(filePath, file);

            if (uploadError) {
                console.error("Storage upload error:", uploadError);
                throw new Error(`Error al subir archivo: ${uploadError.message}`);
            }

            toast.loading(`Procesando con IA Magia...`, { id: toastId });

            // 2. Queue the job
            const queueRes = await fetch("/api/ingest/queue", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    filePath,
                    fileName: file.name,
                    fileSize: file.size,
                    mimeType: file.type
                })
            });

            if (!queueRes.ok) {
                const errorData = await queueRes.json();
                throw new Error(errorData.error || "Error encolando tarea");
            }

            const { jobId, folderId } = await queueRes.json();

            // 3. Poll for status
            pollJobStatus(jobId, folderId, toastId);

        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Hubo un error al procesar el archivo.", { id: toastId });
            setIsUploading(false);
        }
    };

    const pollJobStatus = (jobId: string, folderId: string, toastId: string | number) => {
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`/api/jobs/${jobId}`);
                if (!res.ok) return; // Keep trying on network blips

                const { job } = await res.json();
                if (!job) return;

                if (job.status === 'completed') {
                    clearInterval(interval);
                    toast.success("¡Análisis completado con éxito!", { id: toastId, duration: 5000 });
                    router.push(`/carpeta/${folderId}`);
                } else if (job.status === 'failed') {
                    clearInterval(interval);
                    toast.error(`Error procesando: ${job.error_message || "Ocurrió un error inesperado"}`, { id: toastId });
                    setIsUploading(false);
                }
                // If pending or processing, we keep waiting
            } catch (error) {
                console.error("Error durando polling", error);
            }
        }, 3000); // 3 seconds poll
    };

    return (
        <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
                "group relative border-2 border-dashed rounded-2xl p-12 transition-all duration-300 flex flex-col items-center justify-center text-center gap-4 cursor-pointer overflow-hidden",
                isDragging
                    ? "border-primary bg-primary/5 scale-[1.02] ring-4 ring-primary/10"
                    : "border-slate-200 hover:border-primary/50 hover:bg-slate-50",
                isUploading && "pointer-events-none opacity-50"
            )}
        >
            {/* Background Magic Effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />

            <div className={cn(
                "w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center transition-transform duration-500",
                isDragging ? "scale-110 rotate-12" : "group-hover:scale-110"
            )}>
                {isUploading ? (
                    <Loader2 className="h-10 w-10 text-primary animate-spin" />
                ) : (
                    <Upload className={cn("h-10 w-10 text-primary", isDragging && "animate-bounce")} />
                )}
            </div>

            <div className="space-y-2 relative z-10">
                <h3 className="text-2xl font-bold tracking-tight text-slate-900">
                    {isDragging ? "¡Sueltalo ahora!" : "Inicia un trámite con Magia"}
                </h3>
                <p className="text-slate-500 max-w-sm mx-auto">
                    Arrastra tu Escritura, PDF, Word o Ficha aquí. NotiAr creará la carpeta y extraerá los datos automáticamente.
                </p>
            </div>

            <div className="flex gap-4 mt-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
                    <FileText size={14} /> PDF, DOCX
                </div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
                    <FolderPlus size={14} /> Auto-creación de carpeta
                </div>
            </div>

            {/* Hidden Input for Click Access */}
            <input
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) processFile(file);
                }}
            />
        </div>
    );
}
