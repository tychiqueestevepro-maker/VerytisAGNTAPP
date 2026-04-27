-- Table pour les configurations globales du système
CREATE TABLE IF NOT EXISTS public.global_configs (
    key text PRIMARY KEY,
    value jsonb NOT NULL,
    updated_at timestamptz DEFAULT now()
);

-- RLS : Seul le service_role peut lire/écrire par défaut, ou configurer des règles strictes
ALTER TABLE public.global_configs ENABLE ROW LEVEL SECURITY;

-- Insertion de la clé OpenAI (exemple de structure)
-- INSERT INTO public.global_configs (key, value) 
-- VALUES ('openai_master_key', '"sk-..."');

COMMENT ON TABLE public.global_configs IS 'Configurations globales de l''application (Master keys, etc).';
