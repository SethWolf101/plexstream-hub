
-- Subscription plans
CREATE TABLE public.subscription_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  max_streams INTEGER NOT NULL DEFAULT 1,
  max_quality TEXT NOT NULL DEFAULT 'HD',
  description TEXT,
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Plans are viewable by everyone"
  ON public.subscription_plans FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage plans"
  ON public.subscription_plans FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- User subscriptions
CREATE TABLE public.user_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plan_id UUID REFERENCES public.subscription_plans(id) NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ends_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription"
  ON public.user_subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscription"
  ON public.user_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all subscriptions"
  ON public.user_subscriptions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Seed Netflix-style plans (all free for now)
INSERT INTO public.subscription_plans (name, price, max_streams, max_quality, description, features) VALUES
  ('Basic', 0, 1, 'SD', 'Watch on 1 device at a time in SD quality', '["1 device at a time", "SD quality (480p)", "Download on 1 device"]'::jsonb),
  ('Standard', 0, 2, 'HD', 'Watch on 2 devices at a time in HD quality', '["2 devices at a time", "HD quality (1080p)", "Download on 2 devices", "Ad-free"]'::jsonb),
  ('Premium', 0, 4, '4K', 'Watch on 4 devices at a time in 4K+HDR quality', '["4 devices at a time", "4K + HDR quality", "Download on 6 devices", "Ad-free", "Spatial Audio"]'::jsonb);
