import { SettingsPanel } from "@monteai/ui";

import { userService } from "../lib/userService";

export default function SettingsPage() {
  return <SettingsPanel userService={userService} />;
}
