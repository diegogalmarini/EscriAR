import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export default function UnauthorizedPage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
            <Card className="max-w-md w-full">
                <CardHeader className="text-center">
                    <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
                        <AlertTriangle className="h-6 w-6 text-red-600" />
                    </div>
                    <CardTitle className="text-2xl">Acceso No Autorizado</CardTitle>
                    <CardDescription>
                        Tu cuenta no tiene permisos para acceder a este sistema.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground text-center">
                        Solo los usuarios con correos autorizados pueden acceder a EscriAr.
                        Si crees que esto es un error, contacta al administrador del sistema.
                    </p>
                    <Button asChild className="w-full">
                        <Link href="/login">
                            Volver al Login
                        </Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
