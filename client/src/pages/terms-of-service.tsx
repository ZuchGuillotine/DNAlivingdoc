import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import LandingHeader from "@/components/landing-header";
import Footer from "@/components/footer";

export default function TermsOfService() {
  return (
    <div className="min-h-screen flex flex-col bg-[#e8f3e8]">
      <LandingHeader />
      <main className="container mx-auto px-4 py-6 flex-grow">
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-[#1b4332]">Terms of Service</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-green max-w-none">
            <p className="text-sm text-muted-foreground mb-6">Effective Date: January 27, 2025</p>

            <p>Welcome to Stack Tracker ("the Service"), a web application developed to help users track their supplement regimen and record any positive or negative effects. By accessing or using the Service, you agree to comply with and be bound by these Terms of Service ("Terms"). If you do not agree with these Terms, you must not use the Service.</p>

            <h3 className="text-xl font-semibold mt-6 mb-3">1. Acceptance of Terms</h3>
            <p>By creating an account, accessing, or using the Service, you acknowledge that you have read, understood, and agree to be bound by these Terms, as well as our Privacy Policy, which is incorporated herein by reference.</p>

            <h3 className="text-xl font-semibold mt-6 mb-3">2. Eligibility</h3>
            <p>You must be at least 18 years old to use the Service. By using the Service, you represent and warrant that you are legally capable of entering into binding agreements and meet all eligibility requirements.</p>

            <h3 className="text-xl font-semibold mt-6 mb-3">3. Description of Service</h3>
            <p>Stack Tracker allows users to:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>Log and manage their supplement regimens.</li>
              <li>Record observations about the effects of supplements, including positive and negative experiences.</li>
              <li>View and analyze trends in their supplementation history.</li>
            </ul>
            <p>The Service is provided for informational and personal record-keeping purposes only and is not intended to diagnose, treat, cure, or prevent any disease. <strong>Always consult with a qualified healthcare professional before making changes to your supplement regimen.</strong></p>

            <h3 className="text-xl font-semibold mt-6 mb-3">4. User Responsibilities</h3>
            <h4 className="text-lg font-medium mt-4 mb-2">a. Account Security</h4>
            <p>You are responsible for maintaining the confidentiality of your account credentials and for all activities conducted under your account. Notify us immediately if you suspect any unauthorized use of your account.</p>

            <h4 className="text-lg font-medium mt-4 mb-2">b. Prohibited Conduct</h4>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>Provide false, misleading, or inaccurate information.</li>
              <li>Use the Service for any unlawful purpose or in violation of applicable laws.</li>
              <li>Reverse-engineer, modify, or create derivative works based on the Service.</li>
              <li>Transmit harmful code or disrupt the functionality of the Service.</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">5. Free and Paid Tiers</h3>
            <p>The Service offers two tiers of access:</p>

            <h4 className="text-lg font-medium mt-4 mb-2">a. Free Tier</h4>
            <p>The Free Tier provides limited access to features of the Service without any charge. Users in the Free Tier may not access premium features available to paid users.</p>

            <h4 className="text-lg font-medium mt-4 mb-2">b. Paid Tier</h4>
            <p>The Paid Tier provides full access to all features of the Service for a subscription fee of $21.99 per month, billed monthly. Users who subscribe to the Paid Tier agree to the following terms:</p>
            <ul className="list-disc pl-6 mb-4">
              <li><strong>Billing:</strong> Subscription fees are billed on a monthly basis. By providing your payment information, you authorize us to charge your account the monthly subscription fee until canceled.</li>
              <li><strong>Cancellation:</strong> You may cancel your subscription at any time. Upon cancellation, you will retain access to the Paid Tier until the end of your current billing cycle.</li>
              <li><strong>Refunds:</strong> Payments for prior billing periods are non-refundable unless otherwise granted at the discretion of the company.</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">6. Health Disclaimer</h3>
            <p className="font-medium">The information provided by the Service is for informational purposes only. The Service does not provide medical advice.</p>
            <p><strong>You should always consult with a healthcare professional before starting, stopping, or modifying any supplement or treatment plan.</strong> We are not responsible for any harm or adverse effects that may result from your use of the Service.</p>

            <h3 className="text-xl font-semibold mt-6 mb-3">7. Privacy</h3>
            <p>Our Privacy Policy governs how we collect, use, and store your data. By using the Service, you consent to the practices described in our Privacy Policy.</p>

            <h3 className="text-xl font-semibold mt-6 mb-3">8. Intellectual Property</h3>
            <p>All content, features, and functionality of the Service, including but not limited to text, graphics, logos, and software, are owned by Stack Tracker and are protected by intellectual property laws. You may not reproduce, distribute, or create derivative works without our prior written permission.</p>

            <h3 className="text-xl font-semibold mt-6 mb-3">9. Limitation of Liability</h3>
            <p>To the maximum extent permitted by law, Stack Tracker, its affiliates, and licensors shall not be liable for any direct, indirect, incidental, special, or consequential damages resulting from your use of the Service. This includes, but is not limited to, damages for health-related issues, loss of data, or any other matter relating to the Service.</p>

            <h3 className="text-xl font-semibold mt-6 mb-3">10. Indemnification</h3>
            <p>You agree to indemnify and hold harmless Stack Tracker, its affiliates, and employees from and against any claims, damages, or expenses arising out of your use of the Service, violation of these Terms, or infringement of any rights of a third party.</p>

            <h3 className="text-xl font-semibold mt-6 mb-3">11. Termination</h3>
            <p>We reserve the right to suspend or terminate your account at any time, with or without notice, for any violation of these Terms or for any other reason at our sole discretion.</p>

            <h3 className="text-xl font-semibold mt-6 mb-3">12. Changes to Terms</h3>
            <p>We may modify these Terms at any time. Any changes will be effective upon posting the updated Terms to the Service. Your continued use of the Service after changes are posted constitutes your acceptance of the modified Terms.</p>

            <h3 className="text-xl font-semibold mt-6 mb-3">13. Governing Law</h3>
            <p>These Terms shall be governed by and construed in accordance with the laws of the United States, without regard to its conflict of law principles.</p>

            <h3 className="text-xl font-semibold mt-6 mb-3">14. Contact Information</h3>
            <p>If you have any questions or concerns about these Terms, please contact us at:</p>
            <p className="mt-2"><strong>Email:</strong> support@stacktracker.co</p>

            <div className="mt-8 text-center text-sm text-muted-foreground">
              Thank you for using Stack Tracker!
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}