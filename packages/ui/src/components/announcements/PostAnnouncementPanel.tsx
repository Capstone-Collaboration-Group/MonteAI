import { ChevronDown, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../Button";
import { Dropdown } from "../common/Dropdown";
import { DropdownItem } from "../common/DropdownItem";
import { INSTITUTES, type Institute } from "./institutes";

type Priority = "Normal" | "Important" | "Urgent";

export type AnnouncementFormValues = {
  subject: string;
  author: string;
  date: string;
  category: string;
  institute: Institute;
  priority: Priority;
  body: string;
};

interface PostAnnouncementPanelProps {
  open: boolean;
  /** Pass an announcement's values to pre-fill the form for editing. Omit/null for a blank "create" form. */
  initialValues?: AnnouncementFormValues | null;
  onClose: () => void;
  onSubmit: (announcement: AnnouncementFormValues) => void;
}

const PRIORITY_OPTIONS: Priority[] = ["Normal", "Important", "Urgent"];

function getTodayString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = `${today.getMonth() + 1}`.padStart(2, "0");
  const day = `${today.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const BLANK = {
  subject: "",
  author: "",
  date: "",
  category: "",
  institute: "" as Institute | "",
  priority: "Normal" as Priority,
  body: "",
};

export function PostAnnouncementPanel({ open, initialValues, onClose, onSubmit }: PostAnnouncementPanelProps) {
  const [subject, setSubject] = useState(BLANK.subject);
  const [date, setDate] = useState(getTodayString());
  const [author, setAuthor] = useState(BLANK.author);
  const [category, setCategory] = useState(BLANK.category);
  const [institute, setInstitute] = useState<Institute | "">(BLANK.institute);
  const [instituteOpen, setInstituteOpen] = useState(false);
  const [priority, setPriority] = useState<Priority>(BLANK.priority);
  const [body, setBody] = useState(BLANK.body);

  const isEditing = Boolean(initialValues);

  // Whenever the panel opens, load either the announcement being edited
  // or a blank form for creating a new one.
  useEffect(() => {
    if (!open) return;

    if (initialValues) {
      setSubject(initialValues.subject);
      setDate(initialValues.date);
      setAuthor(initialValues.author);
      setCategory(initialValues.category);
      setInstitute(initialValues.institute);
      setPriority(initialValues.priority);
      setBody(initialValues.body);
    } else {
      setSubject(BLANK.subject);
      setDate(getTodayString());
      setAuthor(BLANK.author);
      setCategory(BLANK.category);
      setInstitute(BLANK.institute);
      setPriority(BLANK.priority);
      setBody(BLANK.body);
    }
  }, [open, initialValues]);

  const handleSubmit = () => {
    if (!institute) return;
    onSubmit({ subject, author, date, category, institute, priority, body });
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-label-sm font-label-sm text-outline">Author</label>
              <input
                type="text"
                value={author}
                onChange={(event) => setAuthor(event.target.value)}
                placeholder="e.g. Academic Affairs"
                className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-body-sm outline-none"
              />
            </div>
            <div>
              <label className="text-label-sm font-label-sm text-outline">Date</label>
              <input
                type="date"
                value={date}
                min={getTodayString()}
                onChange={(event) => setDate(event.target.value)}
                className="mt-1 w-full rounded-lg border border-outline-variant bg-white px-3 py-2 text-body-sm outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-label-sm font-label-sm text-outline">Category</label>
              <input
                type="text"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                placeholder="e.g. Academic"
                className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-body-sm outline-none"
              />
            </div>
            <div>
              <label className="text-label-sm font-label-sm text-outline">Institute</label>
              <Dropdown
                isOpen={instituteOpen}
                onOpenChange={setInstituteOpen}
                trigger={
                  <div className="mt-1 flex w-full items-center justify-between rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-body-sm">
                    <span className={institute ? "text-on-surface" : "text-on-surface-variant"}>
                      {institute || "Select institute"}
                    </span>
                    <ChevronDown className="w-4 h-4 text-on-surface-variant" />
                  </div>
                }
              >
                {INSTITUTES.map((option) => (
                  <DropdownItem
                    key={option}
                    variant={institute === option ? "primary" : "default"}
                    onClick={() => {
                      setInstitute(option);
                      setInstituteOpen(false);
                    }}
                  >
                    {option}
                  </DropdownItem>
                ))}
              </Dropdown>
            </div>
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
        </div>
      </div>

      <div className="p-6 border-t border-outline-variant bg-white">
        <Button onClick={handleSubmit} className="w-full rounded-full" disabled={!institute}>
          {isEditing ? "Save Changes" : "Post Announcement"}
        </Button>
      </div>
    </aside>
  );
}