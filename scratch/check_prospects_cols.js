const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function checkProspects() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const client = createClient(url, key);

  const { data, error } = await client.from('prospects').select('*').limit(1);
  if (data && data.length > 0) {
    console.log('Prospect columns:', Object.keys(data[0]));
  } else {
    console.log('No prospects found or error:', error ? error.message : 'No data');
  }
}

checkProspects();
