import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import LandingHeader from "@/components/landing-header";
import Footer from "@/components/footer";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen flex flex-col bg-[#e8f3e8]">
      <LandingHeader />
      <main className="container mx-auto px-4 py-6 flex-grow">
        <Card className="max-w-4xl mx-auto">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-[#1b4332]">Privacy Policy</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-green max-w-none">
            <p className="text-sm text-muted-foreground mb-6">Effective Date: January 27, 2025</p>

            <p>Stack Tracker ("we," "us," or "our") values your privacy and is committed to protecting your personal information. This Privacy Policy outlines how we collect, use, and safeguard your information when you use our web application ("the Service"). By using the Service, you agree to the collection and use of information as described in this Privacy Policy.</p>

            <h3 className="text-xl font-semibold mt-6 mb-3">1. Information We Collect</h3>
            <p>We collect the following types of information:</p>

            <h4 className="text-lg font-medium mt-4 mb-2">a. Personal Information</h4>
            <p>When you create an account or use the Service, we may collect:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>Name</li>
              <li>Email address</li>
              <li>Payment information (for Paid Tier users)</li>
              <li>Any other information you provide directly to us.</li>
            </ul>

            <h4 className="text-lg font-medium mt-4 mb-2">b. Usage Data</h4>
            <p>We collect information about how you access and use the Service, including:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>Device information (e.g., type, operating system, browser)</li>
              <li>IP address</li>
              <li>Pages viewed, features used, and time spent on the Service.</li>
            </ul>

            <h4 className="text-lg font-medium mt-4 mb-2">c. Cookies and Tracking Technologies</h4>
            <p>We use cookies and similar technologies to:</p>
            <ul className="list-disc pl-6 mb-4">
              <li>Enhance user experience</li>
              <li>Track user activity on the Service</li>
              <li>Collect analytics data to improve the Service.</li>
            </ul>
            <p>You can manage or disable cookies through your browser settings, but doing so may affect the functionality of the Service.</p>

            <h3 className="text-xl font-semibold mt-6 mb-3">2. How We Use Your Information</h3>
            <p>We use your information for the following purposes:</p>
            <ul className="list-disc pl-6 mb-4">
              <li><strong>To Provide the Service:</strong> Deliver and maintain the functionality of the Service, including user account management.</li>
              <li><strong>To Process Payments:</strong> Manage billing for Paid Tier users.</li>
              <li><strong>To Improve the Service:</strong> Analyze usage trends and user feedback to enhance features and functionality.</li>
              <li><strong>To Communicate with You:</strong> Respond to inquiries, provide support, and send updates about the Service.</li>
              <li><strong>To Ensure Security:</strong> Protect against unauthorized access, fraud, and other harmful activities.</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">3. Sharing Your Information</h3>
            <p>We do not sell your personal information. However, we may share your information with third parties in the following circumstances:</p>
            <ul className="list-disc pl-6 mb-4">
              <li><strong>Service Providers:</strong> We may share your data with third-party vendors who help us operate the Service, such as payment processors and analytics providers.</li>
              <li><strong>Legal Obligations:</strong> We may disclose information if required to comply with legal obligations or to protect our rights and safety.</li>
              <li><strong>Business Transfers:</strong> In the event of a merger, acquisition, or sale of assets, your information may be transferred to the acquiring entity.</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">4. Data Retention</h3>
            <p>We retain your personal information for as long as necessary to fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required by law. You may request the deletion of your data at any time by contacting us.</p>

            <h3 className="text-xl font-semibold mt-6 mb-3">5. Your Rights</h3>
            <p>Depending on your location, you may have the following rights regarding your personal information:</p>
            <ul className="list-disc pl-6 mb-4">
              <li><strong>Access and Correction:</strong> Request access to or correction of your personal data.</li>
              <li><strong>Deletion:</strong> Request the deletion of your data.</li>
              <li><strong>Data Portability:</strong> Request a copy of your data in a structured, machine-readable format.</li>
              <li><strong>Opt-Out:</strong> Opt out of certain data collection practices, including marketing communications and cookies.</li>
            </ul>

            <h3 className="text-xl font-semibold mt-6 mb-3">6. Security</h3>
            <p>We implement reasonable security measures to protect your personal information from unauthorized access, disclosure, or alteration. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.</p>

            <h3 className="text-xl font-semibold mt-6 mb-3">7. Third-Party Links</h3>
            <p>The Service may contain links to third-party websites. We are not responsible for the privacy practices or content of such websites. We encourage you to review their privacy policies before providing any information.</p>

            <h3 className="text-xl font-semibold mt-6 mb-3">8. Children's Privacy</h3>
            <p>The Service is not intended for individuals under the age of 18. We do not knowingly collect personal information from children. If we become aware that a child under 18 has provided us with personal information, we will delete it.</p>

            <h3 className="text-xl font-semibold mt-6 mb-3">9. Changes to This Privacy Policy</h3>
            <p>We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated "Effective Date." Your continued use of the Service after changes are posted constitutes your acceptance of the revised Privacy Policy.</p>

            <h3 className="text-xl font-semibold mt-6 mb-3">10. Contact Us</h3>
            <p>If you have any questions or concerns about this Privacy Policy or our data practices, please contact us at:</p>
            <p className="mt-2"><strong>Email:</strong> support@stacktracker.co</p>

            <div className="mt-8 text-center text-sm text-muted-foreground">
              Thank you for trusting Stack Tracker!
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}