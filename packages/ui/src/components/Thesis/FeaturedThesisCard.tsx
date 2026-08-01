// packages/ui/src/components/Thesis/FeaturedThesisCard.tsx
import { ArrowRight, Calendar, User } from "lucide-react";
import type { ThesisSummary } from "@monteai/types";
import { Button } from "../Button";
import { Card } from "../Card";
import { formatDate } from "@monteai/utils";
import { StatusBadge } from "./StatusBadge";

interface FeaturedThesisCardProps {
  thesis: ThesisSummary;
  onViewDetails?: (thesisId: string) => void;
}

export function FeaturedThesisCard({ thesis, onViewDetails }: FeaturedThesisCardProps) {
  return (
    <Card className="flex h-full flex-col rounded-2xl border border-[#E4E0D4] bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <h2 className="font-serif text-xl font-semibold leading-snug text-[#1F2A24]">
          {thesis.title}
        </h2>
        <StatusBadge status={thesis.status} className="shrink-0" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-[#6B7C74]">
        <span className="flex items-center gap-1.5">
          <User className="h-3.5 w-3.5" />
          {thesis.authors.join(", ")}
        </span>
        <span className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          {formatDate(thesis.submittedDate)}
        </span>
      </div>

      {thesis.excerpt && (
        <p className="mt-4 line-clamp-2 text-sm leading-relaxed text-[#4A5750]">
          {thesis.excerpt}
        </p>
      )}

      <Button
        type="button"
        onClick={() => onViewDetails?.(thesis.id)}
        className="mt-auto flex w-fit items-center gap-1.5  text-sm font-semibold text-[#16342B] transition-colors hover:text-[#B8934C]"
      >
        View Details
        <ArrowRight className="h-4 w-4" />
      </Button>
    </Card>
  );
}