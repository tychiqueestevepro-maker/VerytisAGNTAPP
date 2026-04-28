import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

const PROSPECT_PHOTOS_BUCKET = 'prospect-photos';
const PROSPECT_PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

type LeadInput = {
  name?: string | null;
  role?: string | null;
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
};

async function ensureProspectPhotosBucket() {
  const supabaseService = createSupabaseServiceClient();
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

  return supabaseService;
}

async function uploadPhotoToBucket(url: string, clientId: string) {
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
    
    const supabaseService = await ensureProspectPhotosBucket();
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
  try {
    const supabase = await createSupabaseServerClient();
    
    // Récupération des données envoyées par l'extension
    const body = await request.json();
    const { source, leads, clientId, campaignId } = body;

    if (!leads || !Array.isArray(leads)) {
      return NextResponse.json({ error: 'Données de leads invalides' }, { status: 400 });
    }

    if (!clientId) {
      return NextResponse.json({ error: 'ID Client manquant dans la requête' }, { status: 400 });
    }

    // Vérification que le client existe bien dans la base
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: 'ID Client invalide ou inconnu' }, { status: 403 });
    }

    // Préparation des données pour la table 'prospects'
    const prospectsToInsert = await Promise.all(leads.map(async (lead: LeadInput) => {
      const originalPhotoUrl = lead.photo_data_url || lead.photo_url || lead.image_url || null;
      let finalPhotoUrl = originalPhotoUrl;
      
      if (originalPhotoUrl) {
        finalPhotoUrl = await uploadPhotoToBucket(originalPhotoUrl, clientId);
      }

      return {
        client_id: clientId,
        campaign_id: campaignId || null,
        decision_maker: lead.name || 'Inconnu',
        role: lead.role || lead.title || lead.headline || null,
        company_name: lead.company || lead.company_name || null,
        linkedin_url: lead.profile_url || lead.linkedin_url || null,
        photo_url: finalPhotoUrl,
        source_url: lead.page_url || null,
        source: lead.source || source || 'linkedin',
        status: 'discovered',
        extra_data: {
          scraped_at: lead.scraped_at,
          imported_via: 'chrome_extension',
          original_headline: lead.headline || null
        }
      };
    }));

    // Insertion dans la base de données
    const { error } = await supabase
      .from('prospects')
      .insert(prospectsToInsert)
      .select();

    if (error) {
      console.error('Erreur d\'insertion Supabase:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `${prospectsToInsert.length} prospects importés avec succès.`,
      count: prospectsToInsert.length 
    });

  } catch (error: unknown) {
    console.error('Erreur critique sur la route d\'import:', error);
    const message = error instanceof Error ? error.message : 'Erreur inconnue';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
