import type { AxiosInstance } from "axios";
import type {
  BackupManifest,
  BackupManifestRequest,
  BackupStatsResponse,
  BackupCategoryKey,
} from "@monteai/types";
import type { BackupService } from "./types";

export class LiveBackupService implements BackupService {
  private readonly client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  async getStats(): Promise<BackupStatsResponse> {
    const { data } = await this.client.get<BackupStatsResponse>(`/backup/stats`);
    return data;
  }

  async createManifest(categories: BackupCategoryKey[]): Promise<BackupManifest> {
    const body: BackupManifestRequest = { categories };
    const { data } = await this.client.post<BackupManifest>(`/backup/manifest`, body);
    return data;
  }
}
