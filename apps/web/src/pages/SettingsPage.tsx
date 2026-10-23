import { SettingsPanel } from "@monteai/ui";
import type { MfaApi } from "@monteai/ui";
import { useMemo } from "react";
import { mfaService } from "../lib/mfaService";

import { userService } from "../lib/userService";

export default function SettingsPage() {
  const mfa = useMemo<MfaApi>(
    () => ({
      status: () => mfaService.status(),
      enroll: () => mfaService.enroll(),
      confirmEnroll: (code) => mfaService.confirmEnroll({ code }),
      disable: (code) => mfaService.disable({ code }),
      regenerateRecoveryCodes: (code) => mfaService.regenerateRecoveryCodes({ code }),
    }),
    [],
  );
  return <SettingsPanel userService={userService} mfa={mfa} />;
}
