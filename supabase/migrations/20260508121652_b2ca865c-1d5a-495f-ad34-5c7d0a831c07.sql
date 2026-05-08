CREATE TABLE IF NOT EXISTS public.service_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name text NOT NULL UNIQUE CHECK (service_name IN ('sonarr', 'radarr', 'prowlarr')),
  base_url text NOT NULL,
  api_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.service_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view service configs" ON public.service_configs;
CREATE POLICY "Admins can view service configs"
ON public.service_configs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can create service configs" ON public.service_configs;
CREATE POLICY "Admins can create service configs"
ON public.service_configs
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can update service configs" ON public.service_configs;
CREATE POLICY "Admins can update service configs"
ON public.service_configs
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can delete service configs" ON public.service_configs;
CREATE POLICY "Admins can delete service configs"
ON public.service_configs
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS update_service_configs_updated_at ON public.service_configs;
CREATE TRIGGER update_service_configs_updated_at
BEFORE UPDATE ON public.service_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();