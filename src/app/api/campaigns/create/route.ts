import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { normalizeProspectionPlaybook } from '@/lib/prospecting/playbook';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { clientId, displayName, config = {} } = body;

    if (!clientId || !displayName) {
      return NextResponse.json({ error: 'Client ID and Display Name required' }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();

    // 1. Get the prospecting flow for this client
    const { data: flow, error: flowError } = await supabase
      .from('client_flows')
      .select('id')
      .eq('client_id', clientId)
      .eq('flow_key', 'prospecting')
      .single();

    if (flowError || !flow) {
      console.error('[API] Prospecting flow not found:', flowError);
      return NextResponse.json({ error: 'Prospecting flow not found for this client' }, { status: 404 });
    }

    const { data: clientConfig } = await supabase
      .from('client_configs')
      .select('extra_config')
      .eq('client_id', clientId)
      .maybeSingle();

    const campaignConfig = {
      ...config,
      target_icp: {
        sectors: [],
        company_size: [],
        locations: [],
        ...(config.target_icp || {}),
      },
      personas: config.personas || [],
      tone: config.tone || "",
      prospection: {
        mode: "auto",
        prospects_per_day: 17,
        messages_per_day: 7,
        invitations_per_day: 10,
        search_time: "09:00",
        end_time: "18:00",
        timezone: "Europe/Paris",
        ...(config.prospection || {}),
      },
      injection: {
        auto_add: true,
        ignore_duplicates: true,
        prioritize_linkedin: true,
        ...(config.injection || {}),
      },
      language: config.language || "français",
      prospection_playbook: normalizeProspectionPlaybook(
        config.prospection_playbook ??
        clientConfig?.extra_config?.prospection_playbook_defaults ??
        clientConfig?.extra_config?.prospection_playbook,
        {
          goal: config.offer || config.target_description || displayName,
          offer: config.offer || config.target_description,
          tone: config.tone,
          roles: config.personas || [],
          industries: config.target_icp?.industries || config.target_icp?.sectors || [],
          companySizes: config.target_icp?.company_size || config.target_icp?.company_sizes || [],
          locations: config.target_icp?.locations || config.target_icp?.geographies || [],
        }
      ),
    };

    // 2. Create the campaign
    const { data: campaign, error: campError } = await supabase
      .from('campaigns')
      .insert({
        flow_id: flow.id,
        organization_id: clientId,
        name: displayName,
        display_name: displayName,
        status: 'active',
        config: campaignConfig
      })
      .select()
      .single();

    if (campError) {
      console.error('[API] Create Campaign Error:', campError);
      return NextResponse.json({ error: campError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, campaign });
  } catch (error: any) {
    console.error('[API] Create Campaign Critical Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
