export function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-primary opacity-5" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse" />
        
        <div className="relative container mx-auto px-6 py-16">
          <h1 className="text-4xl md:text-5xl font-bold text-gradient mb-4">
            Privacy Policy
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Your privacy is important to us. Learn how ResumeMatch Pro handles your data.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-6 py-12 max-w-4xl">
        <div className="prose prose-invert max-w-none space-y-8">
          {/* Last Updated */}
          <div className="bg-muted/50 border border-border rounded-lg p-4 mb-8">
            <p className="text-sm text-muted-foreground">
              <strong>Last Updated:</strong> December 2024
            </p>
          </div>

          {/* Introduction */}
          <section>
            <h2 className="text-2xl font-bold mb-4">Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              ResumeMatch Pro ("we," "us," "our," or "Company") is committed to protecting your privacy. This Privacy Policy explains how our web application and Chrome extension (collectively, the "Service") collect, use, disclose, and safeguard your information.
            </p>
          </section>

          {/* Data We Collect */}
          <section>
            <h2 className="text-2xl font-bold mb-4">1. Data We Collect</h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Resume Data</h3>
                <p className="text-muted-foreground leading-relaxed">
                  When you upload your resume, the document is processed and stored <strong>locally in your browser's storage</strong> (Chrome's storage API for the extension, localStorage for the web app). Your resume is never sent to our servers.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">Job Descriptions</h3>
                <p className="text-muted-foreground leading-relaxed">
                  When you explicitly click the "Analyse" or "CustomAnalyse" button on a job posting page, the webpage HTML is extracted and processed. This extraction occurs <strong>only upon your direct request</strong> and is not done automatically.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">Browser Storage Data</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Application history, settings, and resume data are stored in your browser's local storage and Chrome's sync storage. This data remains on your device and is not transmitted to our servers.
                </p>
              </div>
            </div>
          </section>

          {/* How We Use Your Data */}
          <section>
            <h2 className="text-2xl font-bold mb-4">2. How We Use Your Data</h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">AI Analysis via Google Gemini API</h3>
                <p className="text-muted-foreground leading-relaxed">
                  To provide resume tailoring and ATS (Applicant Tracking System) scoring, your resume and the extracted job description are sent to <strong>Google's Gemini AI API</strong> for analysis. This transmission occurs only when you explicitly request analysis.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  <strong>Important:</strong> Data sent to Google Gemini API is subject to <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google's Privacy Policy</a>.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">Service Improvement</h3>
                <p className="text-muted-foreground leading-relaxed">
                  We use aggregated and anonymized data to understand how our Service is used and to improve its functionality. No personally identifiable information is used for this purpose.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">What We Do NOT Do</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-2">
                  <li>We do NOT store your resume on our servers</li>
                  <li>We do NOT sell, trade, or share your data with third parties</li>
                  <li>We do NOT use your data for advertising or marketing purposes</li>
                  <li>We do NOT retain job descriptions after analysis</li>
                  <li>We do NOT have backend servers that store user data</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Data Storage & Security */}
          <section>
            <h2 className="text-2xl font-bold mb-4">3. Data Storage & Security</h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Local-First Architecture</h3>
                <p className="text-muted-foreground leading-relaxed">
                  All sensitive data (resumes, application history, settings) is stored locally on your device. We do not maintain backend databases or servers that store user data.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">Chrome Extension Storage</h3>
                <p className="text-muted-foreground leading-relaxed">
                  For the Chrome extension, data is stored using Chrome's storage API, which is encrypted by your browser. This ensures your data is protected even if your device is compromised.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">API Communication</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Data sent to Google Gemini API is transmitted over HTTPS with encryption. For details on Google's security practices, visit <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google's Privacy Policy</a>.
                </p>
              </div>
            </div>
          </section>

          {/* Third-Party Services */}
          <section>
            <h2 className="text-2xl font-bold mb-4">4. Third-Party Services</h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Google Gemini API</h3>
                <p className="text-muted-foreground leading-relaxed">
                  We use Google's Gemini API for AI-powered resume analysis. When you request analysis, your resume and job description are sent to Google's servers for processing. This is the only third-party service we use.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Google's use of this data is governed by their Privacy Policy. We recommend reviewing it at <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">https://policies.google.com/privacy</a>.
                </p>
              </div>
            </div>
          </section>

          {/* User Rights & Control */}
          <section>
            <h2 className="text-2xl font-bold mb-4">5. Your Rights & Data Control</h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Access Your Data</h3>
                <p className="text-muted-foreground leading-relaxed">
                  All your data is stored locally on your device. You can access it at any time through the application interface.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">Delete Your Data</h3>
                <p className="text-muted-foreground leading-relaxed">
                  You can delete your resume, application history, and settings at any time by clearing your browser's storage or uninstalling the extension. To clear extension data:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 mt-2 ml-2">
                  <li>Right-click the ResumeMatch Pro icon in Chrome</li>
                  <li>Select "Manage extension"</li>
                  <li>Click "Storage" to clear local data</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">No Tracking</h3>
                <p className="text-muted-foreground leading-relaxed">
                  We do not track your activity, browsing behavior, or monitor which websites you visit. Your use of job posting sites is completely private.
                </p>
              </div>
            </div>
          </section>

          {/* Data Retention */}
          <section>
            <h2 className="text-2xl font-bold mb-4">6. Data Retention</h2>
            
            <p className="text-muted-foreground leading-relaxed">
              <strong>Local Storage:</strong> Your resume, application history, and settings remain on your device indefinitely until you choose to delete them.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-3">
              <strong>Google Gemini API:</strong> Data sent to Google Gemini API is processed and not retained by us. Google's retention policy applies to their servers. Refer to <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google's Privacy Policy</a> for details.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-3">
              <strong>Our Servers:</strong> We do not retain any user data on our servers because we have no user data databases.
            </p>
          </section>

          {/* Children's Privacy */}
          <section>
            <h2 className="text-2xl font-bold mb-4">7. Children's Privacy</h2>
            
            <p className="text-muted-foreground leading-relaxed">
              ResumeMatch Pro is not intended for users under 18 years old. We do not knowingly collect data from children. If we become aware that we have collected data from a child under 18, we will delete such information immediately.
            </p>
          </section>

          {/* Changes to Privacy Policy */}
          <section>
            <h2 className="text-2xl font-bold mb-4">8. Changes to This Privacy Policy</h2>
            
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time to reflect changes in our practices or for other operational, legal, or regulatory reasons. We will notify you of significant changes by updating the "Last Updated" date and providing notice on our website. Your continued use of the Service following the posting of revised Privacy Policy means that you accept and agree to the changes.
            </p>
          </section>

          {/* Contact Us */}
          <section>
            <h2 className="text-2xl font-bold mb-4">9. Contact Us</h2>
            
            <p className="text-muted-foreground leading-relaxed mb-4">
              If you have questions, concerns, or requests regarding this Privacy Policy or our privacy practices, please contact us at:
            </p>
            
            <div className="bg-muted/50 border border-border rounded-lg p-6 space-y-2">
              <p className="text-foreground">
                <strong>ResumeMatch Pro</strong>
              </p>
              <p className="text-muted-foreground">
                Website: <a href="https://resume.zenlead.in" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">https://resume.zenlead.in</a>
              </p>
              <p className="text-muted-foreground">
                Email: privacy@resume.zenlead.in
              </p>
            </div>
          </section>

          {/* Compliance */}
          <section>
            <h2 className="text-2xl font-bold mb-4">10. Compliance with Laws</h2>
            
            <p className="text-muted-foreground leading-relaxed mb-4">
              ResumeMatch Pro complies with applicable privacy laws including:
            </p>
            
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li><strong>GDPR:</strong> European users' data is handled in compliance with GDPR requirements</li>
              <li><strong>CCPA:</strong> California residents have rights under the California Consumer Privacy Act</li>
              <li><strong>Chrome Web Store Policies:</strong> Our extension meets all Chrome Web Store user data policies</li>
              <li><strong>Data Privacy Laws:</strong> We comply with applicable data protection laws in all jurisdictions</li>
            </ul>
          </section>

          {/* Limited Use Certification */}
          <section className="bg-gradient-primary/10 border border-primary/20 rounded-lg p-6">
            <h2 className="text-2xl font-bold mb-4">Chrome Web Store Limited Use Certification</h2>
            
            <p className="text-muted-foreground leading-relaxed mb-4">
              In compliance with Chrome Web Store policies, we certify that:
            </p>
            
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>We use information from Google APIs only for providing resume analysis and ATS scoring</li>
              <li>We do not use or transfer data for any other purpose</li>
              <li>We do not use or transfer data for personalized advertising</li>
              <li>We do not allow human review of user data except to improve our core functionality</li>
              <li>We comply with the Chrome Web Store User Data Policy in full</li>
            </ul>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-border text-center">
          <p className="text-sm text-muted-foreground">
            © 2024 ResumeMatch Pro. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
