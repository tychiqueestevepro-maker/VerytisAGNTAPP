import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json({ error: 'Client ID required' }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();

    // On récupère les campagnes via organization_id
    const { data: campaigns, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('organization_id', clientId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[API] Fetch Campaigns Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, campaigns });
  } catch (error: any) {
    console.error('[API] Fetch Campaigns Critical Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
