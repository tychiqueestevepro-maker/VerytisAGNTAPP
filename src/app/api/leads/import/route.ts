import { createSupabaseServiceClient } from '@/lib/supabase/server';
import { preScoreProspect } from '@/lib/prospecting/scoring';
import { NextResponse } from 'next/server';

const PROSPECT_PHOTOS_BUCKET = 'prospect-photos';
const PROSPECT_PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
type SupabaseServiceClient = ReturnType<typeof createSupabaseServiceClient>;

type LeadInput = {
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  role?: string | null;
  role_title?: string | null;
  title?: string | null;
  headline?: string | null;
  company?: string | null;
  company_name?: string | null;
  profile_url?: string | null;
  linkedin_url?: string | null;
  photo_url?: string | null;
  photo_data_url?: string | null;
  image_url?: string | null;
  page_url?: string | null;
  source?: string | null;
  scraped_at?: string | null;
  about?: string | null;
  location?: string | null;
  website?: string | null;
  website_url?: string | null;
  company_description?: string | null;
  raw_result_text?: string | null;
  scrape_mode?: string | null;
  fast_import?: boolean | null;
};

// Cache the bucket check to avoid redundant API calls
let bucketEnsured = false;

async function ensureProspectPhotosBucket(supabaseService: SupabaseServiceClient) {
  if (bucketEnsured) return;

  const { data: bucket, error: getError } = await supabaseService.storage.getBucket(PROSPECT_PHOTOS_BUCKET);

  if (!bucket && getError) {
    const { error: createError } = await supabaseService.storage.createBucket(PROSPECT_PHOTOS_BUCKET, {
      public: true,
      fileSizeLimit: 5242880,
      allowedMimeTypes: PROSPECT_PHOTO_MIME_TYPES
    });

    if (createError && !/already exists/i.test(createError.message)) {
      throw createError;
    }
  }

  const allowedMimeTypes = Array.isArray(bucket?.allowed_mime_types) ? bucket.allowed_mime_types : [];
  const shouldUpdateBucket = Boolean(bucket) && (
    !bucket?.public ||
    PROSPECT_PHOTO_MIME_TYPES.some((mimeType) => !allowedMimeTypes.includes(mimeType))
  );

  if (shouldUpdateBucket) {
    const { error: updateError } = await supabaseService.storage.updateBucket(PROSPECT_PHOTOS_BUCKET, {
      public: true,
      fileSizeLimit: 5242880,
      allowedMimeTypes: PROSPECT_PHOTO_MIME_TYPES
    });

    if (updateError) throw updateError;
  }

  bucketEnsured = true;
}

async function uploadPhotoToBucket(supabaseService: SupabaseServiceClient, url: string, clientId: string) {
  if (!url) return null;
  const isDataUrl = url.startsWith('data:image/');

  try {
    let buffer: Buffer;
    let contentType = 'image/jpeg';

    if (isDataUrl) {
      const match = url.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!match) return null;

      contentType = match[1];
      buffer = Buffer.from(match[2], 'base64');
    } else if (/^https?:\/\//i.test(url)) {
      const response = await fetch(url);
      if (!response.ok) return url;

      const responseContentType = response.headers.get('content-type');
      if (responseContentType?.startsWith('image/')) {
        contentType = responseContentType;
      }

      const arrayBuffer = await response.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else {
      return null;
    }

    const extension = contentType.includes('png')
      ? 'png'
      : contentType.includes('webp')
        ? 'webp'
        : contentType.includes('avif')
          ? 'avif'
          : 'jpg';
    const filename = `${clientId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${extension}`;
    
    await ensureProspectPhotosBucket(supabaseService);
    
    const { error } = await supabaseService.storage
      .from(PROSPECT_PHOTOS_BUCKET)
      .upload(filename, buffer, {
        contentType,
        upsert: true
      });
      
    if (error) {
      console.error('Storage upload error:', error);
      return isDataUrl ? null : url;
    }
    const { data } = supabaseService.storage.from(PROSPECT_PHOTOS_BUCKET).getPublicUrl(filename);
    return data.publicUrl;
  } catch (err) {
    console.error('Photo upload failed:', err);
    return isDataUrl ? null : url;
  }
}

