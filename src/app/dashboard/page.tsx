import Link from "next/link";
import { createClient } from "@/lib/supabaseServer";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, FileText, Shield, ArrowRight, History } from "lucide-react";
import { createFolder } from "@/app/actions/carpeta";
import { revalidatePath } from "next/cache";
import { ExpiringDeedsAlert } from "@/components/ExpiringDeedsAlert";
import { MagicDropzone } from "@/components/MagicDropzone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DeleteFolderButton } from "@/components/DeleteFolderButton";
import { GlobalSearch } from "@/components/GlobalSearch";

export default async function DashboardPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const userName = user?.user_metadata?.full_name?.split(' ')[0] || "Notario";

    // Fetch recently created folders (using created_at instead of updated_at)
    const { data: carpetas, error } = await supabase
        .from("carpetas")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);

    return (
        <div className="p-8 space-y-10 animate-in fade-in duration-700">
            {/* Header section with Welcome and Global Search */}
            <div className="flex flex-col gap-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-6 flex-1">
                        <h1 className="text-[2rem] font-extrabold tracking-tight text-slate-900 whitespace-nowrap">
                            Bienvenido, {userName}
                        </h1>
                        {/* Global Search Bar - Moved next to title */}
                        <div className="w-full max-w-xl">
                            <GlobalSearch />
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <form action={async () => {
                            "use server";
                            await createFolder("Nueva Carpeta Manual");
                            revalidatePath("/dashboard");
                        }}>
                            <Button className="shadow-lg shadow-primary/20">
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Nueva Carpeta
                            </Button>
                        </form>
                    </div>
                </div>
            </div>

            {/* Magic Section - Hero Area */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <MagicDropzone />
                </div>
                <div className="flex flex-col gap-6">
                    <Card className="flex-1 bg-gradient-to-br from-slate-900 to-slate-800 text-white border-none shadow-xl">
                        <CardHeader>
                            <CardTitle className="text-lg font-normal flex items-center gap-2">
                                <History size={18} className="text-primary" />
                                Acceso Rápido
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1.5">
                                {carpetas?.slice(0, 3).map(c => {
                                    const isFilename = c.caratula?.toLowerCase().endsWith('.pdf') || c.caratula?.toLowerCase().endsWith('.docx');
                                    const displayTitle = isFilename ? `Expediente #${c.nro_carpeta_interna}` : (c.caratula || `Carpeta #${c.nro_carpeta_interna}`);
                                    const displaySubtitle = isFilename ? c.caratula : `Expediente #${c.nro_carpeta_interna}`;

                                    return (
                                        <Link
                                            key={c.id}
                                            href={`/carpeta/${c.id}`}
                                            className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group"
                                        >
                                            <div className="truncate pr-4">
                                                <div className="text-xs font-light truncate text-slate-100">{displayTitle}</div>
                                                <div className="text-[9px] text-slate-500 font-light tracking-wide">{displaySubtitle}</div>
                                            </div>
                                            <ArrowRight size={12} className="text-slate-600 group-hover:text-primary transition-colors flex-shrink-0" />
                                        </Link>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* Alerts Section */}
            <section>
                <div className="flex items-center gap-2 mb-4">
                    <h2 className="text-xl font-bold text-slate-800">Alertas de Vencimiento</h2>
                </div>
                <ExpiringDeedsAlert />
            </section>

            {/* Recent Folders List */}
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-slate-800">Últimas Carpetas Creadas</h2>
                    <Button variant="link" asChild>
                        <Link href="/carpetas">Ver todas</Link>
                    </Button>
                </div>
                <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
                    <Table>
                        <TableHeader className="bg-slate-50">
                            <TableRow>
                                <TableHead className="w-[80px] text-xs font-normal text-muted-foreground">ID</TableHead>
                                <TableHead className="text-xs font-normal text-muted-foreground">Carátula / Operación</TableHead>
                                <TableHead className="text-right text-xs font-normal text-muted-foreground">Estado</TableHead>
                                <TableHead className="text-right text-xs font-normal text-muted-foreground">Fecha Creación</TableHead>
                                <TableHead className="text-right text-xs font-normal text-muted-foreground">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {carpetas?.map((carpeta) => (
                                <TableRow key={carpeta.id} className="hover:bg-slate-50/50 transition-colors">
                                    <TableCell className="font-mono text-[10px] text-muted-foreground">
                                        #{carpeta.nro_carpeta_interna}
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-sm font-normal text-slate-700">
                                            {carpeta.caratula || "Sin carátula"}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Badge
                                            variant={carpeta.estado === "ABIERTA" ? "secondary" : "default"}
                                            className={cn(
                                                "text-[10px] px-2 py-0.5 h-5 font-normal",
                                                carpeta.estado === "FIRMADA" && "bg-green-100 text-green-700 hover:bg-green-200 border-none",
                                                carpeta.estado === "EN_REDACCION" && "bg-blue-100 text-blue-700 hover:bg-blue-200 border-none"
                                            )}
                                        >
                                            {carpeta.estado}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right text-[11px] font-light text-muted-foreground">
                                        {new Date(carpeta.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm" asChild className="h-7 text-[11px] font-normal hover:text-primary">
                                            <Link href={`/carpeta/${carpeta.id}`}>
                                                <FileText className="h-3.5 w-3.5 mr-1" />
                                                Abrir
                                            </Link>
                                        </Button>
                                        <DeleteFolderButton folderId={carpeta.id} folderName={carpeta.caratula} />
                                    </TableCell>
                                </TableRow>
                            ))}
                            {(!carpetas || carpetas.length === 0) && (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-20 text-muted-foreground">
                                        <History className="mx-auto h-12 w-12 opacity-10 mb-4" />
                                        Todavía no hay carpetas creadas.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </section>
        </div>
    );
}
