import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** "Install" button: uses the browser prompt where available, shows instructions on iOS. */
export function InstallButton() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [iosHelp, setIosHelp] = useState(false);
  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as BeforeInstallPromptEvent); };
    const onInstalled = () => { setInstalled(true); setEvt(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);
  if (installed) return null;
  if (evt) {
    return <button className="btn btn-primary small" onClick={async () => { await evt.prompt(); await evt.userChoice; setEvt(null); }}>Install app</button>;
  }
  if (isIos()) {
    return (
      <>
        <button className="btn btn-ghost small" onClick={() => setIosHelp((v) => !v)}>Install</button>
        {iosHelp && <div className="ios-help" role="note" onClick={() => setIosHelp(false)}>Tap the Share button <span aria-hidden>⎋</span> then <strong>Add to Home Screen</strong>.</div>}
      </>
    );
  }
  return null;
}

/** Prompts to reload when a new version of the app has been downloaded. */
export function UpdatePrompt() {
  const { needRefresh: [needRefresh, setNeedRefresh], offlineReady: [offlineReady, setOfflineReady], updateServiceWorker } = useRegisterSW();
  useEffect(() => {
    if (!offlineReady) return;
    const t = setTimeout(() => setOfflineReady(false), 4000);
    return () => clearTimeout(t);
  }, [offlineReady, setOfflineReady]);
  if (needRefresh) {
    return (
      <div className="update-toast" role="status">
        <span>A new version is available.</span>
        <button className="btn btn-primary small" onClick={() => updateServiceWorker(true)}>Reload</button>
        <button className="btn btn-ghost small" onClick={() => setNeedRefresh(false)}>Later</button>
      </div>
    );
  }
  if (offlineReady) return <div className="update-toast" role="status">Ready to work offline.</div>;
  return null;
}
