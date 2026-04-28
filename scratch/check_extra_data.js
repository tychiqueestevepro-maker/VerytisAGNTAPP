const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function checkExtraData() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const client = createClient(url, key);

  const { data, error } = await client.from('prospects').select('id, extra_data').not('extra_data', 'is', null).limit(5);
  if (data) {
    data.forEach(p => console.log(`ID: ${p.id}, Extra:`, JSON.stringify(p.extra_data, null, 2)));
  } else {
    console.log('Error or no data:', error?.message);
  }
}

checkExtraData();
