"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Share2, MessageCircle, Mail, Copy, Check, Loader2, Phone, User } from "lucide-react";
import { toast } from "sonner";
import { generateFichaLink } from "@/app/actions/fichas";
import { formatPersonName } from "@/lib/utils/normalization";
import { cn } from "@/lib/utils";

interface SendFichaDialogProps {
    persona: {
        dni: string;
        nombre_completo: string;
        contacto?: {
            telefono?: string;
            email?: string;
        };
    };
}

export function SendFichaDialog({ persona }: SendFichaDialogProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [link, setLink] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const handleGenerate = async () => {
        setLoading(true);
        const res = await generateFichaLink(persona.dni);
        setLoading(false);

        if (res.success && res.link) {
            setLink(res.link);
        } else {
            toast.error("Error al generar el link");
        }
    };

    const copyToClipboard = () => {
        if (!link) return;
        navigator.clipboard.writeText(link);
        setCopied(true);
        toast.success("Link copiado al portapapeles");
        setTimeout(() => setCopied(false), 2000);
    };

    const shareWhatsApp = () => {
        if (!link) return;
        const phoneNumber = persona.contacto?.telefono?.replace(/[^0-9]/g, '') || '';
        const text = `Hola ${persona.nombre_completo}, por favor completa tus datos para el trámite en el siguiente link: ${link}`;
        const whatsappUrl = phoneNumber
            ? `https://wa.me/${phoneNumber}?text=${encodeURIComponent(text)}`
            : `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(whatsappUrl, '_blank');
    };

    const shareEmail = () => {
        if (!link) return;
        const email = persona.contacto?.email || '';
        const subject = "Ficha de Datos Personales - EscriAR";
        const body = `Hola ${persona.nombre_completo},\n\nPor favor, completa tus datos personales ingresando al siguiente link seguro:\n${link}\n\nMuchas gracias.`;
        window.open(`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
    };

    const hasPhone = Boolean(persona.contacto?.telefono);
    const hasEmail = Boolean(persona.contacto?.email);

    return (
        <Dialog open={open} onOpenChange={(val) => {
            setOpen(val);
            if (!val) {
                setLink(null);
                setCopied(false);
            }
        }}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                    <Share2 size={14} /> Ficha
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[640px] p-0 overflow-hidden border border-slate-200 shadow-xl rounded-2xl bg-white">
                {/* Header */}
                <div className="bg-slate-50 p-6 border-b border-slate-100">
                    <DialogHeader className="text-left">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-slate-200 text-slate-600 rounded-lg">
                                <Share2 size={20} />
                            </div>
                            <DialogTitle className="text-xl font-bold text-slate-900">
                                Enviar Ficha de Datos
                            </DialogTitle>
                        </div>
                        <DialogDescription className="text-slate-500 text-sm">
                            Genera un enlace para que el cliente complete su información personal.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="p-6 bg-white space-y-6">
                    {/* Contact Info Card */}
                    <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-white rounded-full border border-slate-200 shadow-sm">
                                <User size={24} className="text-slate-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h3 className="text-lg font-bold text-slate-900">
                                    {formatPersonName(persona.nombre_completo)}
                                </h3>
                                <div className="flex flex-wrap gap-4 mt-2">
                                    {hasPhone ? (
                                        <div className="flex items-center gap-2 text-sm">
                                            <Phone size={14} className="text-green-600" />
                                            <span className="font-medium text-slate-700">{persona.contacto?.telefono}</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 text-sm text-slate-400">
                                            <Phone size={14} />
                                            <span>Sin teléfono</span>
                                        </div>
                                    )}
                                    {hasEmail ? (
                                        <div className="flex items-center gap-2 text-sm">
                                            <Mail size={14} className="text-blue-600" />
                                            <span className="font-medium text-slate-700">{persona.contacto?.email}</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 text-sm text-slate-400">
                                            <Mail size={14} />
                                            <span>Sin email (opcional)</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {!link ? (
                        <Button
                            onClick={handleGenerate}
                            disabled={loading}
                            className="w-full h-12 text-base font-semibold bg-slate-900 hover:bg-slate-800 text-white transition-all rounded-xl shadow-sm"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Generando enlace...
                                </>
                            ) : (
                                "Generar Link de Acceso"
                            )}
                        </Button>
                    ) : (
                        <div className="space-y-5">
                            {/* Link Box - Full width, no truncation */}
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                                    Link de Acceso
                                </Label>
                                <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                                    <code className="text-xs flex-1 font-mono text-slate-600 break-all select-all">
                                        {link}
                                    </code>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={copyToClipboard}
                                        className={cn(
                                            "h-9 w-9 rounded-lg transition-colors shrink-0",
                                            copied ? "text-green-600 bg-green-50" : "text-slate-400 hover:text-slate-900 hover:bg-slate-100"
                                        )}
                                    >
                                        {copied ? <Check size={16} /> : <Copy size={16} />}
                                    </Button>
                                </div>
                            </div>

                            {/* Share Options - Always show WhatsApp */}
                            <div className="grid grid-cols-2 gap-3">
                                <Button
                                    variant="outline"
                                    className="h-14 flex items-center justify-center gap-3 border-green-200 bg-green-50 hover:bg-green-100 text-green-700 transition-all rounded-xl"
                                    onClick={shareWhatsApp}
                                >
                                    <MessageCircle size={20} />
                                    <div className="text-left">
                                        <span className="text-sm font-semibold block">WhatsApp</span>
                                        {hasPhone && (
                                            <span className="text-[10px] text-green-600 font-normal">{persona.contacto?.telefono}</span>
                                        )}
                                    </div>
                                </Button>
                                <Button
                                    variant="outline"
                                    className="h-14 flex items-center justify-center gap-3 border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-all rounded-xl"
                                    onClick={shareEmail}
                                >
                                    <Mail size={20} />
                                    <div className="text-left">
                                        <span className="text-sm font-semibold block">Email</span>
                                        {hasEmail ? (
                                            <span className="text-[10px] text-slate-500 font-normal truncate max-w-[120px] block">{persona.contacto?.email}</span>
                                        ) : (
                                            <span className="text-[10px] text-slate-400 font-normal">Opcional</span>
                                        )}
                                    </div>
                                </Button>
                            </div>

                            {!hasPhone && !hasEmail && (
                                <p className="text-xs text-center text-amber-600 bg-amber-50 p-2 rounded-lg">
                                    💡 No hay contacto guardado. Copia el link y compártelo manualmente.
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 flex justify-center bg-slate-50/50 border-t border-slate-100">
                    <Button
                        variant="ghost"
                        onClick={() => setOpen(false)}
                        className="text-slate-400 hover:text-slate-600 text-[10px] font-bold uppercase tracking-wider h-8"
                    >
                        Cerrar Ventana
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
