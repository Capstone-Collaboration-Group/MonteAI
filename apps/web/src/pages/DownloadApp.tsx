import { PageSidebar } from "../components/PageSidebar";
import { Download, Shield, Smartphone, Cpu } from "lucide-react";

import DownloadHero from "../sections/DownloadHero";
import DownloadSection from "../sections/DownloadSection";
import InstallationGuide from "../sections/InstallationGuide";
import Requirements from "../sections/Requirements";

const DOWNLOAD_SECTIONS = [
  { id: "download", label: "Download", icon: <Download className="h-5 w-5" /> },
  { id: "installation-guide", label: "Installation Guide", icon: <Smartphone className="h-5 w-5" /> },
  { id: "requirements", label: "Requirements", icon: <Cpu className="h-5 w-5" /> },
  { id: "support", label: "Support", icon: <Shield className="h-5 w-5" /> },
] as const;

export default function DownloadApp() {
  return (
    <PageSidebar
      sections={DOWNLOAD_SECTIONS}
      title="Mobile App"
      subtitle="Download & install MonteSkolar"
    >
      <DownloadHero />
      <div ref={(el) => (el as HTMLElement)?.setAttribute?.("id", "download")}>
        <DownloadSection />
      </div>
      <div ref={(el) => (el as HTMLElement)?.setAttribute?.("id", "installation-guide")}>
        <InstallationGuide />
      </div>
      <div ref={(el) => (el as HTMLElement)?.setAttribute?.("id", "requirements")}>
        <Requirements />
      </div>
    </PageSidebar>
  );
}