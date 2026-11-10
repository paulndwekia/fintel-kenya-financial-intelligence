import { ArrowLeft, ExternalLink, ShieldCheck } from "lucide-react";
import { Link } from "wouter";

type Section = { heading: string; body: string[] };
type LegalDocument = { eyebrow: string; title: string; intro: string; sections: Section[] };

const documents: Record<string, LegalDocument> = {
  privacy: {
    eyebrow: "YOUR INFORMATION",
    title: "Privacy, explained plainly",
    intro: "We want you to understand what FINTEL handles, why it handles it, and what stays in your control. This page describes the current product, not a promise about features that are still being built.",
    sections: [
      { heading: "What we collect", body: ["When you sign in, FINTEL processes the account details needed to recognise you and protect your session. If you create a portfolio or save research, those records are stored so you can return to your work.", "Market observations come from public or otherwise authorised sources such as the Central Bank of Kenya. They are kept separate from your personal workspace data."] },
      { heading: "How we use it", body: ["We use account information to provide access, apply role permissions, and keep your session secure. Portfolio and research information is used to provide the features you choose to use.", "We do not sell your personal information. We do not use private portfolio data as public market data. Research features only receive the data selected for that request and permitted for your account."] },
      { heading: "Who can see your work", body: ["Portfolio access is restricted to the signed-in owner and authorised roles. Research sessions are scoped to the account that created them. Administrators may access operational records where needed to maintain the service.", "AI research providers may process the question and selected context needed to answer it. Provider credentials stay on the server. Do not include passwords, identity numbers, or other secrets in research prompts."] },
      { heading: "How long information is kept", body: ["Records are retained while they are needed to provide the service, meet security and audit needs, or comply with applicable obligations. The current product does not yet provide a self-service account deletion workflow.", "For a privacy request, use the project contact route on the FINTEL GitHub repository. Do not post personal or account details publicly."] },
      { heading: "Your choices", body: ["You can manage optional cookie preferences from the cookie settings control. Essential session and security cookies remain necessary for sign-in and basic site operation.", "FINTEL is an independent project. Its use of public CBK information does not imply that the Central Bank of Kenya sponsors or endorses the platform."] },
    ],
  },
  terms: {
    eyebrow: "USING FINTEL",
    title: "Terms of use",
    intro: "These terms set a few clear expectations for using FINTEL. The platform is a research and information tool, not a bank, broker, custodian or investment adviser.",
    sections: [
      { heading: "What FINTEL is for", body: ["FINTEL brings Kenyan market observations, fixed-income tools, quantitative calculations and research into one workspace. It is provided to help users explore information and understand financial concepts.", "Market values can change, source pages can be delayed, and calculations depend on the inputs and assumptions supplied. Check the original source before making a decision."] },
      { heading: "Your account and workspace", body: ["Keep your sign-in details private. You are responsible for activity carried out through your account and for ensuring that portfolio information you enter is accurate and that you are entitled to use it.", "Do not attempt to access another person's portfolio, bypass permissions, overload the service, interfere with security controls or use the platform unlawfully."] },
      { heading: "Data and calculations", body: ["FINTEL identifies source and freshness information where it is available. A status such as DATA REQUIRED or STALE is intentional: it means the platform does not have enough reliable information to present a current result.", "AI-generated explanations are interpretations, not verified market observations. Quantitative model outputs are only as reliable as their inputs, assumptions and implementation."] },
      { heading: "Availability and changes", body: ["FINTEL is under active development. Features may be improved, paused or changed, and free hosting may have periods of limited availability. We will not describe a feature as live when it is not connected and working.", "We may update these terms as the product changes. The effective date is shown below."] },
    ],
  },
  cookies: {
    eyebrow: "SITE PREFERENCES",
    title: "Cookie policy",
    intro: "Cookies are small pieces of information saved by your browser. FINTEL keeps their use limited and explains what each one is for.",
    sections: [
      { heading: "Essential session and security cookies", body: ["The app_session_id cookie is used by the existing sign-in/session flow. It is an essential cookie and is not an advertising tracker.", "The __Host-oauth_state cookie is a short-lived, host-only security cookie used to bind an OAuth sign-in attempt to the browser that started it. It expires after the sign-in window."] },
      { heading: "Your preference cookie", body: ["The fintel_consent cookie stores the choices you make in this banner. It lasts for up to one year so we do not ask you every time you return. You can reopen Cookie settings at any time and change your choice.", "The preference cookie contains only the consent categories and the time you saved them. It does not contain your password or portfolio information."] },
      { heading: "Optional categories", body: ["Analytics and personalisation are off by default. The current release does not enable an analytics or advertising tracker. Choosing an optional category records your preference; it does not by itself activate a third-party service.", "You can choose Essential only, Accept all, or open Preferences to make a more specific choice."] },
      { heading: "Managing cookies", body: ["You can delete cookies in your browser settings. Deleting the session cookie will sign you out; deleting the preference cookie may cause the consent banner to appear again.", "Cookie behaviour may differ slightly between browsers and devices. The preference you save applies to the browser you are using."] },
    ],
  },
  disclaimer: {
    eyebrow: "IMPORTANT INFORMATION",
    title: "Financial information disclaimer",
    intro: "FINTEL is built for learning, analysis and research. It does not tell you what you should buy, sell or hold.",
    sections: [
      { heading: "Not financial advice", body: ["Nothing on FINTEL is a personal recommendation, an offer to trade, or advice tailored to your financial circumstances. The platform does not assess your objectives, income, debts, risk tolerance or suitability.", "Speak with a suitably qualified and authorised professional before making an investment or borrowing decision. You remain responsible for your own decisions."] },
      { heading: "Market data can move", body: ["Public data may be revised, delayed, incomplete or temporarily unavailable. Every observation should be checked against its source and observation date. A retrieval time is not the same as the date a market event occurred.", "Where reliable data is missing, FINTEL aims to show DATA REQUIRED or STALE rather than fill the gap with invented values."] },
      { heading: "Models have limits", body: ["Bond, option, yield-curve and portfolio-risk outputs depend on assumptions and input quality. Stress scenarios are illustrations, not forecasts. Historical performance does not guarantee future outcomes.", "Sample inputs are labelled as examples. They are not live prices or a recommendation to trade. FINTEL does not execute trades or hold client funds."] },
    ],
  },
  security: {
    eyebrow: "KEEPING YOUR WORK SAFE",
    title: "Security and responsible use",
    intro: "Security is a continuing piece of work. Here is what the current application does and what still needs operational attention.",
    sections: [
      { heading: "Protections already in the application", body: ["Sign-in uses the existing session/OAuth flow. Sensitive portfolio and research actions are protected by server-side role checks, and portfolio reads are scoped to the signed-in owner.", "The API validates inputs, uses database queries through the existing data layer, adds request IDs and security response headers, and rate-limits selected endpoint groups. Important portfolio and permission events are recorded in the audit log.", "Session cookies are HttpOnly, use a host/path-scoped session, and are marked Secure when the request is HTTPS. OAuth uses a short-lived host-only state cookie to reduce sign-in request forgery risk."] },
      { heading: "What still needs ongoing work", body: ["The current rate-limit counters are held in application memory, so they are not shared across multiple instances. Centralised monitoring, alerting, routine restore tests, dependency scanning, MFA policy and an independent penetration test remain operational priorities.", "No website can promise that it is impossible to hack. We aim to reduce risk, keep improving the controls and be clear about what has and has not been independently tested."] },
      { heading: "A few things you can do", body: ["Use a unique password with your account provider, sign out on shared devices, and never share one-time codes or passwords. Avoid entering confidential client information unless you are authorised to store it in this workspace.", "If you notice something unusual, avoid sharing the details publicly. Report it through the project contact route on GitHub so it can be reviewed responsibly."] },
    ],
  },
};

