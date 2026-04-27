-- La clé OpenAI est stockée dans client_configs.extra_config sous la clé "openai_api_key"
-- Elle est propre à chaque client (multi-tenant).
-- Exemple de valeur :
-- UPDATE public.client_configs
-- SET extra_config = jsonb_set(extra_config, '{openai_api_key}', '"sk-..."')
-- WHERE client_id = 'xxx';

comment on column public.client_configs.extra_config is 
  'Configuration additionnelle. Clés reconnues : openai_api_key (string).';
