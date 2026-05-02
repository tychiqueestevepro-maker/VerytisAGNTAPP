import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { client_id, linkedin_url, message_content } = await req.json();

    if (!client_id || !linkedin_url) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Find the prospect
    const { data: prospect, error: fetchErr } = await supabase
      .from("prospects")
      .select("id, decision_maker, campaign_id")
      .eq("client_id", client_id)
      .eq("linkedin_url", linkedin_url)
      .maybeSingle();

    if (fetchErr || !prospect) {
      console.warn(`[API] Received reply for unknown prospect: ${linkedin_url}`);
      return NextResponse.json({ error: "Prospect not found" }, { status: 404 });
    }

    // 2. Mark as replied
    const { error: updateErr } = await supabase
      .from("prospects")
      .update({
        status: "replied",
        qualification_status: "replied",
        updated_at: new Date().toISOString(),
      })
      .eq("id", prospect.id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    console.log(`[API] Prospect ${prospect.decision_maker} marked as replied. Workflow stopped.`);

    return NextResponse.json({ 
      success: true, 
      prospectId: prospect.id,
      decision_maker: prospect.decision_maker
    });
  } catch (error: any) {
    console.error("[API] Error handling extension reply:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
