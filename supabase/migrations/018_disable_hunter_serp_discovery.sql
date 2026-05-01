-- Disable unused agents.
-- The product now relies on LinkedIn extension imports, CSV imports, and manual
-- qualification in the app. SERP discovery, extension cleanup, enrichment and
-- WhatsApp validation are intentionally inactive because they add complexity
-- without improving the current product flow.

begin;

update public.agents
set
  is_active = false,
  description = 'Inactive: SERP discovery removed from product. Use LinkedIn extension or CSV import, then manual qualification.',
  system_prompt = 'Inactive. Do not schedule Hunter/SERP discovery runs.',
  default_config = coalesce(default_config, '{}'::jsonb)
    || '{"disabled_reason":"SERP discovery disabled. LinkedIn extension and CSV imports remain the supported acquisition paths."}'::jsonb,
  updated_at = now()
where slug = 'hunter';

update public.agents
set
  is_active = false,
  description = 'Inactive: extension cleanup is now handled by the app and LinkedIn extension import pipeline.',
  system_prompt = 'Inactive. Do not schedule extension cleanup runs.',
  default_config = coalesce(default_config, '{}'::jsonb)
    || '{"disabled_reason":"Extension cleanup is handled directly by the app/extension import pipeline."}'::jsonb,
  updated_at = now()
where slug = 'extension_ops';

update public.agents
set
  is_active = false,
  description = 'Inactive: enrichment has no verified external provider in the current product flow.',
  system_prompt = 'Inactive. Do not schedule enrichment runs until backed by a verified provider.',
  default_config = coalesce(default_config, '{}'::jsonb)
    || '{"disabled_reason":"Enrichment disabled until backed by Apollo, Clay, Hunter.io, LinkedIn API, or another verified source."}'::jsonb,
  updated_at = now()
where slug = 'enrichment';

update public.agents
set
  is_active = false,
  description = 'Inactive: validation now happens inside the app.',
  system_prompt = 'Inactive. Do not schedule WhatsApp validation runs.',
  default_config = coalesce(default_config, '{}'::jsonb)
    || '{"disabled_reason":"WhatsApp validation disabled because validation happens in-app."}'::jsonb,
  updated_at = now()
where slug = 'whatsapp_validation';

update public.workflow_steps
set is_active = false
where agent_id in (
  select id
  from public.agents
  where slug in ('hunter', 'extension_ops', 'enrichment', 'whatsapp_validation')
);

commit;
