// apps/desktop/src/renderer/pages/Faculty.tsx
import { useState, useMemo } from "react";
import {
  PageHeader,
  Input,
  Card,
  Badge,
  EmptyState,
  Spinner,
  Avatar,
} from "@monteai/ui";
import { Users, GraduationCap, Search, Building2 } from "lucide-react";

// Services — wire up the same way scheduleService / thesisService are wired
import { createApiClient, createFacultyService, createProgramHeadService } from "@monteai/api";

// Hooks
import { useFaculties } from "@monteai/hooks/src/faculty/useFaculty";
import { useProgramHeads } from "@monteai/hooks/src/program-head/useProgramHead";

// ---------------------------------------------------------------------------
// Service setup (mirrors apps/desktop/src/renderer/lib/thesisService.ts)
// ---------------------------------------------------------------------------
const client = createApiClient({ baseURL: import.meta.env.VITE_API_BASE_URL });

const facultyService = createFacultyService(
  client,
  import.meta.env.VITE_USE_MOCK === "true"
);

const programHeadService = createProgramHeadService(
  client,
  import.meta.env.VITE_USE_MOCK === "true"
);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Tab = "faculty" | "program-head";

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** A single row in the faculty / program-head table */
function MemberRow({
  initials,
  name,
  email,
  role,
  institute,
  extra,
  isActive,
}: {
  initials: string;
  name: string;
  email: string;
  role: string;
  institute: string;
  extra?: string; // e.g. program handled for program heads
  isActive?: boolean;
}) {
  return (
    <tr className="border-t border-outline-variant/40 bg-surface/70 hover:bg-surface-container-high transition-colors cursor-pointer">
      {/* Identity */}
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <Avatar name={name} size="md" shape="circle" />
          <div>
            <p className="text-sm font-semibold text-on-surface">{name}</p>
            <p className="text-xs text-on-surface-variant">{email}</p>
          </div>
        </div>
      </td>

      {/* Role */}
      <td className="px-6 py-4">
        <span className="text-sm text-on-surface-variant">{role}</span>
      </td>

      {/* Institute */}
      <td className="px-6 py-4">
        <div className="flex items-center gap-1.5 text-sm text-on-surface-variant">
          <Building2 className="h-3.5 w-3.5 shrink-0 text-outline" />
          {institute}
        </div>
      </td>

      {/* Extra column (program handled / section) */}
      <td className="px-6 py-4">
        <span className="text-sm text-on-surface-variant">{extra ?? "—"}</span>
      </td>

      {/* Status */}
      <td className="px-6 py-4">
        <Badge variant={isActive ? "defense" : "critical"} dot size="sm">
          {isActive ? "Active" : "Inactive"}
        </Badge>
      </td>
    </tr>
  );
}

