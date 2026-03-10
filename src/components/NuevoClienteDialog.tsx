"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Loader2, Phone, Mail, User, Check, Copy, MessageCircle, FileEdit, Zap } from "lucide-react";
import { createPersona } from "@/app/actions/personas";
import { generateFichaLink } from "@/app/actions/fichas";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PersonForm } from "./PersonForm";

type Mode = 'quick' | 'full';
type Step = 'form' | 'link';

export function NuevoClienteDialog() {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [mode, setMode] = useState<Mode>('quick');
    const [step, setStep] = useState<Step>('form');
    const [loading, setLoading] = useState(false);

    // Quick mode state
    const [nombre, setNombre] = useState("");
    const [telefono, setTelefono] = useState("");
    const [email, setEmail] = useState("");
    const [createdPerson, setCreatedPerson] = useState<any>(null);
    const [link, setLink] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const resetForm = () => {
        setStep('form');
        setNombre("");
        setTelefono("");
        setEmail("");
        setCreatedPerson(null);
        setLink(null);
        setCopied(false);
    };

    const handleClose = () => {
        setOpen(false);
        resetForm();
    };

    const handleQuickCreate = async () => {
        if (!nombre.trim()) {
            toast.error("El nombre es obligatorio");
            return;
        }
        if (!telefono.trim() && !email.trim()) {
            toast.error("Debe ingresar al menos un dato de contacto");
            return;
        }

        setLoading(true);
        try {
            const res = await createPersona({
                nombre_completo: nombre.trim(),
                dni: "",
                telefono: telefono.trim() || undefined,
                email: email.trim() || undefined,
            });

            if (res.success && res.data) {
                setCreatedPerson(res.data);
                toast.success("Cliente creado");

                const linkRes = await generateFichaLink(res.data.dni);
                if (linkRes.success && linkRes.link) {
                    setLink(linkRes.link);
                }
                setStep('link');
            } else {
                toast.error("Error: " + (res.error || "No se pudo crear"));
            }
        } catch (err: any) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    const copyLink = () => {
        if (!link) return;
        navigator.clipboard.writeText(link);
        setCopied(true);
        toast.success("Link copiado");
        setTimeout(() => setCopied(false), 2000);
    };

    const shareWhatsApp = () => {
        if (!link) return;
        const phone = telefono.replace(/[^0-9]/g, '');
        const text = `Hola ${nombre}, por favor completa tus datos: ${link}`;
        const url = phone
            ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
            : `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    };

    const shareEmail = () => {
        if (!link) return;
        const subject = "Completa tus datos - EscriAR";
        const body = `Hola ${nombre},\n\nPor favor completa tus datos:\n${link}\n\nGracias.`;
        window.open(`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
    };

    return (
        <Dialog open={open} onOpenChange={(val) => {
            setOpen(val);
            if (!val) resetForm();
        }}>
            <DialogTrigger asChild>
                <Button className="bg-slate-900 hover:bg-slate-800 text-white rounded-lg shadow-sm flex items-center gap-2">
                    <UserPlus size={18} />
                    <span>Nuevo Cliente</span>
                </Button>
            </DialogTrigger>
            <DialogContent className={cn(
                "p-0 overflow-hidden",
                mode === 'full' ? "sm:max-w-[640px] max-h-[90vh] overflow-y-auto" : "sm:max-w-[520px]"
            )}>
                {/* Header with Mode Toggle */}
                <div className="bg-slate-50 p-5 border-b">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold flex items-center gap-2 text-slate-900">
                            <UserPlus size={20} />
                            Nuevo Cliente
                        </DialogTitle>
                        <DialogDescription className="text-slate-500 text-sm">
                            {mode === 'quick'
                                ? "Crea rápido y envía un link para que complete sus datos."
                                : "Carga manualmente todos los datos del cliente."}
                        </DialogDescription>
                    </DialogHeader>

                    {/* Mode Toggle - Only show if in form step */}
                    {step === 'form' && (
                        <div className="flex gap-2 mt-4 p-1 bg-white rounded-lg border border-slate-200">
                            <button
                                onClick={() => setMode('quick')}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all",
                                    mode === 'quick'
                                        ? "bg-slate-900 text-white shadow-sm"
                                        : "text-slate-600 hover:bg-slate-50"
                                )}
                            >
                                <Zap size={14} />
                                Rápido + Link
                            </button>
                            <button
                                onClick={() => setMode('full')}
                                className={cn(
                                    "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all",
                                    mode === 'full'
                                        ? "bg-slate-900 text-white shadow-sm"
                                        : "text-slate-600 hover:bg-slate-50"
                                )}
                            >
                                <FileEdit size={14} />
                                Formulario Completo
                            </button>
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="p-5">
                    {mode === 'quick' ? (
                        step === 'form' ? (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <User size={14} className="text-slate-400" />
                                        Nombre Completo <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        value={nombre}
                                        onChange={(e) => setNombre(e.target.value)}
                                        placeholder="Ej: Juan Carlos PÉREZ"
                                        className="h-11"
                                        autoFocus
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <Label className="flex items-center gap-2">
                                            <Phone size={14} className="text-green-600" />
                                            Teléfono
                                        </Label>
                                        <Input
                                            value={telefono}
                                            onChange={(e) => setTelefono(e.target.value)}
                                            placeholder="+54 911..."
                                            className="h-11"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="flex items-center gap-2 text-sm">
                                            <Mail size={14} className="text-blue-600" />
                                            Email <span className="text-slate-400 text-xs">(opcional)</span>
                                        </Label>
                                        <Input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="email@..."
                                            className="h-11"
                                        />
                                    </div>
                                </div>

                                <p className="text-xs text-slate-500 bg-amber-50 border border-amber-100 p-3 rounded-lg">
                                    💡 El cliente recibirá un link para completar DNI, CUIT, domicilio, etc.
                                </p>

                                <div className="flex justify-end gap-3 pt-2">
                                    <Button variant="outline" onClick={handleClose}>Cancelar</Button>
                                    <Button onClick={handleQuickCreate} disabled={loading} className="bg-green-600 hover:bg-green-700">
                                        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap size={16} className="mr-2" />}
                                        Crear y Generar Link
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            /* Link Step */
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-100 rounded-lg">
                                    <Check className="text-green-600" size={20} />
                                    <div>
                                        <p className="font-medium text-green-800">Cliente creado: {nombre}</p>
                                        <p className="text-xs text-green-600">Enviá el link para que complete sus datos</p>
                                    </div>
                                </div>

                                {link && (
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-bold text-slate-400 uppercase">Link</Label>
                                        <div className="flex items-center gap-2 p-3 bg-slate-50 border rounded-lg">
                                            <code className="text-xs flex-1 font-mono text-slate-600 break-all select-all">{link}</code>
                                            <Button size="icon" variant="ghost" onClick={copyLink} className={cn("h-8 w-8 shrink-0", copied && "text-green-600 bg-green-50")}>
                                                {copied ? <Check size={14} /> : <Copy size={14} />}
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-3">
                                    <Button variant="outline" className="h-12 border-green-200 bg-green-50 hover:bg-green-100 text-green-700" onClick={shareWhatsApp}>
                                        <MessageCircle size={18} className="mr-2" /> WhatsApp
                                    </Button>
                                    <Button variant="outline" className="h-12" onClick={shareEmail}>
                                        <Mail size={18} className="mr-2" /> Email
                                    </Button>
                                </div>

                                <div className="flex justify-between pt-2">
                                    <Button variant="ghost" onClick={resetForm}>+ Crear Otro</Button>
                                    <Button onClick={() => { handleClose(); router.refresh(); }}>Listo</Button>
                                </div>
                            </div>
                        )
                    ) : (
                        /* Full Form Mode */
                        <PersonForm
                            onSuccess={() => {
                                handleClose();
                                router.refresh();
                            }}
                            onCancel={handleClose}
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
