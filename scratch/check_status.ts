
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://plnmouvarijbldxwaqsy.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsbm1vdXZhcmlqYmxkeHdhcXN5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzIxNjgzMCwiZXhwIjoyMDkyNzkyODMwfQ.2YBot60XWi9sqWV6Xp3uCWIm6DBIKic6g9h6HAvOodQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkCampaigns() {
  console.log('--- CAMPAIGNS ---');
  const { data: campaigns, error: camError } = await supabase
    .from('campaigns')
    .select('id, name, status, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (camError) {
    console.error('Error fetching campaigns:', camError);
    return;
  }

  campaigns.forEach(c => {
    console.log(`ID: ${c.id} | Name: ${c.name} | Status: ${c.status} | Created: ${c.created_at}`);
  });

  if (campaigns.length === 0) {
    console.log('No campaigns found.');
    return;
  }

  const campaignIds = campaigns.map(c => c.id);

  console.log('\n--- EXTENSION ACTIONS (Latest 10) ---');
  const { data: actions, error: actError } = await supabase
    .from('extension_actions')
    .select('id, campaign_id, prospect_id, action_type, status, scheduled_at, error_message')
    .in('campaign_id', campaignIds)
    .order('created_at', { ascending: false })
    .limit(10);

  if (actError) {
    console.error('Error fetching actions:', actError);
  } else {
    actions.forEach(a => {
      console.log(`ID: ${a.id} | Camp: ${a.campaign_id} | Type: ${a.action_type} | Status: ${a.status} | Scheduled: ${a.scheduled_at} | Error: ${a.error_message || 'None'}`);
    });
  }

  console.log('\n--- PROSPECTS STATUS ---');
  const { data: prospects, error: proError } = await supabase
    .from('prospects')
    .select('id, campaign_id, status, qualification_status, decision_maker')
    .in('campaign_id', campaignIds)
    .limit(10);

  if (proError) {
    console.error('Error fetching prospects:', proError);
  } else {
    prospects.forEach(p => {
      console.log(`ID: ${p.id} | Camp: ${p.campaign_id} | Name: ${p.decision_maker} | Status: ${p.status} | Qual: ${p.qualification_status}`);
    });
  }
}

checkCampaigns();
