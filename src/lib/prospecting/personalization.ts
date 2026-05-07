import OpenAI from "openai";
import { z } from "zod";
import { getOpenAIKeyForClient } from "./qualification";
import { normalizeProspectionPlaybook } from "./playbook";

const PersonalizedStepSchema = z.object({
  step_id: z.string(),
  name: z.string(),
  personalized_message: z.string().optional(),
});

const PersonalizedSequenceSchema = z.object({
  steps: z.array(PersonalizedStepSchema),
});

export type PersonalizedSequence = z.infer<typeof PersonalizedSequenceSchema>;

export async function personalizeSequenceForProspect(
  prospect: any,
  campaign: any,
  steps: any[],
  qualification: any
): Promise<PersonalizedSequence> {
  const apiKey = await getOpenAIKeyForClient(prospect.client_id || campaign.client_id);
  const openai = new OpenAI({ apiKey });
  const playbook = normalizeProspectionPlaybook(campaign.config?.prospection_playbook, {
    goal: campaign.objective,
    offer: campaign.target_description || campaign.config?.offer,
    tone: campaign.tone || campaign.config?.tone,
    roles: campaign.target_roles || campaign.config?.personas,
    industries: campaign.target_industries || campaign.config?.target_icp?.industries,
    locations: campaign.target_locations || campaign.config?.target_icp?.locations,
  });

  const systemPrompt = `
Tu es un expert en copywriting et psychologie de l'outreach B2B de haut niveau.
Ton but est de transformer une séquence générique en une conversation humaine, percutante et irrésistible pour ce prospect spécifique.

RÈGLES DE RÉDACTION "HUMAN-FIRST" :
1. **Le "Pattern Interrupt"** : Le début du message doit casser les codes habituels de la prospection. Utilise un fait précis de leur profil pour créer une connexion immédiate.
2. **Le "WIIFM" (What's In It For Me)** : Le prospect doit comprendre en 2 secondes pourquoi il devrait te répondre.
3. **Zéro friction** : Pas de demandes lourdes (ex: "êtes-vous dispo 45min ?"). Préfère des micro-engagements ou des questions ouvertes simples.
4. **Authenticité** : Évite le jargon corporate. Parle comme un humain s'adressant à un autre humain.
5. **Relances Narratives** : Chaque relance doit poursuivre la conversation sous un nouvel angle, sans jamais paraître insistante.

DONNÉES DU PROSPECT :
- Nom : ${prospect.full_name || prospect.decision_maker}
- Rôle : ${prospect.role_title || prospect.role}
- Entreprise : ${prospect.company_name}
- Analyse qualification : ${qualification.qualification_reason}
- Hooks identifiés : ${(qualification.personalization_hooks || []).join(" | ")}

CAMPAGNE :
- Objectif : ${campaign.objective}
- Ton : ${campaign.tone}
- Playbook métier : ${JSON.stringify(playbook, null, 2)}

CONSIGNES :
1. Pour chaque étape de type 'linkedin' (ou action de message), génère un message entièrement personnalisé.
2. Utilise les hooks fournis pour injecter de la preuve de recherche et de l'empathie.
3. Respecte scrupuleusement le ton "${campaign.tone}".
4. Respecte l'angle, le CTA et les interdits du playbook métier.
5. Ne modifie pas l'ordre des étapes.
6. **Langue** : Tu DOIS impérativement rédiger TOUS les messages en ${campaign.config?.language || 'français'}.
7. Réponds uniquement en JSON valide.
`.trim();

  const userPrompt = `
SÉQUENCE GÉNÉRIQUE :
${JSON.stringify(steps.map(s => ({ id: s.id, name: s.name, type: s.action_type, original_message: s.config?.message })), null, 2)}

Génère la version personnalisée de cette séquence.
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

  const parsed = JSON.parse(raw);
  return PersonalizedSequenceSchema.parse(parsed);
}
