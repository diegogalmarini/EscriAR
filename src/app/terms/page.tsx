import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Términos de Servicio | EscriAR',
  description: 'Términos de Servicio de EscriAR',
};

export default function TermsOfServicePage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl text-slate-800 dark:text-slate-200">
      <h1 className="text-3xl font-bold mb-8 text-center">Términos de Servicio</h1>
      
      <div className="space-y-6 text-sm leading-relaxed text-justify">
        <p><strong>Última actualización:</strong> Marzo 2026</p>

        <p>
          Bienvenido a <strong>EscriAR</strong>. Al acceder o utilizar nuestra plataforma SaaS a través de `escriar.com` o autenticarse vía los servicios proporcionados por EscriAR, usted acepta estos Términos de Servicio. Por favor, léalos cuidadosamente antes de utilizar nuestros servicios para la gestión y tramitación notarial.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-4 text-slate-900 dark:text-slate-100">1. Descripción del Servicio</h2>
        <p>
          EscriAR provee software as a service (SaaS) diseñado para escribanos y notarios públicos de la República Argentina. Permite digitalizar, automatizar (con AI) y gestionar el flujo completo documental y la pre-liquidación fiscal (ej. Códigos CESBA, ARBA) de escrituras públicas, preservando control y trazabilidad sobre los expedientes.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-4 text-slate-900 dark:text-slate-100">2. Registro y Uso Correcto</h2>
        <p>
          Al validar su cuenta o realizar Sign In con Google (Google Auth), usted confirma que sus datos son legítimos y que la cuenta representa al notariado que dice.
          <br/>Se prohíbe:
        </p>
        <ul className="list-disc pl-6 mt-2 space-y-2">
          <li>Intentar romper protocolos de seguridad, Reverse Engineering o dañar infraestructuras (Vercel, Railway, Supabase DB).</li>
          <li>Cargar contenidos ilegales o maliciosos camuflados o intencionales.</li>
          <li>Utilizar este servicio como persona o entidad no matriculada de forma engañosa.</li>
        </ul>

        <h2 className="text-xl font-semibold mt-8 mb-4 text-slate-900 dark:text-slate-100">3. Precisión del Asistente de Inteligencia Artificial</h2>
        <p>
          EscriAR utiliza modelado de lenguaje (Gemini / AI) paramolecular que resume o redacta borradores de actos (donaciones, hipotecas UVA, ventas, cesiones).<br/>
          <strong>Descargo Crítico Legal:</strong> El SaaS **EscriAR proporciona sugerencias, automatiza transcripciones e indicadores** (incluyendo montos en letras y sellados), pero **LA ÚLTIMA DECISIÓN, VALIDACIÓN JURÍDICA Y FE PÚBLICA** recaen 100% sobre el Escribano Autorizante o titular a cargo. EscriAR no es susceptible de mala praxis notarial y usted (usuario autorizado) asume la eximición de responsabilidad para EscriAR ante el registro y catastro.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-4 text-slate-900 dark:text-slate-100">4. Disponibilidad (SLA) y Modelos de Precios</h2>
        <p>
          EscriAR fue construido con arquitecturas de alta disponibilidad, pero dependemos de terceros (Supabase SQL y Google AI Studio) y los servicios pueden experimentar inactividad por mantenimiento. El plan y la estructura de precios comerciales por suscripción (SaaS Empresa B2B) serán acordados independientemente o establecidos en el momento de facturar la cuenta operativa real.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-4 text-slate-900 dark:text-slate-100">5. Modificaciones</h2>
        <p>
          Nos reservamos el derecho de modificar o rectificar estos Términos cada vez que existan actualizaciones significativas de modelo, marco de Google Auth, o cambios de jurisdicción legal argentina. Notificaremos cambios importantes usando los emails de contacto registrados.
        </p>

        <h2 className="text-xl font-semibold mt-8 mb-4 text-slate-900 dark:text-slate-100">6. Contrato y Jurisdicción</h2>
        <p>
          Estos términos se interpretan según las leyes de la República Argentina y las normativas notariales pertinentes (Código Civil y Comercial, regulaciones del Colegio de Escribanos y legislaciones de Registro RPI PBA/CABA). De haber disputa extrajudicial se dirimirán bajo mediaciones formales pre-ordinarias.
        </p>

        <br/>
        <p>Si tiene inquietudes operativas, técnicas o de cumplimiento, escríbanos al soporte: <a href="mailto:diegogalmarini@gmail.com" className="text-blue-600 hover:underline">diegogalmarini@gmail.com</a></p>
      </div>
    </div>
  );
}
