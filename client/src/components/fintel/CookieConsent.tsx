import { useEffect, useState } from "react";
import { Cookie, ShieldCheck, SlidersHorizontal, X } from "lucide-react";

type Preferences = {
  essential: true;
  analytics: boolean;
  personalization: boolean;
  savedAt: string;
};

const COOKIE_NAME = "fintel_consent";
const DEFAULT_PREFERENCES: Preferences = {
  essential: true,
  analytics: false,
  personalization: false,
  savedAt: "",
};

function readConsent(): Preferences | null {
  const value = document.cookie.split("; ").find(item => item.startsWith(`${COOKIE_NAME}=`))?.split("=").slice(1).join("=");
  if (!value) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Preferences;
    if (parsed?.essential !== true || typeof parsed.analytics !== "boolean" || typeof parsed.personalization !== "boolean") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeConsent(preferences: Preferences) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(preferences))}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}

export function CookieConsent() {
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [manage, setManage] = useState(false);
  const [draft, setDraft] = useState(DEFAULT_PREFERENCES);

  useEffect(() => {
    const saved = readConsent();
    setPreferences(saved);
    if (saved) setDraft(saved);
  }, []);

  function save(next: Preferences) {
    const value = { ...next, essential: true as const, savedAt: new Date().toISOString() };
    writeConsent(value);
    setPreferences(value);
    setDraft(value);
    setManage(false);
  }

  if (preferences && !manage) {
    return (
      <button className="cookie-reopen" onClick={() => { setDraft(preferences); setManage(true); }} aria-label="Open cookie preferences">
        <Cookie size={16} /> Cookie settings
      </button>
    );
  }

  return (
    <>
      {!manage && (
        <section className="cookie-banner" aria-label="Cookie information">
          <div className="cookie-banner__icon"><Cookie size={21} /></div>
          <div className="cookie-banner__copy">
            <strong>A quick note about cookies</strong>
            <p>We use a small essential cookie to remember this choice and keep your preferences. Optional analytics and personalisation are off unless you choose them.</p>
            <a href="/cookies">Read our cookie policy</a>
          </div>
          <div className="cookie-banner__actions">
            <button className="button button--quiet" onClick={() => save(DEFAULT_PREFERENCES)}>Essential only</button>
            <button className="button button--outline" onClick={() => setManage(true)}><SlidersHorizontal size={15} /> Preferences</button>
            <button className="button button--gold" onClick={() => save({ ...DEFAULT_PREFERENCES, analytics: true, personalization: true })}>Accept all</button>
          </div>
        </section>
      )}
      {manage && (
        <div className="cookie-dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setManage(false); }}>
          <section className="cookie-dialog" role="dialog" aria-modal="true" aria-labelledby="cookie-dialog-title">
            <button className="cookie-dialog__close" onClick={() => setManage(false)} aria-label="Close cookie preferences"><X size={18} /></button>
            <div className="cookie-dialog__mark"><ShieldCheck size={21} /></div>
            <p className="eyebrow">YOUR PRIVACY, YOUR CALL</p>
            <h2 id="cookie-dialog-title">Choose what FINTEL may remember</h2>
            <p className="cookie-dialog__intro">Essential cookies help the site and your sign-in work. The optional categories below are currently not used to run advertising or third-party tracking.</p>
            <div className="cookie-choice">
              <div><strong>Essential</strong><p>Required for basic site and sign-in functions. These cannot be switched off.</p></div>
              <span className="cookie-choice__locked">Always on</span>
            </div>
            <label className="cookie-choice">
              <div><strong>Analytics</strong><p>Would help us understand which parts of FINTEL are useful. No analytics tracker is enabled in this release.</p></div>
              <input type="checkbox" checked={draft.analytics} onChange={event => setDraft(old => ({ ...old, analytics: event.target.checked }))} />
            </label>
            <label className="cookie-choice">
              <div><strong>Personalisation</strong><p>Can remember display and workspace preferences on this device.</p></div>
              <input type="checkbox" checked={draft.personalization} onChange={event => setDraft(old => ({ ...old, personalization: event.target.checked }))} />
            </label>
            <div className="cookie-dialog__actions">
              <button className="button button--quiet" onClick={() => save(DEFAULT_PREFERENCES)}>Essential only</button>
              <button className="button button--gold" onClick={() => save(draft)}>Save my choices</button>
            </div>
            <a className="cookie-dialog__policy" href="/privacy">Privacy policy</a>
          </section>
        </div>
      )}
    </>
  );
}
