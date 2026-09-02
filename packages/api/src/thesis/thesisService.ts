import { type AxiosInstance } from "axios";
import type {
    ThesisResponseDto,
    SubmitThesisDto,
    UpdateThesisDto,
    IngestThesisDto,
    IngestThesisResponseDto,
    AnnotationResponseDto,
    CreateAnnotationDto,
    ResolveAnnotationDto,
    ThesisVersion
} from "@monteai/types";
import { handle404 } from "@monteai/utils"

import type { ThesisService } from "./types";


export class LiveThesisService implements ThesisService {
    private readonly client: AxiosInstance
    constructor(client: AxiosInstance) {
        this.client = client;
     }
    // async getThesis
    async getThesis(thesisId: string): Promise<ThesisResponseDto | null> {
        try {
            const { data } = await this.client.get<ThesisResponseDto>(`/thesis/${thesisId}`);
            return data;
        } catch (err) {
            return handle404(err, null);
        }
    }
    // async getTheses
    async getTheses(): Promise<ThesisResponseDto[] | []> {
        try {
            const { data } = await this.client.get<ThesisResponseDto[]>(`/thesis`);
            return data;
        } catch (err) {
            return handle404(err, []);
        }
    }
    // async submitThesis
    async submitThesis(dto: SubmitThesisDto): Promise<ThesisResponseDto> {
        const { data } = await this.client.post<ThesisResponseDto>(`/thesis/submit`, dto);
        return data;
    }
    // async ingestThesis(No Embedding currently implemented)
    async ingestThesis(dto: IngestThesisDto): Promise<IngestThesisResponseDto> {
        const { data } = await this.client.post<IngestThesisResponseDto>(
            `/thesis/ingest`,
            dto,
        );
        return data;
    }
    async getDownloadUrl(thesisId: string): Promise<{ url: string } | null> {
        try {
            const { data } = await this.client.get<{ url: string }>(`/thesis/${thesisId}/download-url`);

            return data;
        } catch (err) {
            return handle404(err, null);
        }
    }

    // async updateThesis
    async updateThesis(thesisId: string, dto: UpdateThesisDto): Promise<boolean> {
        try {
            const { data } = await this.client.patch<boolean>(`/thesis/update/details/${thesisId}`, dto);
            return data;
        } catch (err) {
            return handle404(err, false);
        }
    }
    // async updateThesisStatus
    async updateThesisStatus(thesisId: string, status: string): Promise<boolean> {
        try {
            const { data } = await this.client.patch<boolean>(`/thesis/update/status/${thesisId}`, { status },);
            return data;
        } catch (err) {
            return handle404(err, false);
        }

    }

    // async deleteThesis 
    async deleteThesis(thesisId: string): Promise<boolean> {
        try {
            const { data } = await this.client.delete<boolean>(`/thesis/delete/${thesisId}`);
            return data;
        } catch (err) {
            return handle404(err, false);
        }
    }

    // Annotations 
    async getAnnotations(thesisId: string, versionId: string): Promise<AnnotationResponseDto[] | []> {
        try {
            const { data } = await this.client.get<AnnotationResponseDto[]>(`/thesis/${thesisId}/versions/${versionId}/annotations`)
            return data;
        } catch (err) {
            return handle404(err, []);
        }

    }

    async createAnnotation(thesisId: string, dto: CreateAnnotationDto): Promise<boolean> {
        try {
            const { data } = await this.client.post<boolean>(`/thesis/${thesisId}/annotations`, dto);
            return data;
        } catch (err) {
            return handle404(err, false);
        }
    }

    async resolveAnnotation(thesisId: string, annotationId: string, dto: ResolveAnnotationDto): Promise<boolean> {
        try {
            const { data } = await this.client.patch<boolean>(`/thesis/${thesisId}/annotations/${annotationId}/resolve`, dto)
            return data;
        } catch (err) {
            return handle404(err, false);
        }
    }

    async deleteAnnotation(thesisId: string, annotationId: string): Promise<boolean> {
        try {
            const { data } = await this.client.delete<boolean>(`/thesis/${thesisId}/annotations/${annotationId}`);
            return data;
        } catch (err) {
            return handle404(err, false);
        }
    }
    // Versions
    async getVersions(thesisId: string): Promise<ThesisVersion[] | []> {
    try {
        const { data } = await this.client.get<{ success: boolean; result: ThesisVersion[] }>(
            `/thesis/${thesisId}/versions/`
        );
        return data.result ?? [];
    } catch (err) {
        return handle404(err, []);
    }
}
    async getVersionFile(versionId: string): Promise<{ url: string } | null> {
        try {
            const { data } = await this.client.get<{ url: string }>(
                `/thesis/versions/${versionId}/download-url`
            );
            return data;
        } catch (err) {
            return handle404(err, null);
        }
    }

    // Proceedings 
    async generateProceedings(thesisId: string): Promise<Blob> {
        const { data } = await this.client.post<Blob>(`/thesis/${thesisId}/proceedings`, {}, { responseType: "blob" })
        return data
    }
}
