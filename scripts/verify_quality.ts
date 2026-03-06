import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  // 1. Tipo acto distribution
  const { data: registros } = await sb.from('protocolo_registros')
    .select('tipo_acto, vendedor_acreedor, comprador_deudor')
    .eq('es_errose', false)
    .order('nro_escritura');

  console.log('=== TIPO_ACTO DISTRIBUTION ===');
  const tipoCount = new Map<string, number>();
  for (const r of registros || []) {
    const t = r.tipo_acto || '(null)';
    tipoCount.set(t, (tipoCount.get(t) || 0) + 1);
  }
  for (const [tipo, count] of [...tipoCount.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${count}x ${tipo}`);
  }

  // 2. Check for truncated names (less than 10 chars)
  console.log('\n=== TRUNCATED NAMES CHECK ===');
  let truncated = 0;
  for (const r of registros || []) {
    if (r.vendedor_acreedor && r.vendedor_acreedor.length < 10) {
      console.log(`  ⚠ vendedor truncated: "${r.vendedor_acreedor}"`);
      truncated++;
    }
    if (r.comprador_deudor && r.comprador_deudor.length < 10) {
      console.log(`  ⚠ comprador truncated: "${r.comprador_deudor}"`);
      truncated++;
    }
  }
  console.log(`  Total truncated: ${truncated}`);

  // 3. Personas count
  const { count: personasCount } = await sb.from('personas').select('*', { count: 'exact', head: true });
  console.log(`\n=== PERSONAS: ${personasCount} total ===`);
  
  // Sample some names
  const { data: personas } = await sb.from('personas').select('dni,nombre_completo,tipo_persona').limit(15);
  for (const p of personas || []) {
    console.log(`  ${p.tipo_persona === 'JURIDICA' ? '🏢' : '👤'} ${p.nombre_completo} (${p.dni})`);
  }

  // 4. Inmuebles count
  const { count: inmCount } = await sb.from('inmuebles').select('*', { count: 'exact', head: true });
  console.log(`\n=== INMUEBLES: ${inmCount} total ===`);
  
  const { data: inmuebles } = await sb.from('inmuebles').select('partido_id,nro_partida,nomenclatura_catastral').limit(10);
  for (const i of inmuebles || []) {
    console.log(`  🏠 ${i.partido_id} - Partida ${i.nro_partida} ${i.nomenclatura_catastral ? '(NC: ' + i.nomenclatura_catastral.substring(0, 50) + ')' : ''}`);
  }

  // 5. Sample full registros
  console.log('\n=== SAMPLE REGISTROS ===');
  const { data: sample } = await sb.from('protocolo_registros')
    .select('nro_escritura,tipo_acto,vendedor_acreedor,comprador_deudor,monto_ars,monto_usd')
    .eq('es_errose', false)
    .order('nro_escritura')
    .limit(10);
  for (const r of sample || []) {
    console.log(`  #${r.nro_escritura}: ${r.tipo_acto} | V: ${r.vendedor_acreedor?.substring(0, 40)} | C: ${r.comprador_deudor?.substring(0, 40)} | $${r.monto_ars || 0} / USD${r.monto_usd || 0}`);
  }
}

main();
