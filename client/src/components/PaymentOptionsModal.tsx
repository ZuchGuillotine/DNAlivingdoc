import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, ArrowRight } from 'lucide-react';
import { PRODUCTS, TIERS } from '@/lib/stripe-price-ids';
import { apiRequest } from '@/lib/queryClient';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

type PaymentOptionsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function PaymentOptionsModal({ isOpen, onClose }: PaymentOptionsModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'monthly' | 'yearly'>('monthly');

  // Calculate annual savings
  const calculateSavings = (tier: 'starter' | 'pro') => {
    const monthly = TIERS[tier].MONTHLY.price;
    const yearly = TIERS[tier].YEARLY.price;
    const annualMonthly = monthly * 12;
    const savings = Math.round(((annualMonthly - yearly) / annualMonthly) * 100);
    return savings;
  };

  const handlePlanSelection = async (tier: 'starter' | 'pro', interval: 'MONTHLY' | 'YEARLY') => {
    try {
      setIsLoading(true);
      
      const priceId = TIERS[tier][interval].id;
      
      // Create a server-side checkout session for better tracking and post-payment handling
      const response = await apiRequest('POST', '/api/stripe/create-checkout-session', {
        priceId,
        successUrl: `${window.location.origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: window.location.origin,
        customerEmail: null, // Will be filled in if user is logged in on backend
      });
      
      const data = await response.json();
      
      // Redirect to Stripe checkout
      window.location.href = data.url;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      // Fallback to direct Stripe checkout links if the server endpoint fails
      window.location.href = TIERS[tier][interval].url;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">Upgrade Your Plan</DialogTitle>
          <DialogDescription>
            Choose the plan that best fits your health optimization journey
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="monthly" className="w-full" onValueChange={(value) => setSelectedTab(value as 'monthly' | 'yearly')}>
          <div className="flex justify-center mb-6">
            <TabsList>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="yearly">Yearly <span className="ml-1 text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">Save 15-20%</span></TabsTrigger>
            </TabsList>
          </div>

          {/* Monthly Plan Options */}
          <TabsContent value="monthly" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Starter Plan */}
              <Card className="border-2 border-primary/20 hover:border-primary/50 transition-all">
                <CardHeader>
                  <CardTitle>Starter AI Essentials</CardTitle>
                  <CardDescription>Essential AI features for health optimization beginners</CardDescription>
                  <div className="mt-2 text-3xl font-bold">${TIERS.starter.MONTHLY.price}<span className="text-sm font-normal text-muted-foreground">/month</span></div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span>3 AI health chats per day</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span>10 Lab result uploads per month</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span>Basic supplement tracking</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span>Weekly health insights</span>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    className="w-full gap-2"
                    onClick={() => handlePlanSelection('starter', 'MONTHLY')}
                    disabled={isLoading}
                  >
                    {isLoading ? <LoadingSpinner /> : <>Get Started <ArrowRight className="h-4 w-4" /></>}
                  </Button>
                </CardFooter>
              </Card>

              {/* Pro Plan */}
              <Card className="border-2 border-primary shadow-lg hover:border-primary/90 transition-all">
                <CardHeader>
                  <div className="bg-primary text-primary-foreground text-xs rounded-full px-2.5 py-0.5 w-fit mb-2">MOST POPULAR</div>
                  <CardTitle>Pro Biohacker Suite</CardTitle>
                  <CardDescription>Advanced features for the dedicated health optimizer</CardDescription>
                  <div className="mt-2 text-3xl font-bold">${TIERS.pro.MONTHLY.price}<span className="text-sm font-normal text-muted-foreground">/month</span></div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span><strong>Unlimited</strong> AI health chats</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span><strong>Unlimited</strong> lab result uploads</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span>Advanced supplement tracking with insights</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span>Daily personalized health recommendations</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span>Priority feature releases</span>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    className="w-full gap-2"
                    onClick={() => handlePlanSelection('pro', 'MONTHLY')}
                    disabled={isLoading}
                  >
                    {isLoading ? <LoadingSpinner /> : <>Upgrade to Pro <ArrowRight className="h-4 w-4" /></>}
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </TabsContent>

          {/* Yearly Plan Options */}
          <TabsContent value="yearly" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Starter Plan */}
              <Card className="border-2 border-primary/20 hover:border-primary/50 transition-all">
                <CardHeader>
                  <CardTitle>Starter AI Essentials</CardTitle>
                  <CardDescription>Essential AI features for health optimization beginners</CardDescription>
                  <div className="mt-2 text-3xl font-bold">${(TIERS.starter.YEARLY.price / 12).toFixed(2)}<span className="text-sm font-normal text-muted-foreground">/month</span></div>
                  <div className="text-sm text-primary">Save {calculateSavings('starter')}% with annual billing</div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span>3 AI health chats per day</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span>10 Lab result uploads per month</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span>Basic supplement tracking</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span>Weekly health insights</span>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    className="w-full gap-2"
                    onClick={() => handlePlanSelection('starter', 'YEARLY')}
                    disabled={isLoading}
                  >
                    {isLoading ? <LoadingSpinner /> : <>Get Annual Plan <ArrowRight className="h-4 w-4" /></>}
                  </Button>
                </CardFooter>
              </Card>

              {/* Pro Plan */}
              <Card className="border-2 border-primary shadow-lg hover:border-primary/90 transition-all">
                <CardHeader>
                  <div className="bg-primary text-primary-foreground text-xs rounded-full px-2.5 py-0.5 w-fit mb-2">BEST VALUE</div>
                  <CardTitle>Pro Biohacker Suite</CardTitle>
                  <CardDescription>Advanced features for the dedicated health optimizer</CardDescription>
                  <div className="mt-2 text-3xl font-bold">${(TIERS.pro.YEARLY.price / 12).toFixed(2)}<span className="text-sm font-normal text-muted-foreground">/month</span></div>
                  <div className="text-sm text-primary">Save {calculateSavings('pro')}% with annual billing</div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span><strong>Unlimited</strong> AI health chats</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span><strong>Unlimited</strong> lab result uploads</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span>Advanced supplement tracking with insights</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span>Daily personalized health recommendations</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span>Priority feature releases</span>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    className="w-full gap-2"
                    onClick={() => handlePlanSelection('pro', 'YEARLY')}
                    disabled={isLoading}
                  >
                    {isLoading ? <LoadingSpinner /> : <>Upgrade to Annual Pro <ArrowRight className="h-4 w-4" /></>}
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <div className="text-center text-sm text-muted-foreground mt-6">
          All plans include a 14-day money-back guarantee. No questions asked.
        </div>
      </DialogContent>
    </Dialog>
  );
}