export async function POST(request: Request) {
  console.log('[API] Lead Import request received');
  try {
    // IMPORTANT: Use service client to bypass RLS for extension imports which may be unauthenticated
    const supabase = createSupabaseServiceClient();
    
    const body = await request.json();
    const { source, leads, clientId, campaignId, listId } = body;

    console.log('[API] Import params:', { leadsCount: leads?.length, clientId, campaignId, listId });

    if (!leads || !Array.isArray(leads)) {
      return NextResponse.json({ error: 'Données de leads invalides' }, { status: 400 });
    }

    if (!clientId) {
      return NextResponse.json({ error: 'ID Client manquant dans la requête' }, { status: 400 });
    }

    // Vérification que le client existe
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      console.error('[API] Client not found or error:', clientError);
      return NextResponse.json({ error: 'ID Client invalide ou inconnu' }, { status: 403 });
    }

    let campaign = null;
    if (campaignId) {
      const { data: campaignData, error: campaignError } = await supabase
        .from('campaigns')
        .select('*, client_flows!inner(client_id)')
        .eq('id', campaignId)
        .eq('client_flows.client_id', clientId)
        .single();

      if (campaignError || !campaignData) {
        return NextResponse.json({ error: 'Campagne invalide pour ce client' }, { status: 403 });
      }

      campaign = campaignData;
    }

    // Préparation des données pour la table 'prospects'
    const prospectsToInsert = await Promise.all(leads.map(async (lead: LeadInput) => {
      const originalPhotoUrl = lead.photo_data_url || lead.photo_url || lead.image_url || null;
      let finalPhotoUrl = originalPhotoUrl;
      
      // Only upload if it's not already a public storage URL
      if (originalPhotoUrl && !lead.fast_import && !originalPhotoUrl.includes(PROSPECT_PHOTOS_BUCKET)) {
        finalPhotoUrl = await uploadPhotoToBucket(supabase, originalPhotoUrl, clientId);
      }

      const fullName = lead.name || [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Inconnu';
      const role = lead.role || lead.role_title || lead.title || lead.headline || null;
      const companyName = lead.company || lead.company_name || null;
      const linkedinUrl = lead.profile_url || lead.linkedin_url || null;
      const website = lead.website || lead.website_url || null;
      const companyDescription = lead.company_description || lead.about || lead.raw_result_text || lead.headline || null;

      const baseProspect = {
        client_id: clientId,
        campaign_id: campaignId || null,
        decision_maker: fullName,
        role,
        company_name: companyName,
        linkedin_url: linkedinUrl,
        photo_url: finalPhotoUrl,
        source_url: lead.page_url || null,
        source: lead.source || source || 'linkedin',
        website,
        location: lead.location || null,
        status: 'discovered',
        full_name: fullName,
        role_title: role,
        company_description: companyDescription,
        profile_url: linkedinUrl,
        website_url: website,
        raw_data: lead,
        extra_data: {
          raw_data: lead,
          scraped_at: lead.scraped_at,
          imported_via: 'chrome_extension',
          original_headline: lead.headline || null,
          about: lead.about || null,
          company_description: companyDescription,
          raw_result_text: lead.raw_result_text || null,
          scrape_mode: lead.scrape_mode || null,
          fast_import: Boolean(lead.fast_import)
        }
      };

      const preScore = campaign ? preScoreProspect(baseProspect, campaign) : null;

      return {
        ...baseProspect,
        fit_score: preScore?.score ?? null,
        pre_score: preScore?.score ?? null,
        pre_score_level: preScore?.level ?? null,
        qualification_status: preScore ? 'pre_scored' : 'collected'
      };
    }));

    // Use UPSERT to handle existing prospects and get their IDs
    // We assume a unique constraint on (client_id, linkedin_url) exists or we use linkedin_url as conflict target
    const { data: insertedProspects, error } = await supabase
      .from('prospects')
      .upsert(prospectsToInsert, { 
        onConflict: 'client_id, linkedin_url',
        ignoreDuplicates: false // We want to update them or at least get the IDs
      })
      .select('id');

    let finalProspects = insertedProspects || [];

    if (error) {
      console.error('[API] Supabase insertion error:', error);
      // Fallback: if 'client_id, linkedin_url' constraint doesn't exist, try just 'linkedin_url'
      if (error.message.includes('constraint')) {
         const { data: retryData, error: retryError } = await supabase
           .from('prospects')
           .upsert(prospectsToInsert, { onConflict: 'linkedin_url' })
           .select('id');
           
         if (retryError) {
            console.error('[API] Retry upsert failed:', retryError);
            return NextResponse.json({ error: retryError.message }, { status: 500 });
         }
         finalProspects = retryData || [];
      } else {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    finalProspects = finalProspects || [];
    console.log('[API] Prospects inserted/upserted:', finalProspects.length);

    // Link prospects to the list if listId is provided
    if (listId && finalProspects.length > 0) {
      const listMembers = finalProspects.map((p: { id: string }) => ({
        list_id: listId,
        prospect_id: p.id
      }));

      console.log('[API] Adding to list members:', { listId, membersCount: listMembers.length });

      // Use UPSERT for list members to avoid primary key violations on duplicates
      const { error: listError } = await supabase
        .from('prospect_list_members')
        .upsert(listMembers, { onConflict: 'list_id, prospect_id' });

      if (listError) {
        console.error('[API] Error adding to list members:', listError);
      } else {
        console.log('[API] Successfully added to list members');
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `${prospectsToInsert.length} prospects traités avec succès.`,
      count: prospectsToInsert.length 
    });

  } catch (error: unknown) {
    console.error('[API] Critical error on import route:', error);
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
