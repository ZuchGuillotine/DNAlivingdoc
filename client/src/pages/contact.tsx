import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Header from "@/components/landing-header";
import Footer from "@/components/footer";
import { Button } from "@/components/ui/button";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#e8f3e8]">
      <Header />
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <Card className="bg-[#1b4332] text-white">
            <CardHeader>
              <CardTitle className="text-2xl">Reach Out</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg">
                Contact us at: <a href="mailto:accountsuccess@stacktracker.io" className="underline">accountsuccess@stacktracker.io</a>
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
