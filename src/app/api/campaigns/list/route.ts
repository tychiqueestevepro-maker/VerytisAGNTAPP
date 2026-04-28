import { createSupabaseServerClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json({ error: 'Client ID required' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();

    // On récupère les campagnes via les flows du client
    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select(`
        id, 
        display_name, 
        description,
        config,
        status, 
        flow_id,
        client_flows!inner(client_id)
      `)
      .eq('client_flows.client_id', clientId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });



    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, campaigns });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
