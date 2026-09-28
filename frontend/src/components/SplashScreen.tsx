import OryxaLogo from "./OryxaLogo";

export default function SplashScreen() {
  return (
    <div className="splash-screen" role="status" aria-live="polite" aria-label="Chargement de Oryxa">
      <div className="splash-screen__content">
        <OryxaLogo size={48} showName={true} nameClassName="font-extrabold text-xl text-white" imageClassName="rounded-xl shadow-lg" />
        <div className="splash-screen__loader"><div className="spinner" style={{ width: 15, height: 15, borderWidth: 2 }} /> <span>Chargement…</span></div>
      </div>
    </div>
  );
}
