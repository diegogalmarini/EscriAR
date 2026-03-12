"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
    LayoutDashboard,
    FolderKanban,
    Users,
    Building2,
    Calendar,
    BookOpen,
    FileSpreadsheet,
    ClipboardList,
    Settings,
    LogOut,
    Menu,
    X,
    ChevronLeft,
    ChevronRight,
    Shield,
    Package,
    MapPin
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import { PendingBadge } from "@/components/PendingBadge";

const baseMenuItems = [
    { name: "Inicio", href: "/dashboard", icon: LayoutDashboard },
    { name: "Carpetas", href: "/carpetas", icon: FolderKanban },
    { name: "Clientes", href: "/clientes", icon: Users },
    { name: "Inmuebles", href: "/inmuebles", icon: Building2 },
    { name: "Protocolo", href: "/protocolo", icon: BookOpen },
    { name: "Modelos", href: "/modelos", icon: Package },
    { name: "Agenda", href: "/agenda", icon: Calendar },
    { name: "Jurisdicciones", href: "/jurisdicciones", icon: MapPin },
    { name: "Tabla de Actos", href: "/tabla-actos", icon: FileSpreadsheet },
    { name: "Guía de Trámites", href: "/guia-tramites", icon: ClipboardList },
];

export function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);

    const handleNavigation = (href: string) => {
        setIsMobileOpen(false);
        router.push(href);
        router.refresh();
    };

    React.useEffect(() => {
        const checkAdmin = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile } = await supabase
                    .from("user_profiles")
                    .select("role")
                    .eq("id", user.id)
                    .single();

                if (profile?.role === "admin") {
                    setIsAdmin(true);
                }
            }
        };
        checkAdmin();
    }, []);

    const menuItems = isAdmin
        ? [...baseMenuItems, { name: "Administración", href: "/admin/users", icon: Shield }]
        : baseMenuItems;

    // Don't show shell on login/signup/public pages
    const isPublicPage = ["/login", "/signup", "/pending-approval", "/unauthorized"].includes(pathname) ||
        pathname.startsWith("/ficha/") ||
        pathname.startsWith("/auth/");

    if (isPublicPage) {
        return <>{children}</>;
    }

    const handleLogout = async () => {
        await supabase.auth.signOut();
        window.location.href = "/login";
    };

    return (
        <div className="flex min-h-screen bg-slate-50">
            {/* Mobile Header */}
            <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b flex items-center justify-between px-4 z-50">
                <span className="font-bold text-xl text-primary">EscriAr</span>
                <Button variant="ghost" size="icon" onClick={() => setIsMobileOpen(!isMobileOpen)}>
                    {isMobileOpen ? <X /> : <Menu />}
                </Button>
            </div>

            {/* Sidebar — always fixed, never scrolls */}
            <aside
                className={cn(
                    "fixed inset-y-0 left-0 z-40 bg-white border-r transition-all duration-300 transform",
                    isCollapsed ? "w-20" : "w-64",
                    isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
                )}
            >
                <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="h-16 flex items-center justify-between px-6 border-b shrink-0">
                        {!isCollapsed && <span className="font-bold text-xl text-primary">EscriAr</span>}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="hidden lg:flex"
                            onClick={() => setIsCollapsed(!isCollapsed)}
                        >
                            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                        </Button>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 py-6 px-3 space-y-1">
                        {menuItems.map((item) => {
                            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                            return (
                                <button
                                    key={item.href}
                                    onClick={() => handleNavigation(item.href)}
                                    className={cn(
                                        "w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors group",
                                        isActive
                                            ? "bg-primary text-primary-foreground shadow-sm"
                                            : "text-slate-600 hover:bg-slate-100"
                                    )}
                                >
                                    <item.icon size={20} className={cn("shrink-0", isActive ? "" : "group-hover:text-primary")} />
                                    {!isCollapsed && <span className="font-medium whitespace-nowrap">{item.name}</span>}
                                    {!isCollapsed && item.href === "/dashboard" && <PendingBadge />}
                                </button>
                            );
                        })}
                    </nav>

                    {/* Footer / User */}
                    <div className="p-4 border-t shrink-0">
                        <Button
                            variant="ghost"
                            className={cn("w-full flex items-center justify-start gap-3 text-red-500 hover:text-red-600 hover:bg-red-50 px-3")}
                            onClick={handleLogout}
                        >
                            <LogOut size={20} className="shrink-0" />
                            {!isCollapsed && <span className="font-medium">Cerrar Sesión</span>}
                        </Button>
                    </div>
                </div>
            </aside>

            {/* Backdrop for mobile */}
            {isMobileOpen && (
                <div
                    className="fixed inset-0 bg-black/20 z-30 lg:hidden backdrop-blur-sm"
                    onClick={() => setIsMobileOpen(false)}
                />
            )}

            {/* Main Content — offset by sidebar width */}
            <main className={cn(
                "flex-1 pt-16 lg:pt-0 transition-all duration-300",
                isCollapsed ? "lg:ml-20" : "lg:ml-64"
            )}>
                <div className="mx-auto max-w-7xl min-h-full">
                    {children}
                </div>
            </main>
        </div>
    );
}
