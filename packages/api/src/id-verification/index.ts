import { LiveIdVerificationService } from "./liveIdVerificationService";
import { mockIdVerificationService } from "./mockIdVerificationService";
import type {
  IdVerificationService,
  IdVerificationServiceConfig,
} from "./types";

export function createIdVerificationService(
  config: IdVerificationServiceConfig,
): IdVerificationService {
  return config.useMock
    ? mockIdVerificationService
    : new LiveIdVerificationService(config);
}

export { LiveIdVerificationService, mockIdVerificationService };
export { sanitizeIdVerificationError } from "./liveIdVerificationService";
export { IdVerificationError } from "./types";
export type { IdVerificationService, IdVerificationServiceConfig, IdVerificationRequestOptions } from "./types";
