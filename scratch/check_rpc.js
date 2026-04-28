const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function checkRPC() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const client = createClient(url, key);

  // Try to find if there's an exec sql RPC (very common in these agentic setups)
  const { data, error } = await client.rpc('exec_sql', { sql: 'select 1' });
  if (error) {
    console.log('exec_sql RPC not found or failed:', error.message);
  } else {
    console.log('exec_sql RPC exists!');
  }
}

checkRPC();
