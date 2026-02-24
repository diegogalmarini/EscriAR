"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from "@/components/ui/tabs";
import {
    Shield,
    UserPlus,
    Users,
    Award,
    BookOpen,
    Package
} from "lucide-react";
import { getAllUsers, getUserStats, preCreateUser } from "@/app/actions/admin";
import { getEscribanos, Escribano } from "@/app/actions/escribanos";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

// Sub-components
import { UsersTab } from "./UsersTab";
import { EscribanosTab } from "./EscribanosTab";
import { KnowledgeTab } from "./KnowledgeTab";
import { ModelosTab } from "./ModelosTab";

export default function AdminUsersPage() {
    const [activeTab, setActiveTab] = useState("escribanos");
    const [users, setUsers] = useState<any[]>([]);
    const [escribanos, setEscribanos] = useState<Escribano[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<any>(null);

    // User Invitation State
    const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
    const [inviteForm, setInviteForm] = useState({ email: "", fullName: "" });
    const [isInviting, setIsInviting] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const [usersRes, statsRes, escribanosRes] = await Promise.all([
                getAllUsers(),
                getUserStats(),
                getEscribanos()
            ]);

            if (usersRes.success && usersRes.data) setUsers(usersRes.data);
            if (statsRes.success && statsRes.data) setStats(statsRes.data);
            if (escribanosRes.success && escribanosRes.data) setEscribanos(escribanosRes.data as Escribano[]);
        } catch (error) {
            toast.error("Error al cargar los datos del panel");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleInvite = async () => {
        if (!inviteForm.email || !inviteForm.fullName) {
            toast.error("Complete todos los campos");
            return;
        }

        setIsInviting(true);
        const res = await preCreateUser(inviteForm.email, inviteForm.fullName);
        setIsInviting(false);

        if (res.success) {
            toast.success("Usuario pre-aprobado correctamente");
            setInviteDialogOpen(false);
            setInviteForm({ email: "", fullName: "" });
            loadData();
        } else {
            toast.error(res.error || "Error al invitar usuario");
        }
    };

    return (
        <div className="p-8 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                        <Shield className="h-9 w-9 text-blue-600" />
                        Gestión de Equipo y Firmantes
                    </h1>
                    <p className="text-muted-foreground">Configuración de escribanos autorizantes y acceso de usuarios al sistema</p>
                </div>
                {activeTab === "usuarios" && (
                    <Button onClick={() => setInviteDialogOpen(true)} className="bg-slate-900 border-slate-700">
                        <UserPlus className="mr-2 h-4 w-4" />
                        Pre-crear Empleado
                    </Button>
                )}
            </div>

            <Tabs defaultValue="escribanos" value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
                <TabsList className="bg-slate-100 p-1">
                    <TabsTrigger value="escribanos" className="gap-2 px-6">
                        <Award size={16} />
                        ESCRIBANOS
                    </TabsTrigger>
                    <TabsTrigger value="usuarios" className="gap-2 px-6">
                        <Users size={16} />
                        USUARIOS
                    </TabsTrigger>
                    <TabsTrigger value="conocimiento" className="gap-2 px-6">
                        <BookOpen size={16} />
                        CONOCIMIENTO
                    </TabsTrigger>
                    <TabsTrigger value="modelos" className="gap-2 px-6">
                        <Package size={16} />
                        MODELOS
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="escribanos" className="mt-0 border-none p-0 focus-visible:ring-0">
                    <EscribanosTab
                        escribanos={escribanos}
                        loading={loading}
                        onRefresh={loadData}
                    />
                </TabsContent>

                <TabsContent value="usuarios" className="mt-0 border-none p-0 focus-visible:ring-0">
                    <UsersTab
                        users={users}
                        stats={stats}
                        loading={loading}
                        onRefresh={loadData}
                    />
                </TabsContent>

                <TabsContent value="conocimiento" className="mt-0 border-none p-0 focus-visible:ring-0">
                    <KnowledgeTab />
                </TabsContent>

                <TabsContent value="modelos" className="mt-0 border-none p-0 focus-visible:ring-0">
                    <ModelosTab />
                </TabsContent>
            </Tabs>

            {/* Invite Dialog (Kept for Users Tab) */}
            <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Pre-crear / Invitar Empleado</DialogTitle>
                        <DialogDescription>
                            Permite que un nuevo empleado se registre y sea aprobado automáticamente.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="invite-name">Nombre Completo</Label>
                            <Input
                                id="invite-name"
                                value={inviteForm.fullName}
                                onChange={(e) => setInviteForm({ ...inviteForm, fullName: e.target.value })}
                                placeholder="Ej: Maria Lopez"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="invite-email">Email</Label>
                            <Input
                                id="invite-email"
                                type="email"
                                value={inviteForm.email}
                                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                                placeholder="empleado@notaria.com"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleInvite} disabled={isInviting}>
                            {isInviting ? "Guardando..." : "Confirmar Pre-aprobación"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
