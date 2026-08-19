import { useState, useMemo } from "react";
import {
  PageHeader,
 
  Badge,
  EmptyState,
  Spinner,
  Avatar,
  StatCardGrid,
  type StatCardItem,
  Tabs,
  TabsList,
  TabsTrigger,
  DataTable,
  type DataTableColumn,
} from "../common"; 
import { Card, Input } from "../../index";
import { Users, GraduationCap, Search, Building2 } from "lucide-react";
import type { FacultyResponseDto, ProgramHeadResponseDto } from "@monteai/types";
import { fullNameHelper } from "@monteai/utils";
import type {   MemberRow } from "@monteai/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "faculty" | "program-head";

export interface FacultyViewProps {
  faculties: FacultyResponseDto[];
  programHeads: ProgramHeadResponseDto[];
  isLoading?: boolean;
  hasError?: boolean;
  onCreateNew?: () => void;
}

// ─── Column definitions ───────────────────────────────────────────────────────

function memberColumns(extraLabel: string): DataTableColumn<MemberRow>[] {
  return [
    {
      key: "name",
      label: "Member",
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar name={row.name} size="md" shape="circle" />
          <div>
            <p className="text-sm font-semibold text-on-surface">{row.name}</p>
            <p className="text-xs text-on-surface-variant">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      label: "Role",
      render: (row) => (
        <span className="text-sm text-on-surface-variant">{row.role}</span>
      ),
    },
    {
      key: "institute",
      label: "Institute",
      render: (row) => (
        <div className="flex items-center gap-1.5 text-sm text-on-surface-variant">
          <Building2 className="h-3.5 w-3.5 shrink-0 text-outline" />
          {row.institute}
        </div>
      ),
    },
    {
      key: "extra",
      label: extraLabel,
      render: (row) => (
        <span className="text-sm text-on-surface-variant">{row.extra || "—"}</span>
      ),
    },
    {
      key: "isActive",
      label: "Status",
      render: (row) => (
        <Badge variant={row.isActive ? "defense" : "critical"} dot size="sm">
          {row.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
  ];
}

// ─── View (pure presentational) ───────────────────────────────────────────────

export function FacultyView({
  faculties,
  programHeads,
  isLoading = false,
  hasError = false,
  onCreateNew,
}: FacultyViewProps) {
  const [activeTab, setActiveTab] = useState<Tab>("faculty");
  const [search, setSearch] = useState("");

  // ── Normalise into flat MemberRow shape ────────────────────────────────────
  const facultyRows = useMemo<MemberRow[]>(
    () =>
      faculties.map((f) => ({
        id: f.id,
        name: fullNameHelper(f.firstName, f.middleInitial, f.lastName, f.suffix),
        email: f.email,
        role: f.role,
        institute: f.institute,
        extra: "",
        isActive: f.isActive !== false,
      })),
    [faculties]
  );

  const programHeadRows = useMemo<MemberRow[]>(
    () =>
      programHeads.map((ph) => ({
        id: ph.id,
        name: fullNameHelper(ph.firstName, ph.middleInitial, ph.lastName, ph.suffix),
        email: ph.email,
        role: ph.role,
        institute: ph.institute,
        extra: ph.programHandled,
        isActive: ph.isActive !== false,
      })),
    [programHeads]
  );

  // ── Search ─────────────────────────────────────────────────────────────────
  const filteredRows = useMemo<MemberRow[]>(() => {
    const source = activeTab === "faculty" ? facultyRows : programHeadRows;
    const q = search.trim().toLowerCase();
    if (!q) return source;
    return source.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.institute.toLowerCase().includes(q) ||
        r.role.toLowerCase().includes(q) ||
        r.extra.toLowerCase().includes(q)
    );
  }, [activeTab, facultyRows, programHeadRows, search]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const activeFaculty = faculties.filter((f) => f.isActive !== false).length;
  const activePH = programHeads.filter((ph) => ph.isActive !== false).length;

  const stats: StatCardItem[] = [
    { icon: Users,         label: "Total Faculty",       value: faculties.length,    accent: "bg-primary/10 text-primary" },
    { icon: Users,         label: "Active Faculty",       value: activeFaculty,       accent: "bg-status-approved/10 text-status-approved" },
    { icon: GraduationCap, label: "Program Heads",        value: programHeads.length, accent: "bg-blue-100 text-blue-700" },
    { icon: GraduationCap, label: "Active Program Heads", value: activePH,            accent: "bg-green-100 text-green-700" },
  ];

  const columns = memberColumns(activeTab === "faculty" ? "Designation" : "Program Handled");

  return (
    <div className="min-h-screen bg-surface-container-low/60 p-6 lg:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <PageHeader
          eyebrow="People management"
          title="Faculty & Program Heads"
          actions={
            <div className="flex items-center gap-3">
              <div className="w-full sm:w-80">
                <Input
                  placeholder="Search by name, email, or institute…"
                  value={search}
                  onChange={(e) => setSearch((e.target as HTMLInputElement).value)}
                  className="rounded-full border-outline-variant bg-surface-container-low"
                />
              </div>
              {onCreateNew && (
                <button
                  type="button"
                  onClick={onCreateNew}
                  className="px-4 py-2 rounded-full bg-primary text-on-primary text-sm font-semibold hover:bg-primary/90 transition-colors"
                >
                  + Add Member
                </button>
              )}
            </div>
          }
        />

        {/* ── Stat cards ──────────────────────────────────────────────────── */}
        <StatCardGrid stats={stats} />

        {/* ── Tab toggle ──────────────────────────────────────────────────── */}
        <Tabs
          value={activeTab}
          variant="pills"
          onValueChange={(val) => { setActiveTab(val as Tab); setSearch(""); }}
        >
          <TabsList>
            <TabsTrigger value="faculty" icon={Users} badge={faculties.length}>
              Faculty
            </TabsTrigger>
            <TabsTrigger value="program-head" icon={GraduationCap} badge={programHeads.length}>
              Program Heads
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* ── Table card ──────────────────────────────────────────────────── */}
        <Card className="overflow-hidden p-0">

          {/* Meta bar */}
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
            {search && (
              <p className="text-xs text-on-surface-variant">
                Showing {filteredRows.length} result{filteredRows.length !== 1 ? "s" : ""} for{" "}
                <span className="font-semibold text-primary">"{search}"</span>
              </p>
            )}
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center py-20">
              <Spinner size="lg" label="Loading members…" />
            </div>
          )}

          {/* Error */}
          {!isLoading && hasError && (
            <div className="p-8">
              <EmptyState
                title="Failed to load members"
                description="There was a problem fetching data. Please try again."
              />
            </div>
          )}

          {/* Empty */}
          {!isLoading && !hasError && filteredRows.length === 0 && (
            <div className="p-8">
              <EmptyState
                icon={<Search className="h-8 w-8" />}
                title="Nothing found"
                description={
                  search
                    ? `No results match "${search}". Try a different search term.`
                    : `No ${activeTab === "faculty" ? "faculty members" : "program heads"} have been registered yet.`
                }
              />
            </div>
          )}

          {/* Table */}
          {!isLoading && !hasError && filteredRows.length > 0 && (
            <DataTable
              columns={columns}
              data={filteredRows}
              rowKey={(row) => row.id}
              unstyled
            />
          )}

          {/* Footer */}
          {!isLoading && !hasError && filteredRows.length > 0 && (
            <div className="border-t border-outline-variant/40 px-6 py-3">
              <p className="text-xs text-on-surface-variant">
                {filteredRows.length}{" "}
                {activeTab === "faculty" ? "faculty member" : "program head"}
                {filteredRows.length !== 1 ? "s" : ""} total
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}