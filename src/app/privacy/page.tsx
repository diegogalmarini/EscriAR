import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Política de Privacidad | EscriAR',
  description: 'Política de Privacidad de EscriAR',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl text-slate-800 dark:text-slate-200">
      <h1 className="text-3xl font-bold mb-8 text-center">Política de Privacidad</h1>
      
      <div className="space-y-6 text-sm leading-relaxed text-justify">
        <p><strong>Última actualización:</strong> Marzo 2026</p>

        <p>
          En <strong>EscriAR</strong>, nos comprometemos a proteger y respetar su privacidad. Esta Política de Privacidad explica cómo recopilamos, utilizamos, divulgamos y protegemos su información personal y la de sus clientes al utilizar nuestra plataforma SaaS notarial. Cumplimos con lo dispuesto en la Ley 25.326 de Protección de Datos Personales de la República Argentina y la normativa complementaria del Colegio de Escribanos.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-4 text-slate-900 dark:text-slate-100">1. Información que Recopilamos</h2>
        <p>
          Recopilamos información para proporcionar, mejorar y proteger nuestros servicios:
        </p>
        <ul className="list-disc pl-6 mt-2 space-y-2">
          <li><strong>Datos de la cuenta de usuario (Escribanos) :</strong> Nombre completo, correo electrónico, registro notarial, pertenencia a colegios y datos de facturación.</li>
          <li><strong>Terceros de Acceso vía Google (Google OAuth):</strong> Al iniciar sesión a través de Google, recopilamos su nombre, dirección de correo electrónico y foto de perfil según su consentimiento en la interfaz de Google. Esta información se usa estrictamente para la autenticación en EscriAR. Tampoco compartimos ni vendemos estos datos.</li>
          <li><strong>Documentación Notarial:</strong> Documentos subidos por los escribanos para su procesamiento (ej. títulos antecedentes, DNI de partes). Se procesan e indexan solo dentro del flujo del usuario y están segregados a nivel de datos y acceso (Multi-tenant RLS).</li>
          <li><strong>Datos Extraídos:</strong> La IA extrae datos (documentos, nombres, detalles de propiedad) exclusivamente para automatizar la labor dentro de <strong>su</strong> jurisdicción en la aplicación. No se usan para entrenar modelos públicos externos.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8 mb-4 text-slate-900 dark:text-slate-100">2. Uso de la Información</h2>
        <p>La información recopilada se emplea únicamente para:</p>
        <ul className="list-disc pl-6 mt-2 space-y-2">
          <li>Permitir el acceso seguro a EscriAR mediante credenciales o Google Auth.</li>
          <li>Proveer la funcionalidad core: lectura y estructuración de datos de documentos escaneados/nativos procesados en el sistema seguro (AWS/GCP/Vercel) bajo protocolos de encripción.</li>
          <li>Calcular aranceles o honorarios basándonos en reglas (ej. normativas ARBA o de CABA).</li>
          <li>Mejorar el sistema de respuestas operativas (RAG) exclusivamente dentro del entorno aislado de su notaría.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8 mb-4 text-slate-900 dark:text-slate-100">3. Seguridad y Retención</h2>
        <p>
          Utilizamos encriptación líder en la industria en tránsito (HTTPS/TLS) y en reposo (bases de datos y buckets). Documentos confidenciales notariales procesados operan con Strict Role-Level Security (RLS) en nuestra base de datos.
          La información procesada o extraída se retiene mientras su cuenta en EscriAR siga activa o según normativas de almacenamiento notarial establecidas por ley o el Escribano titular.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-4 text-slate-900 dark:text-slate-100">4. Compartición de Información</h2>
        <p>
          <strong>NUNCA vendemos ni compartimos su información o la de sus clientes con terceros para fines comerciales.</strong><br/>
          Solo revelamos información para:
        </p>
        <ul className="list-disc pl-6 mt-2 space-y-2">
          <li>Proveedores de servicios en la nube estrictos (Vercel, Supabase, Google AI/OpenAI bajo cuentas Enterprise cero retención - Zero Data Retention agreements).</li>
          <li>Cumplir plazos legales impuestos por entidades u oficios justificados.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8 mb-4 text-slate-900 dark:text-slate-100">5. Derechos sobre sus Datos</h2>
        <p>
          Usted tiene derecho a conocer, corregir y actualizar o solicitar la eliminación de su información personal. También tiene el control completo de desvincular EscriAR de su cuenta Google desde el panel de seguridad de su cuenta Google cuando lo decida.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-4 text-slate-900 dark:text-slate-100">6. Contacto</h2>
        <p>
          Cualquier duda, gestión o reporte sobre privacidad, contáctenos directamente a: <a href="mailto:diegogalmarini@gmail.com" className="text-blue-600 hover:underline">diegogalmarini@gmail.com</a>
        </p>
      </div>
    </div>
  );
}
