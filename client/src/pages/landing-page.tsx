import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, BarChart3, ChevronRight } from "lucide-react";
import Footer from "@/components/footer";
import LandingHeader from "@/components/landing-header";
import BackgroundWords from "@/components/background-words";
import { ValueProposition } from "@/components/ValueProposition";
import { useLocation } from 'wouter';

type TrialFormData = {
  email: string;
  username: string;
  password: string;
};

export default function LandingPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register } = useUser();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { register: registerField, handleSubmit, formState: { errors } } = useForm<TrialFormData>();

  const onSubmit = async (data: TrialFormData) => {
    try {
      setIsSubmitting(true);

      // Get selected plan from session storage
      const selectedPlan = sessionStorage.getItem('selectedPlan') || 'free';
      console.log('Selected plan:', selectedPlan);

      // Register the user first
      const response = await register(data);

      if (!response.ok) {
        throw new Error(response.message);
      }

      // Show success toast for successful signup
      toast({
        title: "Account Created",
        description: "Your account has been created successfully!",
      });

      if (selectedPlan === 'free') {
        // For free tier, start free trial
        const trialResponse = await fetch('/api/stripe/start-free-trial', {
          method: 'POST',
          credentials: 'include',
        });

        if (!trialResponse.ok) {
          const trialError = await trialResponse.json();
          console.error('Free trial setup error:', trialError);
          // Even if there's an error starting the trial, we'll continue to the dashboard
          // The user can set up their subscription later
        }

        // Redirect to dashboard after registration (and trial if successful)
        setLocation('/');
      } else {
        // For paid tiers, redirect to subscription checkout
        // Use PRODUCTS from our stripe price helper
        const priceIds: { [key: string]: string } = {
          'starter-monthly': 'price_1OpGHMAIJBVVerrJCXB9LK8z',  // Monthly starter
          'starter-yearly': 'price_1RKZsdAIJBVVerrJmp9neLDz',   // Yearly starter 
          'pro-monthly': 'price_1RFrkBAIJBVVerrJNDRc9xSL',      // Monthly pro
          'pro-yearly': 'price_1RKZwJAIJBVVerrJjGTuhgbG'        // Yearly pro
        };

        const [tier, interval] = (selectedPlan as string).split('-');
        const priceId = priceIds[selectedPlan];

        // Create checkout session
        const checkoutResponse = await fetch(`${window.location.origin}/api/stripe/create-checkout-session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ priceId }),
          credentials: 'include'
        });

        if (!checkoutResponse.ok) {
          const errorData = await checkoutResponse.json();
          throw new Error(errorData.message || 'Failed to create checkout session');
        }

        const { url } = await checkoutResponse.json();
        // Redirect to Stripe checkout
        window.location.href = url;
      }
    } catch (error: any) {
      console.error('Signup error:', error);

      let errorMessage = "Registration failed. Please try again.";
      if (error.message) {
        errorMessage = error.message;
      }

      toast({
        variant: "destructive",
        title: "Registration Error",
        description: errorMessage,
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const goToLogin = () => {
    setLocation('/auth?login=true');
  };

  const handleGoogleAuth = (plan: 'free' | 'starter' | 'pro' = 'free') => {
    // Store the selected plan to be retrieved after Google auth
    sessionStorage.setItem('selectedPlan', plan);
    // Redirect to the Google auth endpoint, marking it as a signup
    window.location.href = `/auth/google?signup=true`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#e8f3e8] relative">
      <LandingHeader />
      <BackgroundWords className="absolute inset-0 z-0" />

      <main className="flex-grow container mx-auto px-4 py-12 relative z-10">
        {/* Hero Section */}
        <Card className="text-center mb-8 max-w-4xl mx-auto bg-white/95 backdrop-blur-sm border-2 border-[#1b4332]/10">
          <CardContent className="p-8">
            <h1 className="text-5xl font-bold text-[#1b4332] mb-6">
              Optimize Your Supplement Stack
            </h1>
            <p className="text-xl text-gray-700">
              Track, analyze, and optimize your supplement regimen with AI-powered insights
            </p>
          </CardContent>
        </Card>
        <div className="text-center mb-16">
          <Button 
            size="lg" 
            className="bg-[#2d6a4f] hover:bg-[#1b4332] text-white"
            onClick={() => {
              const trialElement = document.getElementById('free-trial-signup');
              if (trialElement) {
                trialElement.scrollIntoView({ behavior: 'smooth' });
              }
            }}
          >
            Start Tracking <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>

        {/* Value Proposition Section */}
        <div className="mb-20">
          <ValueProposition />
        </div>

        {/* Pricing Cards Section */}
        <div className="mb-24 px-4 sm:px-6">
          <h2 className="text-3xl font-bold text-center text-[#1b4332] mb-12">Simple, Transparent Pricing</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 lg:gap-8 max-w-5xl mx-auto">
            {/* Free Tier Card */}
            <Card className="shadow-lg border-2 border-[#2d6a4f] transform transition-transform hover:-translate-y-2">
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-2xl">Core Tracking</CardTitle>
                <CardDescription>Always free, forever</CardDescription>
              </CardHeader>
              <CardContent className="text-center px-3 sm:px-6">
                <p className="text-3xl sm:text-4xl font-bold text-[#1b4332] mb-3 sm:mb-4">Free</p>
                <p className="text-xs sm:text-sm text-gray-500 mb-4 sm:mb-6">No credit card required</p>
                <ul className="space-y-2 sm:space-y-3 text-left mb-6 sm:mb-8 text-sm sm:text-base">
                  <li className="flex items-start">
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>Track supplement dosages and timing</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>Log qualitative feedback</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>Smart reminder notifications</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>Better than spreadsheets & calendars</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button className="w-full bg-[#2d6a4f] hover:bg-[#1b4332]" onClick={() => {
                  const signupElement = document.getElementById('free-trial-signup');
                  if (signupElement) {
                    signupElement.scrollIntoView({ behavior: 'smooth' });
                  }
                }}>
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Start Tracking
                </Button>
              </CardFooter>
            </Card>

            {/* Monthly Subscription Card */}
            <Card className="shadow-lg border-2 border-[#2d6a4f] transform transition-transform hover:-translate-y-2">
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-2xl">Starter - AI essentials</CardTitle>
                <CardDescription>Flexible pricing options</CardDescription>
              </CardHeader>
              <CardContent className="text-center px-3 sm:px-6">
                <a href="https://buy.stripe.com/6oEdTTeEQaWT76028b" className="no-underline hover:no-underline">
                  <p className="text-2xl sm:text-3xl font-bold text-[#1b4332] mb-1">$7.99/mo</p>
                </a>
                <a href="https://buy.stripe.com/eVa177aoAfd94XSbIM" className="no-underline hover:no-underline">
                  <p className="text-xl sm:text-2xl font-bold text-[#1b4332] mb-8">$69/yr</p>
                </a>
                <ul className="space-y-2 sm:space-y-3 text-left mb-6 sm:mb-8 text-sm sm:text-base">
                  <li className="flex items-start">
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>AI-powered supplement feedback (100 per month)</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>Intelligent biomarker analysis (3 per year)</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>Early access to new features</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>Cancel anytime</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter className="flex gap-2">
                <Button 
                    className="w-1/2 bg-[#2d6a4f] hover:bg-[#1b4332]"
                    onClick={async () => {
                      try {
                        // Store selected plan in session storage
                        sessionStorage.setItem('selectedPlan', 'starter-monthly');

                        const response = await fetch(`${window.location.origin}/api/stripe/create-checkout-session`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({ 
                            priceId: 'price_1RKZsdAIJBVVerrJhsQhpig2',
                            successUrl: `${window.location.origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
                            cancelUrl: `${window.location.origin}`
                          })
                        });

                        if (!response.ok) {
                          throw new Error('Failed to create checkout session');
                        }

                        const { url } = await response.json();
                        window.location.href = url;
                      } catch (error: any) {
                        console.error('Error creating checkout:', error);
                        const errorMessage = error.response?.data?.error || error.message || "Failed to start checkout process";
                        toast({
                          variant: "destructive",
                          title: "Checkout Error",
                          description: errorMessage,
                        });
                      }
                    }}
                  >
                    Monthly
                  </Button>
                  <Button 
                    className="w-1/2 bg-[#2d6a4f] hover:bg-[#1b4332]"
                    onClick={async () => {
                      try {
                        // Store selected plan in session storage
                        sessionStorage.setItem('selectedPlan', 'starter-yearly');

                        const response = await fetch(`${window.location.origin}/api/stripe/create-checkout-session`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                          body: JSON.stringify({ 
                            priceId: 'price_1RKZsdAIJBVVerrJmp9neLDz',
                            successUrl: `${window.location.origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
                            cancelUrl: `${window.location.origin}`
                          })
                        });

                        if (!response.ok) {
                          throw new Error('Failed to create checkout session');
                        }

                        const { url } = await response.json();
                        window.location.href = url;
                      } catch (error: any) {
                        console.error('Error creating checkout:', error);
                        const errorMessage = error.response?.data?.error || error.message || "Failed to start checkout process";
                        toast({
                          variant: "destructive",
                          title: "Checkout Error",
                          description: errorMessage,
                        });
                      }
                    }}
                  >
                    Yearly
                  </Button>
                </CardFooter>
            </Card>

            {/* Pro Biohacker Suite Card */}
            <Card className="shadow-lg border-2 border-[#2d6a4f] transform transition-transform hover:-translate-y-2">
              <CardHeader className="text-center pb-4 relative">
                <div className="absolute -top-4 left-0 right-0 mx-auto w-max px-4 py-1 bg-[#2d6a4f] text-white text-sm rounded-full">
                  Best Value
                </div>
                <CardTitle className="text-2xl">Pro - Biohacker suite</CardTitle>
                <CardDescription>Advanced features for optimal results</CardDescription>
              </CardHeader>
              <CardContent className="text-center px-3 sm:px-6">
                <p className="text-2xl sm:text-3xl font-bold text-[#1b4332] mb-1">$14.99/mo</p>
                <p className="text-xl sm:text-2xl font-bold text-[#1b4332] mb-8">$99/yr (save $80)</p>
                <ul className="space-y-2 sm:space-y-3 text-left mb-6 sm:mb-8 text-sm sm:text-base">
                  <li className="flex items-start">
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>Unlimited AI-powered supplement feedback</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>Unlimited intelligent biomarker analysis</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>Early access to new features</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 mr-2 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>Lock in current pricing</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter className="flex gap-2">
                <Button 
                  className="w-1/2 bg-[#2d6a4f] hover:bg-[#1b4332]"
                  onClick={async () => {
                    try {
                      // Store selected plan in session storage
                      sessionStorage.setItem('selectedPlan', 'pro-monthly');

                      const response = await fetch(`${window.location.origin}/api/stripe/create-checkout-session`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ 
                          priceId: 'price_1RFrkBAIJBVVerrJNDRc9xSL',
                          successUrl: `${window.location.origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
                          cancelUrl: `${window.location.origin}`
                        })
                      });

                      if (!response.ok) {
                        throw new Error('Failed to create checkout session');
                      }

                      const { url } = await response.json();
                      window.location.href = url;
                    } catch (error: any) {
                      console.error('Error creating checkout:', error);
                      const errorMessage = error.response?.data?.error || error.message || "Failed to start checkout process";
                      toast({
                        variant: "destructive",
                        title: "Checkout Error",
                        description: errorMessage,
                      });
                      // Fallback to direct link if session creation fails
                      //window.location.href = "https://buy.stripe.com/8wM8zzfIU6GD760bIP";
                    }
                  }}
                >
                  Monthly
                </Button>
                <Button 
                  className="w-1/2 bg-[#2d6a4f] hover:bg-[#1b4332]"
                  onClick={async () => {
                    try {
                      // Store selected plan in session storage
                      sessionStorage.setItem('selectedPlan', 'pro-yearly');

                      const response = await fetch(`${window.location.origin}/api/stripe/create-checkout-session`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ 
                          priceId: 'price_1RKZwJAIJBVVerrJjGTuhgbG',
                          successUrl: `${window.location.origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
                          cancelUrl: `${window.location.origin}`
                        })
                      });

                      if (!response.ok) {
                        throw new Error('Failed to create checkout session');
                      }

                      const { url } = await response.json();
                      window.location.href = url;
                    } catch (error: any) {
                      console.error('Error creating checkout:', error);
                      const errorMessage = error.response?.data?.error || error.message || "Failed to start checkout process";
                      toast({
                        variant: "destructive",
                        title: "Checkout Error",
                        description: errorMessage,
                      });
                    }
                  }}
                >
                  Yearly
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>

        {/* Free Trial Signup Form */}
        <div id="free-trial-signup" className="pt-20">
          <Card className="max-w-xl mx-auto shadow-xl bg-white/95 backdrop-blur-sm border-2 border-[#1b4332]/10">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl text-[#1b4332]">Start Your Journey</CardTitle>
              <CardDescription>
                Create an account to start tracking for free. No credit card required.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit(onSubmit)}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="username-trial" className="text-sm font-medium">Username</label>
                  <Input
                    id="username-trial"
                    type="text"
                    {...registerField("username", { required: "Username is required" })}
                    className={errors.username ? "border-red-500" : ""}
                    autoComplete="username"
                  />
                  {errors.username && <p className="text-red-500 text-xs mt-1">{errors.username.message}</p>}
                </div>
                <div className="space-y-2">
                  <label htmlFor="email-trial" className="text-sm font-medium">Email</label>
                  <Input
                    id="email-trial"
                    type="email"
                    {...registerField("email", { required: "Email is required" })}
                    className={errors.email ? "border-red-500" : ""}
                    autoComplete="email"
                  />
                  {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
                </div>
                <div className="space-y-2">
                  <label htmlFor="password-trial" className="text-sm font-medium">Password</label>
                  <Input
                    id="password-trial"
                    type="password"
                    {...registerField("password", { required: "Password is required" })}
                    className={errors.password ? "border-red-500" : ""}
                    autoComplete="new-password"
                  />
                  {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
                </div>
              </CardContent>
              <CardFooter className="flex flex-col space-y-3">
                <Button type="submit" className="w-full bg-[#2d6a4f] hover:bg-[#1b4332]" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    "Create Account"
                  )}
                </Button>

                <div className="relative w-full py-2">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t"></span>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">
                      Or
                    </span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full flex items-center justify-center gap-2"
                  onClick={() => handleGoogleAuth('free')}
                >
                  <svg className="h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                    <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
                  </svg>
                  Sign up with Google
                </Button>

                <Button
                  type="button"
                  variant="link"
                  className="text-sm"
                  onClick={goToLogin}
                >
                  Already have an account? Sign In
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </main>

      <Footer className="relative z-10" />
    </div>
  );
}