import OryxaLogo from "./OryxaLogo";
export default function SplashScreen() {
  return (
    <div className="dark">
      <div className="app-bg !min-h-screen flex flex-col items-center justify-center gap-6 px-6">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />

        <div className="relative z-10 flex flex-col items-center gap-6 text-center animate-scale-in">
          <OryxaLogo size={96} showName={false} imageClassName="rounded-3xl shadow-2xl" />
          <div>
            <p className="text-sm text-gray-400">Gérez aujourd'hui, grandissez demain.</p>
          </div>
          <div className="flex items-center gap-2.5 text-gray-500 text-sm mt-2">
            <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
            Chargement…
          </div>
        </div>
      </div>
    </div>
  );
}
