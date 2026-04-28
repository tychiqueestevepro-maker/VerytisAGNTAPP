const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log("Checking agent_runs...");
  
  const { data: runs, error: runsError } = await supabase
    .from('agent_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (runsError) {
    console.error("Error fetching agent_runs:", runsError);
    return;
  }
  
  console.log("Latest Agent Runs:", JSON.stringify(runs, null, 2));
}

check();