/** Summary card shown above the table */
function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accent}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-semibold text-on-surface">{value}</p>
        <p className="text-sm text-on-surface-variant">{label}</p>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function Faculty() {
  const [activeTab, setActiveTab] = useState<Tab>("faculty");
  const [search, setSearch] = useState("");

  // ── Data fetching ──────────────────────────────────────────────────────────
  const {
    data: faculties = [],
    isLoading: loadingFaculty,
    error: facultyError,
  } = useFaculties(facultyService);

  const {
    data: programHeads = [],
    isLoading: loadingPH,
    error: phError,
  } = useProgramHeads(programHeadService);

  const isLoading = activeTab === "faculty" ? loadingFaculty : loadingPH;
  const hasError = activeTab === "faculty" ? !!facultyError : !!phError;

  // ── Filtered rows ──────────────────────────────────────────────────────────
  const filteredFaculty = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return faculties;
    return faculties.filter(
      (f) =>
        `${f.firstName} ${f.lastName}`.toLowerCase().includes(q) ||
        f.email.toLowerCase().includes(q) ||
        f.institute.toLowerCase().includes(q) ||
        f.role.toLowerCase().includes(q)
    );
  }, [faculties, search]);

  const filteredProgramHeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return programHeads;
    return programHeads.filter(
      (ph) =>
        `${ph.firstName} ${ph.lastName}`.toLowerCase().includes(q) ||
        ph.email.toLowerCase().includes(q) ||
        ph.institute.toLowerCase().includes(q) ||
        ph.programHandled.toLowerCase().includes(q)
    );
  }, [programHeads, search]);

  const rows = activeTab === "faculty" ? filteredFaculty : filteredProgramHeads;

  // ── Stats ──────────────────────────────────────────────────────────────────
  const activeFaculty = faculties.filter((f) => f.isActive !== false).length;
  const activePH = programHeads.filter((ph) => ph.isActive !== false).length;

  // ── Helpers ────────────────────────────────────────────────────────────────
  const fullName = (first: string, mi?: string, last?: string, suffix?: string) =>
    [first, mi ? `${mi}.` : "", last, suffix].filter(Boolean).join(" ");

  // ── Tab button style ───────────────────────────────────────────────────────
  const tabCls = (tab: Tab) =>
    `inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
      activeTab === tab
        ? "bg-primary text-on-primary shadow-sm"
        : "text-on-surface-variant hover:bg-surface-container-high"
    }`;

  return (
    <div className="min-h-screen bg-surface-container-low/60 p-6 lg:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <PageHeader
          eyebrow="People management"
          title="Faculty & Program Heads"
          actions={
            <div className="w-full sm:w-80">
              <Input
                placeholder="Search by name, email, or institute…"
                value={search}
                onChange={(e) => setSearch((e.target as HTMLInputElement).value)}
                className="rounded-full border-outline-variant bg-surface-container-low"
              />
            </div>
          }
        />

        {/* ── Stat cards ──────────────────────────────────────────────────── */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Users}
            label="Total Faculty"
            value={faculties.length}
            accent="bg-primary/10 text-primary"
          />
          <StatCard
            icon={Users}
            label="Active Faculty"
            value={activeFaculty}
            accent="bg-status-approved/10 text-status-approved"
          />
          <StatCard
            icon={GraduationCap}
            label="Program Heads"
            value={programHeads.length}
            accent="bg-blue-100 text-blue-700"
          />
          <StatCard
            icon={GraduationCap}
            label="Active Program Heads"
            value={activePH}
            accent="bg-secondary-container/40 text-on-secondary"
          />
        </section>

        {/* ── Tab toggle ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            className={tabCls("faculty")}
            onClick={() => { setActiveTab("faculty"); setSearch(""); }}
          >
            <Users className="h-4 w-4" />
            Faculty
            <span className="ml-1 rounded-full bg-on-primary/20 px-2 py-0.5 text-[11px] font-bold">
              {faculties.length}
            </span>
          </button>

          <button
            type="button"
            className={tabCls("program-head")}
            onClick={() => { setActiveTab("program-head"); setSearch(""); }}
          >
            <GraduationCap className="h-4 w-4" />
            Program Heads
            <span className="ml-1 rounded-full bg-on-primary/20 px-2 py-0.5 text-[11px] font-bold">
              {programHeads.length}
            </span>
          </button>
        </div>

        {/* ── Table card ──────────────────────────────────────────────────── */}
        <Card className="overflow-hidden p-0">
          {/* Table meta bar */}
          <div className="flex flex-col gap-3 border-b border-outline-variant/60 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-on-surface">
                {activeTab === "faculty" ? "Faculty Members" : "Program Heads"}
              </h3>
              <p className="text-sm text-on-surface-variant">
                {activeTab === "faculty"
                  ? "All registered teaching and research faculty"
                  : "Faculty members managing academic programs"}
              </p>
            </div>

            {/* Search hint when results are filtered */}
            {search && (
              <p className="text-xs text-on-surface-variant">
                Showing {rows.length} result{rows.length !== 1 ? "s" : ""} for{" "}
                <span className="font-semibold text-primary">"{search}"</span>
              </p>
            )}
          </div>

          {/* ── Loading ─────────────────────────────────────────────────── */}
          {isLoading && (
            <div className="flex items-center justify-center py-20">
              <Spinner size="lg" label="Loading members…" />
            </div>
          )}

          {/* ── Error ───────────────────────────────────────────────────── */}
          {!isLoading && hasError && (
            <div className="p-8">
              <EmptyState
                title="Failed to load members"
                description="There was a problem fetching data. Please try again."
              />
            </div>
          )}

          {/* ── Empty search ────────────────────────────────────────────── */}
          {!isLoading && !hasError && rows.length === 0 && (
            <div className="p-8">
              <EmptyState
                icon={<Search className="h-8 w-8" />}
                title="No members found"
                description={
                  search
                    ? `No results match "${search}". Try a different search term.`
                    : `No ${activeTab === "faculty" ? "faculty members" : "program heads"} have been registered yet.`
                }
              />
            </div>
          )}

          {/* ── Table ───────────────────────────────────────────────────── */}
          {!isLoading && !hasError && rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-left">
                <thead>
                  <tr className="bg-surface-container-low text-[11px] font-semibold uppercase tracking-wide text-outline">
                    <th className="px-6 py-4">Member</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Institute</th>
                    <th className="px-6 py-4">
                      {activeTab === "faculty" ? "Designation" : "Program Handled"}
                    </th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {activeTab === "faculty"
                    ? (filteredFaculty as typeof faculties).map((f) => (
                        <MemberRow
                          key={f.id}
                          initials={`${f.firstName[0]}${f.lastName[0]}`}
                          name={fullName(f.firstName, f.middleInitial, f.lastName, f.suffix)}
                          email={f.email}
                          role={f.role}
                          institute={f.institute}
                          isActive={f.isActive !== false}
                        />
                      ))
                    : (filteredProgramHeads as typeof programHeads).map((ph) => (
                        <MemberRow
                          key={ph.id}
                          initials={`${ph.firstName[0]}${ph.lastName[0]}`}
                          name={fullName(ph.firstName, ph.middleInitial, ph.lastName, ph.suffix)}
                          email={ph.email}
                          role={ph.role}
                          institute={ph.institute}
                          extra={ph.programHandled}
                          isActive={ph.isActive !== false}
                        />
                      ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer count */}
          {!isLoading && !hasError && rows.length > 0 && (
            <div className="border-t border-outline-variant/40 px-6 py-3">
              <p className="text-xs text-on-surface-variant">
                {rows.length} {activeTab === "faculty" ? "faculty member" : "program head"}
                {rows.length !== 1 ? "s" : ""} total
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}