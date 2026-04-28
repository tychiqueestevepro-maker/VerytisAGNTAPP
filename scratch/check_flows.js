const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function checkFlows() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    console.error('URL or Key missing');
    return;
  }

  const client = createClient(url, key);
  const { data: flows, error } = await client.from('client_flows').select('*');
  
  if (error) {
    console.error('Error fetching flows:', error);
    return;
  }
  
  console.log(`Total flows: ${flows.length}`);
  flows.forEach(f => {
    console.log(`ID: ${f.id} | Name: ${f.display_name} | Client: ${f.client_id} | Created: ${f.created_at}`);
  });
}

checkFlows();
