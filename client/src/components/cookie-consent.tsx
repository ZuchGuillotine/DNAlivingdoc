import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

export default function CookieConsent() {
  const [showConsent, setShowConsent] = useState(false);

  useEffect(() => {
    // Check if user has already made a choice about cookies
    const cookieChoice = localStorage.getItem("cookieConsent");
    if (cookieChoice === null) {
      setShowConsent(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("cookieConsent", "accepted");
    setShowConsent(false);
  };

  const handleDecline = () => {
    localStorage.setItem("cookieConsent", "declined");
    setShowConsent(false);
    // When declined, you might want to disable certain tracking features
    // or use only essential cookies
  };

  if (!showConsent) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-sm z-50">
      <Card className="max-w-2xl mx-auto border-[#1b4332]">
        <CardContent className="pt-6">
          <p className="text-sm text-foreground/90">
            We use cookies to enhance your browsing experience, serve personalized content, and analyze our traffic. 
            By clicking "Accept", you consent to our use of cookies. By clicking "Decline", only essential cookies will be used.
            For more information about how we use cookies, please read our{" "}
            <Link href="/privacy" className="text-[#1b4332] font-semibold hover:underline">
              Privacy Policy
            </Link>.
          </p>
        </CardContent>
        <CardFooter className="flex justify-end space-x-2">
          <Button
            variant="outline"
            className="border-[#1b4332] text-[#1b4332] hover:bg-[#1b4332] hover:text-white"
            onClick={handleDecline}
          >
            Decline
          </Button>
          <Button
            variant="outline"
            className="border-[#1b4332] text-[#1b4332] hover:bg-[#1b4332] hover:text-white"
            onClick={handleAccept}
          >
            Accept
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}