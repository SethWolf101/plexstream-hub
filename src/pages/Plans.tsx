import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function Plans() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [plans, setPlans] = useState<any[]>([]);
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);

  useEffect(() => {
    fetchPlans();
    if (user) fetchCurrentPlan();
  }, [user]);

  const fetchPlans = async () => {
    const { data } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('price', { ascending: true });
    setPlans(data || []);
  };

  const fetchCurrentPlan = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_subscriptions')
      .select('plan_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();
    setCurrentPlan(data?.plan_id || null);
  };

  const selectPlan = async (planId: string) => {
    if (!user) {
      navigate('/auth');
      return;
    }
    const { error } = await supabase.from('user_subscriptions').insert({
      user_id: user.id,
      plan_id: planId,
    });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Plan Selected!', description: 'Your subscription is now active.' });
      setCurrentPlan(planId);
    }
  };

  const qualityColor = (q: string) => {
    if (q === '4K') return 'bg-primary text-primary-foreground';
    if (q === 'HD') return 'bg-accent text-accent-foreground';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <div className="min-h-screen bg-background pt-24 px-4 sm:px-8 lg:px-16">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">Choose Your Plan</h1>
          <p className="text-muted-foreground text-lg">All plans are currently <span className="text-primary font-semibold">FREE</span>. Pick the one that suits you.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan, i) => (
            <Card
              key={plan.id}
              className={`bg-card border-border relative overflow-hidden transition-all hover:scale-105 ${
                i === 2 ? 'ring-2 ring-primary' : ''
              }`}
            >
              {i === 2 && (
                <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-bl-lg">
                  MOST POPULAR
                </div>
              )}
              <CardContent className="p-8 flex flex-col items-center text-center">
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <Badge className={qualityColor(plan.max_quality)}>{plan.max_quality}</Badge>
                <div className="my-6">
                  <span className="text-4xl font-bold">
                    {plan.price > 0 ? `$${plan.price}` : 'Free'}
                  </span>
                  {plan.price > 0 && <span className="text-muted-foreground">/mo</span>}
                </div>
                <p className="text-sm text-muted-foreground mb-6">{plan.description}</p>
                <ul className="space-y-3 mb-8 w-full text-left">
                  {(plan.features || []).map((f: string, fi: number) => (
                    <li key={fi} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary flex-shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={currentPlan === plan.id ? 'outline' : 'default'}
                  disabled={currentPlan === plan.id}
                  onClick={() => selectPlan(plan.id)}
                >
                  {currentPlan === plan.id ? 'Current Plan' : 'Get Started'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
