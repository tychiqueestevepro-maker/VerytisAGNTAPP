const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('Missing Supabase env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDb() {
  const { data: audit, error: auditError } = await supabase.from('audit_logs').select('*').limit(5);
  console.log('Audit Logs:', audit?.length || 0, auditError || '');

  const { data: runs, error: runsError } = await supabase.from('agent_runs').select('*').limit(5);
  console.log('Agent Runs:', runs?.length || 0, runsError || '');
}

checkDb();
