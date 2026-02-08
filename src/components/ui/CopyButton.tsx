"use client";

import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner"; // Assuming sonner is installed, otherwise standard alert or just console

interface CopyButtonProps {
    text: string;
    label?: string;
    className?: string;
}

export function CopyButton({ text, label = "Copiar Texto", className }: CopyButtonProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text || "");
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
            toast.success("Texto copiado al portapapeles");
        } catch (err) {
            console.error("Failed to copy:", err);
            toast.error("Error al copiar");
        }
    };

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className={`gap-2 ${className}`}
            disabled={!text}
        >
            {copied ? (
                <>
                    <Check size={14} className="text-green-600" />
                    <span className="text-green-600 font-medium">Copiado</span>
                </>
            ) : (
                <>
                    <Copy size={14} />
                    <span>{label}</span>
                </>
            )}
        </Button>
    );
}
