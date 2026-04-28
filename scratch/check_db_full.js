const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function check() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const client = createClient(url, key);

  const { data: workflows } = await client.from('workflows').select('*');
  console.log('Workflows:', workflows);

  const { data: clientFlows } = await client.from('client_flows').select('*');
  console.log('Client Flows:', clientFlows);
}

check();
