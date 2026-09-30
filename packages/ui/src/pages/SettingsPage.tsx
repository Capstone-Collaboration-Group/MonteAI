import type { UserService } from "@monteai/api";

import { SettingsPanel } from "../components/Settings";

interface SettingsPageProps {
  userService: UserService;
}

export function SettingsPage({ userService }: SettingsPageProps) {
  return <SettingsPanel userService={userService} />;
}
