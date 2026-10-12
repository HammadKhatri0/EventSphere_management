import PublicShell from '../components/layout/PublicShell.jsx';
import { Alert } from '../components/ui/index.jsx';

const Section = ({ title, children }) => (
  <section>
    <h2 className="text-xl font-bold mb-2">{title}</h2>
    <div className="space-y-3 text-muted leading-relaxed [&_strong]:text-fg [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5">{children}</div>
  </section>
);

const Demo = () => (
  <Alert tone="warning" title="Demonstration project">
    EventSphere is an educational project. Replace this text with your organisation&rsquo;s own legal documents before running it with real users.
  </Alert>
);

export function Privacy() {
  return (
    <PublicShell title="Privacy Policy" intro="What EventSphere collects, why, and how you stay in control of it.">
      <Demo />
      <Section title="What we collect">
        <ul>
          <li><strong>Account data:</strong> name, email, role, optional phone and company, and a salted hash of your password (we never store the password itself).</li>
          <li><strong>Activity you create:</strong> expo and session registrations, bookmarks and reminders, applications, inquiries, messages, support tickets and feedback.</li>
          <li><strong>Usage events:</strong> anonymous-style booth and expo views that power the organiser&rsquo;s traffic analytics.</li>
          <li><strong>Files you upload:</strong> logos, banners, avatars and documents.</li>
        </ul>
      </Section>
      <Section title="Why we use it">
        <p>To run the expo: sign you in, show you the right portal, process booth reservations and applications, deliver reminders and notifications, and give organisers aggregate analytics. Marketing emails are sent only if you opt in, and you can switch that off at any time.</p>
      </Section>
      <Section title="Your rights">
        <ul>
          <li><strong>Access / portability:</strong> download all your data from <em>Account &amp; privacy → Export data</em>.</li>
          <li><strong>Erasure:</strong> delete your account from <em>Account &amp; privacy → Delete account</em>. Your personal data is removed and any booths you hold are released.</li>
          <li><strong>Correction:</strong> edit your profile at any time.</li>
        </ul>
      </Section>
      <Section title="Retention">
        <p>In-app notifications are removed after 90 days and usage events after one year. Login sessions expire after 7 days of inactivity.</p>
      </Section>
      <Section title="Cookies &amp; local storage">
        <p>We use one essential, HttpOnly cookie to keep you signed in. Your theme and colour palette choices are stored locally in your browser. We do not use advertising or tracking cookies.</p>
      </Section>
      <Section title="Security &amp; processors">
        <p>Passwords are hashed with bcrypt, sessions use short-lived tokens, access is role-based and traffic should be served over HTTPS. Data is processed by our database host (MongoDB Atlas), file host (Cloudinary) and email provider.</p>
      </Section>
      <Section title="Questions">
        <p>Use <em>Feedback</em> inside your portal to contact the organiser or platform team about your data.</p>
      </Section>
    </PublicShell>
  );
}

export function Terms() {
  return (
    <PublicShell title="Terms of Service" intro="The ground rules for using EventSphere.">
      <Demo />
      <Section title="Accounts">
        <p>You are responsible for your account and for keeping your password secret. Provide accurate information. Organiser accounts require an invitation code from the platform operator.</p>
      </Section>
      <Section title="Using the platform">
        <ul>
          <li>Do not upload unlawful, misleading or harmful content, or content you do not have the right to share.</li>
          <li>Do not attempt to disrupt the service, probe it for vulnerabilities without permission, or access other users&rsquo; data.</li>
          <li>Messages, inquiries and support tickets must be respectful and relevant to the expo.</li>
        </ul>
      </Section>
      <Section title="Exhibitors &amp; booths">
        <p>An exhibitor application must be approved by the organiser before a booth can be reserved. A reservation stays <em>Pending Approval</em> until the organiser confirms it, and the organiser may release or reassign a booth in line with the expo&rsquo;s own rules. Prices shown are informational; payment terms are set by the organiser.</p>
      </Section>
      <Section title="Attendees">
        <p>Session registrations are subject to capacity. The organiser may change or cancel sessions and expos, and you will be notified in the app.</p>
      </Section>
      <Section title="Availability &amp; liability">
        <p>The service is provided &ldquo;as is&rdquo;, without guarantee of uninterrupted availability. To the extent permitted by law the operator is not liable for indirect losses arising from use of the platform.</p>
      </Section>
      <Section title="Changes">
        <p>These terms may be updated; continued use after an update means you accept the new version.</p>
      </Section>
    </PublicShell>
  );
}

const FAQ = [
  ['How do I create an account?', 'Choose Get started, pick Organizer, Exhibitor or Attendee, and fill in the form. Exhibitors add a company name; organisers need an access code from the platform operator.'],
  ['I picked the wrong portal when signing in', 'Sign in again and choose the portal that matches your account. The message will tell you which role your account has.'],
  ['I forgot my password', 'Use “Forgot password?” on the sign-in page. The link in the email is valid for 30 minutes and works once.'],
  ['How does an exhibitor get a booth?', 'Complete your company profile, apply to an expo, wait for approval, then pick a green booth on the floor plan and reserve it. The organiser confirms the reservation.'],
  ['Why can’t I reserve a booth?', 'Your application must be approved first, you can hold at most two booths per expo, and the booth must still be available.'],
  ['How do reminders work?', 'Bookmark or register for a session and choose when to be reminded. You will get a notification in the app before it starts, and an alert if the organiser changes it.'],
  ['How do I contact an exhibitor?', 'Open the exhibitor’s page and send an inquiry or book an appointment. They reply in the same thread.'],
  ['Can I download or delete my data?', 'Yes — Account & privacy has both Export data and Delete account.'],
  ['Which browsers are supported?', 'Current versions of Chrome, Edge, Firefox and Safari, on desktop and mobile.'],
  ['The floor plan does not update by itself', 'Live updates use a WebSocket connection. Reload the page, and check that a proxy or VPN is not blocking it.'],
];

export function Help() {
  return (
    <PublicShell title="Help Center" intro="Quick answers to common questions. Signed-in users can also send feedback or open a support ticket from their portal.">
      <div className="space-y-3">
        {FAQ.map(([q, a]) => (
          <details key={q} className="group card px-5 py-4 open:shadow-card">
            <summary className="cursor-pointer font-semibold list-none flex items-center justify-between gap-4">
              {q}<span className="text-primary-text transition group-open:rotate-45 text-xl leading-none" aria-hidden>+</span>
            </summary>
            <p className="mt-3 text-muted leading-relaxed">{a}</p>
          </details>
        ))}
      </div>
    </PublicShell>
  );
}
