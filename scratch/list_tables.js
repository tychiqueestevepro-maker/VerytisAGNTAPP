const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function listTables() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const client = createClient(url, key);

  const { data, error } = await client.rpc('get_tables_list'); // If I have this RPC
  if (error) {
    // Try raw query if possible, but usually restricted.
    // Let's try to query information_schema.tables if permissions allow (often they don't)
    const { data: tables, error: tableError } = await client
      .from('pg_tables') // Usually not available
      .select('tablename')
      .eq('schemaname', 'public');
    
    if (tableError) {
      console.log('Could not list tables directly. Trying common names.');
      const common = ['campaigns', 'flows', 'client_flows', 'sequences', 'prospects', 'workflow_steps'];
      for (const t of common) {
        const { error: e } = await client.from(t).select('id').limit(1);
        if (!e || e.code !== 'PGRST204' && e.code !== 'PGRST205') {
          console.log(`Table ${t} exists (or error: ${e?.code})`);
        } else {
          console.log(`Table ${t} does NOT exist (error: ${e?.code})`);
        }
      }
    } else {
      console.log('Tables:', tables);
    }
  } else {
    console.log('Tables from RPC:', data);
  }
}

listTables();
