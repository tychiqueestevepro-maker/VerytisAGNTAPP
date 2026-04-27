const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
// Go up one level to find .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function check() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    console.error('URL or Key missing');
    return;
  }

  const client = createClient(url, key);
  const { data: clients } = await client.from('clients').select('id, name');
  console.log('Clients:', clients);
  
  const { data: profiles } = await client.from('profiles').select('id, client_id');
  console.log('Profiles:', profiles);
}

check();
