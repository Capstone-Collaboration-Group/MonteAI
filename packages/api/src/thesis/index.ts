import type { AxiosInstance } from "axios";
import { mockThesisService } from "./mockThesisService";
import { LiveThesisService } from "./thesisService";
import type { ThesisService } from "./types";

export function createThesisService(
    client: AxiosInstance,
    useMock: boolean
): ThesisService  {
    return useMock ? mockThesisService : new LiveThesisService(client)
}
export type { ThesisService } from "./types";
export  { mockThesisService } from "./mockThesisService";
export {LiveThesisService } from "./thesisService";