export default function LegalPage({ path }: { path: string }) {
  const key = path.replace(/^\//, "") || "privacy";
  const document = documents[key] ?? documents.privacy;
  return (
    <main className="legal-page">
      <div className="legal-page__top">
        <Link href="/" className="legal-back"><ArrowLeft size={16} /> Back to FINTEL</Link>
        <span className="legal-security"><ShieldCheck size={15} /> Clear information. No surprises.</span>
      </div>
      <article className="legal-sheet">
        <p className="eyebrow">{document.eyebrow}</p>
        <h1>{document.title}</h1>
        <p className="legal-intro">{document.intro}</p>
        <p className="legal-date">Effective date: 10 November 2026 · Last reviewed: 10 November 2026</p>
        <div className="legal-sections">
          {document.sections.map(section => (
            <section key={section.heading}>
              <h2>{section.heading}</h2>
              {section.body.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
            </section>
          ))}
        </div>
        <aside className="legal-note">
          These pages describe the current FINTEL release. They are not a substitute for legal advice and may be updated as the service develops.
        </aside>
        <nav className="legal-related" aria-label="Related policies">
          {Object.keys(documents).filter(item => item !== key).map(item => <Link key={item} href={`/${item}`}>{item === "disclaimer" ? "Disclaimer" : item[0].toUpperCase() + item.slice(1)}</Link>)}
        </nav>
      </article>
      <footer className="legal-footer">FINTEL · Kenya Financial Intelligence · Independent research platform</footer>
    </main>
  );
}
