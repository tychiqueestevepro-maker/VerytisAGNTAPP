const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function checkTables() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const client = createClient(url, key);

  const { data, error } = await client.rpc('get_tables'); // This might not work if RPC doesn't exist
  // Let's just try to select from a few likely names
  const tables = ['campaigns', 'client_flows', 'workflows', 'sequences', 'prospects'];
  for (const table of tables) {
    const { error } = await client.from(table).select('*', { count: 'exact', head: true });
    if (!error) {
      console.log(`Table ${table} exists.`);
    } else {
      console.log(`Table ${table} does NOT exist or error: ${error.message}`);
    }
  }
}

checkTables();
