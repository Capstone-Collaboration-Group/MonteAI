import { ArrowLeft, Calendar, Pencil, Trash2 } from "lucide-react";
import { Button } from "@monteai/ui";
import { formatDate } from "@monteai/utils";

type Priority = "Normal" | "Important" | "Urgent";

export type AnnouncementDetail = {
  id: number;
  subject: string;
  category: string;
  postedBy: string;
  date: string;
  priority: Priority;
  body: string;
  lastEdited: string;
  priorityClass?: string;
};

interface AnnouncementViewProps {
  announcement: AnnouncementDetail;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function AnnouncementView({ announcement, onBack, onEdit, onDelete }: AnnouncementViewProps) {
  return (
    <div className="min-h-screen bg-surface-container-low/60 p-6 lg:p-8">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <Button
            variant="secondary"
            className="rounded-full inline-flex items-center whitespace-nowrap"
            onClick={onBack}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex gap-2">
            <Button
              className="rounded-full inline-flex items-center gap-2 whitespace-nowrap bg-red-500 text-white hover:bg-red-600"
              onClick={onDelete}
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Announcement</span>
            </Button>
            <Button
              className="rounded-full inline-flex items-center gap-2 whitespace-nowrap"
              onClick={onEdit}
            >
              <Pencil className="w-4 h-4" />
              <span>Edit Announcement</span>
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-outline-variant/60 bg-surface p-8 shadow-sm">
          <div className="flex flex-wrap items-center gap-3 text-sm text-on-surface-variant">
            <span className="rounded-full bg-secondary-container/40 text-status-approved px-3 py-1 text-[11px] font-semibold uppercase tracking-wide">
              {announcement.category}
            </span>
            <span className="text-outline-variant">|</span>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              {formatDate(announcement.date)}
            </span>
            <span className="text-outline-variant">|</span>
            <span className="font-semibold text-on-surface">
              Priority: <span className="font-normal">{announcement.priority}</span>
            </span>
          </div>

          <h1 className="mt-4 text-3xl font-bold text-primary leading-tight">
            {announcement.subject}
          </h1>

          <p className="mt-4 text-sm font-semibold text-on-surface">
            Posted by: <span className="font-normal">{announcement.postedBy}</span>
          </p>

          <hr className="my-6 border-outline-variant/40" />

          <div className="whitespace-pre-line text-sm text-on-surface-variant leading-relaxed">
            {announcement.body}
          </div>

          <p className="mt-8 text-right text-xs font-medium uppercase tracking-wide text-outline">
            Last edited: {announcement.lastEdited}
          </p>
        </div>
      </div>
    </div>
  );
}