import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { clientId, displayName } = body;

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

    // 2. Create the campaign
    const { data: campaign, error: campError } = await supabase
      .from('campaigns')
      .insert({
        flow_id: flow.id,
        organization_id: clientId,
        name: displayName,
        display_name: displayName,
        status: 'active',
        config: {}
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
