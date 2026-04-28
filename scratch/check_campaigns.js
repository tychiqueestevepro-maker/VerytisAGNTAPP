const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function checkCampaigns() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const client = createClient(url, key);

  const { data, error } = await client.from('campaigns').select('*').limit(1);
  if (error) {
    console.error('Error selecting from campaigns:', error.message);
  } else {
    console.log('Campaigns data sample:', data);
    if (data.length > 0) {
      console.log('Columns:', Object.keys(data[0]));
    }
  }
}

checkCampaigns();
