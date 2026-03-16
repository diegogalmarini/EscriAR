import { getClientWithRelations } from './src/app/actions/clientRelations';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const r = await getClientWithRelations('34575135');
  console.log("Respuesta completa:", JSON.stringify(r, null, 2));
}

main().catch(console.error);
