import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = createSupabaseServiceClient();
    const { clientId, name, description } = await request.json();

    if (!clientId || !name) {
      return NextResponse.json({ error: 'Client ID and name are required' }, { status: 400 });
    }

    const { data: list, error } = await supabase
      .from('contact_lists')
      .insert([
        {
          client_id: clientId,
          name,
          description
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('[API] Create List Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, list });
  } catch (error: any) {
    console.error('[API] Create List Critical Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
