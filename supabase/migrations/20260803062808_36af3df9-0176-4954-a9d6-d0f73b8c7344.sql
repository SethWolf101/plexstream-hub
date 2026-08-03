GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT USAGE ON TYPE public.app_role TO anon, authenticated, service_role;