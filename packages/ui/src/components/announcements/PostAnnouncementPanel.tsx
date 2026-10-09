import { ChevronDown, Paperclip, X } from "lucide-react";
import { useState } from "react";
import { Button } from "../Button";
import { Dropdown } from "../common/Dropdown";
import { DropdownItem } from "../common/DropdownItem";

type Priority = "Normal" | "Important" | "Urgent";

const CATEGORY_OPTIONS = [
  "Academic",
  "Research",
  "Thesis Defense",
  "Administrative",
  "Event",
  "Student Affairs",
  "Faculty Affairs",
  "Library",
  "Financial",
  "IT & Technology",
  "General",
] as const;

export type AnnouncementFormValues = {
  subject: string;
  category: string;
  priority: Priority;
  body: string;
  attachmentUrls: string[];
};

interface PostAnnouncementPanelProps {
  open: boolean;
  initialValues?: AnnouncementFormValues | null;
  onClose: () => void;
  onSubmit: (announcement: AnnouncementFormValues) => void;
}

const PRIORITY_OPTIONS: Priority[] = ["Normal", "Important", "Urgent"];

const BLANK = {
  subject: "",
  category: "",
  priority: "Normal" as Priority,
  body: "",
  attachmentUrls: [] as string[],
};

export function PostAnnouncementPanel({ open, initialValues, onClose, onSubmit }: PostAnnouncementPanelProps) {
  const [subject, setSubject] = useState(initialValues?.subject ?? BLANK.subject);
  const [category, setCategory] = useState(initialValues?.category ?? BLANK.category);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [priority, setPriority] = useState<Priority>(initialValues?.priority ?? BLANK.priority);
  const [body, setBody] = useState(initialValues?.body ?? BLANK.body);
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>(
    initialValues?.attachmentUrls ?? BLANK.attachmentUrls,
  );
  const [urlDraft, setUrlDraft] = useState("");
  const [urlError, setUrlError] = useState("");

  const isEditing = Boolean(initialValues);

  const addAttachmentUrl = () => {
    const value = urlDraft.trim();

    if (!value) return;

    if (/\s/.test(value)) {
      setUrlError("Attachment URL cannot contain spaces.");
      return;
    }

    if (attachmentUrls.includes(value)) {
      setUrlError("This attachment URL is already added.");
      return;
    }

    setAttachmentUrls((current) => [...current, value]);
    setUrlDraft("");
    setUrlError("");
  };

  const removeAttachmentUrl = (url: string) => {
    setAttachmentUrls((current) => current.filter((item) => item !== url));
    setUrlError("");
  };

  const handleSubmit = () => {
    onSubmit({ subject, category, priority, body, attachmentUrls });
  };

  return (
    <aside
      className={`w-[420px] bg-surface-container-low border-l border-outline-variant flex flex-col h-full transform transition-transform duration-300 ${
        open ? "translate-x-0" : "translate-x-full"
      } fixed top-0 right-0 z-50 shadow-2xl`}
    >
      <div className="p-6 overflow-y-auto flex-1">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-headline-sm font-headline-sm text-primary">
              {isEditing ? "Edit Announcement" : "Create Announcement"}
            </h3>
            <p className="text-body-sm text-on-surface-variant mt-1">
              {isEditing
                ? "Update the details of this announcement."
                : "Draft an announcement to be broadcast to the institutional community."}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-container rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 bg-white rounded-xl border border-outline-variant space-y-5">
          <div>
            <label className="text-label-sm font-label-sm text-outline">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="e.g. Call for Research Proposals 2024"
              className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-body-sm outline-none"
            />
          </div>

          <div>
            <label className="text-label-sm font-label-sm text-outline">Category</label>
            <Dropdown
              isOpen={categoryOpen}
              onOpenChange={setCategoryOpen}
              trigger={
                <div className="mt-1 flex w-full items-center justify-between rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-body-sm">
                  <span className={category ? "text-on-surface" : "text-on-surface-variant"}>
                    {category || "Select category"}
                  </span>
                  <ChevronDown className="w-4 h-4 text-on-surface-variant" />
                </div>
              }
            >
              {CATEGORY_OPTIONS.map((option) => (
                <DropdownItem
                  key={option}
                  variant={category === option ? "primary" : "default"}
                  onClick={() => {
                    setCategory(option);
                    setCategoryOpen(false);
                  }}
                >
                  {option}
                </DropdownItem>
              ))}
            </Dropdown>
          </div>

          <div>
            <label className="text-label-sm font-label-sm text-outline">Priority</label>
            <div className="mt-1 flex flex-wrap gap-2">
              {PRIORITY_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setPriority(option)}
                  className={`min-w-[90px] flex-1 rounded-full px-2 py-1 text-[12px] font-semibold border transition-colors ${
                    priority === option
                      ? "bg-primary text-white border-primary"
                      : "bg-white text-on-surface-variant border-outline-variant"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-label-sm font-label-sm text-outline">Body Content</label>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Compose your announcement here..."
              className="mt-1 w-full min-h-[140px] resize-y rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-body-sm outline-none"
            />
          </div>

          <div>
            <label className="text-label-sm font-label-sm text-outline">Attachment URLs</label>
            <div className="mt-1 flex gap-2">
              <input
                type="url"
                value={urlDraft}
                onChange={(event) => {
                  setUrlDraft(event.target.value);
                  setUrlError("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addAttachmentUrl();
                  }
                }}
                placeholder="https://example.com/attachment.pdf"
                className="min-w-0 flex-1 rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-body-sm outline-none"
              />
              <button
                type="button"
                onClick={addAttachmentUrl}
                className="shrink-0 rounded-lg border border-outline-variant bg-white px-3 py-2 text-body-sm font-semibold text-primary transition-colors hover:bg-surface-container"
              >
                Add
              </button>
            </div>

            {urlError && (
              <p className="mt-1 text-[12px] text-error">{urlError}</p>
            )}

            {attachmentUrls.length > 0 && (
              <ul className="mt-2 flex flex-col gap-2">
                {attachmentUrls.map((url) => (
                  <li
                    key={url}
                    className="flex items-center gap-2 rounded-lg border border-outline-variant bg-white px-3 py-2"
                  >
                    <Paperclip className="h-4 w-4 shrink-0 text-on-surface-variant" />
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer noopener"
                      title={url}
                      className="min-w-0 flex-1 truncate text-body-sm text-primary underline"
                    >
                      {url}
                    </a>
                    <button
                      type="button"
                      onClick={() => removeAttachmentUrl(url)}
                      aria-label={`Remove attachment ${url}`}
                      className="shrink-0 rounded-full p-1 transition-colors hover:bg-surface-container"
                    >
                      <X className="h-4 w-4 text-on-surface-variant" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 border-t border-outline-variant bg-white">
        <Button onClick={handleSubmit} className="w-full rounded-full">
          {isEditing ? "Save Changes" : "Post Announcement"}
        </Button>
      </div>
    </aside>
  );
}
