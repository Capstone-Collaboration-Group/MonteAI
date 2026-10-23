import type { UserService } from "@monteai/api";

import { SettingsPanel, type MfaApi } from "../components/Settings";

interface SettingsPageProps {
  userService: UserService;
  mfa?: MfaApi;
}

export function SettingsPage({ userService, mfa }: SettingsPageProps) {
  return <SettingsPanel userService={userService} mfa={mfa} />;
}
