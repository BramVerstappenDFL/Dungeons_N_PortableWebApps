import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/** Offers a reload when a new version has been downloaded. */
export function UpdatePrompt() {
  const { needRefresh: [needRefresh, setNeedRefresh], offlineReady: [offlineReady, setOfflineReady], updateServiceWorker } = useRegisterSW();
  useEffect(() => {
    if (!offlineReady) return;
    const t = setTimeout(() => setOfflineReady(false), 4000);
    return () => clearTimeout(t);
  }, [offlineReady, setOfflineReady]);
  if (needRefresh) {
    return (
      <div className="toast" role="status">
        <span>A new version is ready.</span>
        <button className="gr-btn gr-btn--secondary gr-btn--small" onClick={() => setNeedRefresh(false)}>Later</button>
        <button className="gr-btn gr-btn--primary gr-btn--small" onClick={() => updateServiceWorker(true)}>Reload</button>
      </div>
    );
  }
  if (offlineReady) return <div className="toast" role="status"><span>Ready to work offline.</span></div>;
  return null;
}
