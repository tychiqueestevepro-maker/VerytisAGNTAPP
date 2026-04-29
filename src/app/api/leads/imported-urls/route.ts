import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json({ success: false, error: 'Missing clientId' }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();

    const { data, error } = await supabase
      .from('prospects')
      .select('linkedin_url')
      .eq('client_id', clientId);

    if (error) {
      console.error('[API] Error fetching imported URLs:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const urls = data.map(p => p.linkedin_url).filter(Boolean);

    return NextResponse.json({ success: true, urls });
  } catch (error: any) {
    console.error('[API] Critical Error fetching imported URLs:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
