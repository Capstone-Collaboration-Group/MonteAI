import type { ThesisService } from "./types";
import type { 
    ThesisResponseDto,
    UpdateThesisDto,
    SubmitThesisDto,
    IngestThesisDto,
    IngestThesisResponseDto

} from "@monteai/types";

function delay(ms: number) { 
    return new Promise((resolve) => setTimeout(resolve, ms));
}

console.log("mockThesisService loaded — Initialized with seed data");

function buildSpeed(): ThesisResponseDto[] {
    const theses: ThesisResponseDto[] = [
        {
      id: "t1",
      title: "Assessing Cloud-based Platforms for Self-Paced Skill Enhancement",
      status: "Published",
      authors: ["Charles Balaguer", "Angelica Buenaagua", "John Christian Joyo", "Reca Mae Montebon"],
      submittedAt: "2023-01-15T00:00:00.000Z",
      filePath: "https://www.orimi.com/pdf-test.pdf",
      updatedAt: "2023-01-15T00:00:00.000Z",
      uploadedById: "CharrlesID",
      abstract: "Abstract Ngani",
      approvedAt: "",
      indexedAt: "",
      institute: "Institute of Computing Studies",
      pineconeStatus: "None",
      rejectedAt: "",
      reviewedAt: "", 
    },
    {
      id: "t2",
      title: "AI-Driven Phishing & Social Engineering Detection",
      status: "Under Review",
       authors: ["Liyo Wang", "Jazon Williams Chang", "Jake Laurence Galgo"],
      submittedAt: "2023-01-15T00:00:00.000Z",
      filePath: "https://www.orimi.com/pdf-test.pdf",
      updatedAt: "2023-01-15T00:00:00.000Z",
      uploadedById: "CharrlesID",
      abstract: "Abstract Ngani",
      approvedAt: "",
      indexedAt: "",
      institute: "Institute of Computing Studies",
      pineconeStatus: "None",
      rejectedAt: "",
      reviewedAt: "", 
    }
    ];
    return theses as ThesisResponseDto[]
}

const thesesMap = new Map<string, ThesisResponseDto>(); 
buildSpeed().forEach((t) => thesesMap.set(t.id, t));

export const mockThesisService : ThesisService = { 
    async getThesis(thesisId: string) { 
        await delay(150);
        return thesesMap.get(thesisId) ?? null;
    },
    async getTheses() { 
        await delay(300);
        return Array.from(thesesMap.values());
    },
    async submitThesis(dto: SubmitThesisDto) { 
        await delay(300);
        const id = crypto.randomUUID();

        const newThesis = { 
            id, 
            ...dto,
            status: "Pending",
            createdAt: new Date().toISOString()
        } as unknown as ThesisResponseDto;
        thesesMap.set(id, newThesis);
        return newThesis;
    },
    async ingestThesis(dto: IngestThesisDto) {
    await delay(300);
    const existing = thesesMap.get(dto.thesisId);
    if (!existing) {
        return {
            thesisId: dto.thesisId,
            vectorCount: 0,
            status: 'Failed',
        } as IngestThesisResponseDto;
    }

    thesesMap.set(dto.thesisId, {
        ...existing,
        pineconeStatus: 'Indexed',
        indexedAt: new Date().toISOString(),
    } as ThesisResponseDto);

    return {
        thesisId: dto.thesisId,
        vectorCount: dto.chunks.length,
        status: 'Indexed',
    } as IngestThesisResponseDto;
},
   

    async updateThesis(thesisId: string, dto: UpdateThesisDto) { 
        await delay(300);
        const existing = thesesMap.get(thesisId);
        if(!existing) return false;
        thesesMap.set(thesisId, { ...existing, ...dto } as ThesisResponseDto);
        return true;
    },
    async getDownloadUrl(thesisId: string) {
        await delay(300);
        const existing = thesesMap.get(thesisId);
        if (!existing) return null;
        return { url: existing.filePath };
    },
    async updateThesisStatus(thesisId: string, status: string) {
        await delay(300);
        const existing = thesesMap.get(thesisId);
        if(!existing) return false;

        thesesMap.set(thesisId, { ...existing, status } as unknown as ThesisResponseDto);
        return true;
    },

    async deleteThesis(thesisId: string) { 
        await delay(300);
        return thesesMap.delete(thesisId);
    },
};
