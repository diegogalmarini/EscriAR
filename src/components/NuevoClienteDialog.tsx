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
import { UserPlus, Loader2, Phone, Mail, User, Share2, Check, Copy, MessageCircle } from "lucide-react";
import { createPersona } from "@/app/actions/personas";
import { generateFichaLink } from "@/app/actions/fichas";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function NuevoClienteDialog() {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [step, setStep] = useState<'form' | 'link'>('form');
    const [loading, setLoading] = useState(false);
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

    const handleCreate = async () => {
        if (!nombre.trim()) {
            toast.error("El nombre es obligatorio");
            return;
        }
        if (!telefono.trim() && !email.trim()) {
            toast.error("Debe ingresar al menos un dato de contacto (teléfono o email)");
            return;
        }

        setLoading(true);
        try {
            // Create with minimal data - DNI will be auto-generated
            const res = await createPersona({
                nombre_completo: nombre.trim(),
                dni: "", // Will generate SIN-DNI-timestamp
                telefono: telefono.trim() || undefined,
                email: email.trim() || undefined,
            });

            if (res.success && res.data) {
                setCreatedPerson(res.data);
                toast.success("Cliente creado correctamente");

                // Generate ficha link automatically
                const linkRes = await generateFichaLink(res.data.dni);
                if (linkRes.success && linkRes.link) {
                    setLink(linkRes.link);
                }
                setStep('link');
            } else {
                toast.error("Error: " + (res.error || "No se pudo crear el cliente"));
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
        const text = `Hola ${nombre}, por favor completa tus datos para el trámite en el siguiente link: ${link}`;
        const url = phone
            ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
            : `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    };

    const shareEmail = () => {
        if (!link) return;
        const subject = "Completa tus datos - NotiAR";
        const body = `Hola ${nombre},\n\nPor favor completa tus datos personales en el siguiente enlace:\n${link}\n\nMuchas gracias.`;
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
            <DialogContent className="sm:max-w-[520px]">
                {step === 'form' ? (
                    <>
                        <DialogHeader className="mb-4">
                            <DialogTitle className="text-xl font-bold tracking-tight flex items-center gap-3 text-slate-900">
                                <div className="p-2 bg-slate-100 text-slate-600 rounded-lg">
                                    <UserPlus size={22} />
                                </div>
                                Nuevo Cliente
                            </DialogTitle>
                            <DialogDescription className="text-slate-500 text-sm">
                                Ingrese el nombre y un dato de contacto. El cliente completará el resto de su información a través de un link.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4">
                            {/* Name */}
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

                            {/* Contact Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <Phone size={14} className="text-green-600" />
                                        Teléfono
                                    </Label>
                                    <Input
                                        value={telefono}
                                        onChange={(e) => setTelefono(e.target.value)}
                                        placeholder="+54 911 1234-5678"
                                        className="h-11"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="flex items-center gap-2">
                                        <Mail size={14} className="text-blue-600" />
                                        Email <span className="text-xs text-slate-400">(opcional)</span>
                                    </Label>
                                    <Input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="cliente@email.com"
                                        className="h-11"
                                    />
                                </div>
                            </div>

                            <p className="text-xs text-slate-400 bg-slate-50 p-3 rounded-lg">
                                💡 Solo necesitás el nombre y un dato de contacto. Luego le enviás un link y el cliente completa DNI, CUIT, domicilio, etc.
                            </p>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t mt-4">
                            <Button variant="outline" onClick={() => setOpen(false)}>
                                Cancelar
                            </Button>
                            <Button
                                onClick={handleCreate}
                                disabled={loading}
                                className="bg-slate-900 hover:bg-slate-800"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Creando...
                                    </>
                                ) : (
                                    <>
                                        <UserPlus size={16} className="mr-2" />
                                        Crear y Generar Link
                                    </>
                                )}
                            </Button>
                        </div>
                    </>
                ) : (
                    <>
                        <DialogHeader className="mb-4">
                            <DialogTitle className="text-xl font-bold tracking-tight flex items-center gap-3 text-green-700">
                                <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                                    <Check size={22} />
                                </div>
                                ¡Cliente Creado!
                            </DialogTitle>
                            <DialogDescription className="text-slate-500 text-sm">
                                Enviá el link a <strong className="text-slate-900">{nombre}</strong> para que complete sus datos.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4">
                            {/* Link Box */}
                            {link && (
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                        Link para Completar Datos
                                    </Label>
                                    <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                                        <code className="text-xs flex-1 font-mono text-slate-600 break-all select-all">
                                            {link}
                                        </code>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={copyLink}
                                            className={cn(
                                                "h-9 w-9 rounded-lg shrink-0",
                                                copied ? "text-green-600 bg-green-50" : "text-slate-400 hover:text-slate-900"
                                            )}
                                        >
                                            {copied ? <Check size={16} /> : <Copy size={16} />}
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Share Buttons */}
                            <div className="grid grid-cols-2 gap-3">
                                <Button
                                    variant="outline"
                                    className="h-14 flex items-center justify-center gap-3 border-green-200 bg-green-50 hover:bg-green-100 text-green-700 rounded-xl"
                                    onClick={shareWhatsApp}
                                >
                                    <MessageCircle size={20} />
                                    <div className="text-left">
                                        <span className="text-sm font-semibold block">WhatsApp</span>
                                        {telefono && <span className="text-[10px] text-green-600">{telefono}</span>}
                                    </div>
                                </Button>
                                <Button
                                    variant="outline"
                                    className="h-14 flex items-center justify-center gap-3 border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-xl"
                                    onClick={shareEmail}
                                >
                                    <Mail size={20} />
                                    <div className="text-left">
                                        <span className="text-sm font-semibold block">Email</span>
                                        {email ? (
                                            <span className="text-[10px] text-slate-500 truncate max-w-[100px] block">{email}</span>
                                        ) : (
                                            <span className="text-[10px] text-slate-400">Sin email</span>
                                        )}
                                    </div>
                                </Button>
                            </div>
                        </div>

                        <div className="flex justify-between gap-3 pt-4 border-t mt-4">
                            <Button variant="ghost" onClick={resetForm}>
                                + Crear Otro
                            </Button>
                            <Button onClick={() => {
                                setOpen(false);
                                router.refresh();
                            }}>
                                Listo
                            </Button>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
