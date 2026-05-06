import OpenAI from "openai";
import { z } from "zod";
import { getOpenAIKeyForClient } from "@/lib/prospecting/qualification";
import { Campaign } from "@/types/flows";

const SequenceStepSchema: z.ZodType<any> = z.lazy(() => z.object({
  type: z.string(), // 'linkedin', 'wait', 'condition', 'end'
  name: z.string(),
  channel: z.string().optional().default('LinkedIn'),
  config: z.object({
    message: z.string().optional(),
    days: z.number().optional(),
    yesBranch: z.array(SequenceStepSchema).optional(),
    noBranch: z.array(SequenceStepSchema).optional(),
  }).optional().default({})
}));

const SequenceResultSchema = z.object({
  name: z.string(),
  description: z.string(),
  steps: z.array(SequenceStepSchema)
});

export type GeneratedSequence = z.infer<typeof SequenceResultSchema>;

export async function generateSequenceForCampaign(
  campaign: Campaign,
  brandContext?: string
): Promise<GeneratedSequence> {
  const apiKey = await getOpenAIKeyForClient(campaign.organization_id || (campaign as any).client_id);
  const openai = new OpenAI({ apiKey });

  const systemPrompt = `
Tu es un expert en Growth Hacking et Stratégie d'Outreach B2B de classe mondiale (inspiration: Lemlist, Gojibery).
Ton objectif est de concevoir une séquence de prospection automatisée ultra-performante, humaine et percutante pour "closer" des prospects qualifiés.

RÈGLES D'OR DE L'OUTREACH HUMAIN & IMPACTANT :
1. **Pas de robotisme** : Bannis les structures "Bonjour [Nom], j'ai vu votre profil...". Utilise des approches basées sur la curiosité, l'empathie ou un "pattern interrupt".
2. **Psychologie de la réciprocité** : Pose une question pertinente sur leur métier ou partage une observation unique avant de demander un appel.
3. **Brièveté radicale** : Les messages doivent être courts (max 3-4 phrases). Personne ne lit les pavés.
4. **Comportement Humain** : Simule un vrai parcours (Visite -> Attente -> Invitation -> Message).
5. **Relances à valeur ajoutée** : Ne jamais faire de "simple relance". Chaque message doit apporter un nouvel angle, une preuve sociale ou une ressource utile.
6. **Ton Premium** : Le ton "${campaign.tone || 'Professionnel'}" doit transparaître sans paraître forcé.
7. **Langue** : Tu DOIS impérativement rédiger TOUS les messages et noms d'étapes en ${campaign.config?.language || 'français'}.

STRUCTURE DU JSON RÉCURSIF :
Tu DOIS répondre avec un objet JSON respectant cette structure, en supportant les branchements (OUI/NON) :
{
  "name": "Nom de la séquence",
  "description": "Stratégie globale",
  "steps": [
    {
      "type": "linkedin" | "wait" | "condition" | "end",
      "name": "Nom convivial",
      "config": {
        "message": "Contenu (si message)",
        "days": 3, // (si wait)
        "yesBranch": [], // Liste d'étapes RECURSIVE (si type=condition) pour le chemin OUI
        "noBranch": []   // Liste d'étapes RECURSIVE (si type=condition) pour le chemin NON
      }
    }
  ]
}

TYPES D'ÉTAPES :
- 'linkedin' : Actions (Visite, Invitation, Message).
- 'wait' : Pause.
- 'condition' : Test (ex: 'Si a répondu', 'Si profil LinkedIn trouvé').
- 'end' : Fin.

Variables : {{first_name}}, {{company}}, {{role}}.
Réponds UNIQUEMENT avec le JSON valide.
`.trim();

  const userPrompt = `
Génère une séquence complète et intelligente pour cette campagne.
N'hésite pas à utiliser des conditions (type: 'condition') pour différencier les parcours (ex: si le prospect répond, stopper ou envoyer un message de suivi ; sinon, relancer).
La séquence doit être robuste et couvrir au moins 2 relances.
`.trim();

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 0.8,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("Réponse vide du LLM.");

  // Resilient JSON cleaning
  let cleanJson = raw.trim();
  if (cleanJson.includes("```")) {
    const match = cleanJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (match) cleanJson = match[1];
  }
  
  // Remove potential leading/trailing non-JSON characters
  const startChar = cleanJson.indexOf('{');
  const endChar = cleanJson.lastIndexOf('}');
  if (startChar !== -1 && endChar !== -1) {
    cleanJson = cleanJson.substring(startChar, endChar + 1);
  }

  let parsed: any;
  try {
    parsed = JSON.parse(cleanJson);
  } catch (e) {
    console.error("JSON Parse Error. Raw content:", raw);
    throw new Error("L'IA a retourné un JSON malformé.");
  }
  
  // Handle cases where the LLM might wrap the result in a "sequence" or "data" key
  if (!parsed.steps && parsed.sequence) {
    parsed = parsed.sequence;
  } else if (!parsed.steps && parsed.data) {
    parsed = parsed.data;
  }

  // Final normalization before Zod
  if (parsed.steps && Array.isArray(parsed.steps)) {
    parsed.steps = parsed.steps.map((s: any) => {
      const rawType = s.type || s.action_type || 'linkedin';
      const normalizedType = typeof rawType === 'string' ? rawType.toLowerCase() : 'linkedin';
      
      // Ensure type is one of our supported ones
      const supportedTypes = ['linkedin', 'wait', 'condition', 'end'];
      const finalType = supportedTypes.includes(normalizedType) ? normalizedType : 'linkedin';

      return {
        ...s,
        type: finalType,
        channel: s.channel || 'LinkedIn',
        config: s.config || {}
      };
    });
  }

  try {
    return SequenceResultSchema.parse(parsed);
  } catch (error: any) {
    console.error("Zod Validation Error in generateSequenceForCampaign:", error);
    console.log("Cleaned JSON was:", cleanJson);
    throw error;
  }
}
