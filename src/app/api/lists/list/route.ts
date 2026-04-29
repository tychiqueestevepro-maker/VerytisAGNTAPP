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

    const { data: lists, error } = await supabase
      .from('contact_lists')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[API] Fetch Lists Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, lists });
  } catch (error: any) {
    console.error('[API] Fetch Lists Critical Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
