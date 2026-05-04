const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envPath = '/Users/tychiqueesteve/VerytisAGNTAPP/.env.local';
const env = fs.readFileSync(envPath, 'utf8').split('\n').reduce((acc, line) => {
  const [key, value] = line.split('=');
  if (key && value) acc[key.trim()] = value.trim();
  return acc;
}, {});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function repairAlphaList() {
  const listId = "ba032dd7-1ca4-4ff1-9987-067b653ef15c";
  const twoHoursAgo = new Date(Date.now() - 7200000).toISOString();
  
  console.log("Detecting orphan prospects...");
  
  const { data: prospects } = await supabase
    .from('prospects')
    .select('id')
    .gt('created_at', twoHoursAgo);

  if (!prospects || prospects.length === 0) {
    console.log("No prospects to link.");
    return;
  }

  console.log(`Linking ${prospects.length} prospects to list ${listId}...`);
  
  const members = prospects.map(p => ({
    list_id: listId,
    prospect_id: p.id
  }));

  // Attempt insert one by one or in bulk with ignore duplicates
  const { error } = await supabase
    .from('prospect_list_members')
    .upsert(members, { onConflict: 'list_id, prospect_id' });

  if (error) {
    console.error("Repair failed:", error.message);
    // Try fallback if constraint is different
    console.log("Trying fallback insertion...");
    for (const member of members) {
      await supabase.from('prospect_list_members').insert(member).catch(() => {});
    }
  } else {
    console.log("Success! Your prospects are now in the ALPHA list.");
  }
}

repairAlphaList();
