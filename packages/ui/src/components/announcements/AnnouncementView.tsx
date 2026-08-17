import { ArrowLeft, Calendar, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "../Button";
import { formatDate } from "@monteai/utils";
import { getAnnouncementPermissions, type UserRole } from "./permissions";
import type { Institute } from "./institutes";

type Priority = "Normal" | "Important" | "Urgent";

export type AnnouncementDetail = {
  id: number;
  subject: string;
  category: string;
  institute: Institute;
  postedBy: string;
  date: string;
  priority: Priority;
  body: string;
  lastEdited: string;
  priorityClass?: string;
};

interface AnnouncementViewProps {
  announcement: AnnouncementDetail;
  role: UserRole;
  userInstitute?: Institute;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function AnnouncementView({
  announcement,
  role,
  userInstitute,
  onBack,
  onEdit,
  onDelete,
}: AnnouncementViewProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditConfirm, setShowEditConfirm] = useState(false);
  const permissions = getAnnouncementPermissions({
    role,
    userInstitute,
    announcementInstitute: announcement.institute,
  });

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    setShowDeleteConfirm(false);
    onDelete();
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  const handleEditClick = () => {
    setShowEditConfirm(true);
  };

  const handleConfirmEdit = () => {
    setShowEditConfirm(false);
    onEdit();
  };

  const handleCancelEdit = () => {
    setShowEditConfirm(false);
  };

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

          {(permissions.canEdit || permissions.canDelete) && (
            <div className="flex gap-2">
              {permissions.canDelete && (
                <Button
                  className="rounded-full inline-flex items-center gap-2 whitespace-nowrap bg-red-500 text-white hover:bg-red-600"
                  onClick={handleDeleteClick}
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Announcement</span>
                </Button>
              )}
              {permissions.canEdit && (
                <Button
                  className="rounded-full inline-flex items-center gap-2 whitespace-nowrap"
                  onClick={handleEditClick}
                >
                  <Pencil className="w-4 h-4" />
                  <span>Edit Announcement</span>
                </Button>
              )}
            </div>
          )}
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
                <span className="font-normal">{announcement.institute}</span>
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
          <p className="mt-1 text-sm font-semibold text-on-surface">
            Institute: <span className="font-normal">{announcement.institute}</span>
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

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-outline-variant/60 bg-surface p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-on-surface">Delete announcement?</h3>
            <p className="mt-2 text-sm text-on-surface-variant">
              This action cannot be undone. Are you sure you want to delete this announcement?
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" className="rounded-full" onClick={handleCancelDelete}>
                Cancel
              </Button>
              <Button className="rounded-full bg-red-500 text-white hover:bg-red-600" onClick={handleConfirmDelete}>
                Confirm Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {showEditConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-outline-variant/60 bg-surface p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-on-surface">Edit announcement?</h3>
            <p className="mt-2 text-sm text-on-surface-variant">
              This will open the announcement editor so you can update the details.
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" className="rounded-full" onClick={handleCancelEdit}>
                Cancel
              </Button>
              <Button className="rounded-full" onClick={handleConfirmEdit}>
                Confirm Edit
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}