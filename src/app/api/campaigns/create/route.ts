import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { clientId, displayName } = body;

    if (!clientId || !displayName) {
      return NextResponse.json({ error: 'Client ID and Display Name required' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();

    // 1. Get the prospecting flow for this client
    const { data: flow, error: flowError } = await supabase
      .from('client_flows')
      .select('id')
      .eq('client_id', clientId)
      .eq('flow_key', 'prospecting')
      .single();

    if (flowError || !flow) {
      return NextResponse.json({ error: 'Prospecting flow not found for this client' }, { status: 404 });
    }

    // 2. Create the campaign
    const { data: campaign, error: campError } = await supabase
      .from('campaigns')
      .insert({
        flow_id: flow.id,
        display_name: displayName,
        status: 'active',
        config: {}
      })
      .select()
      .single();

    if (campError) {
      return NextResponse.json({ error: campError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, campaign });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
