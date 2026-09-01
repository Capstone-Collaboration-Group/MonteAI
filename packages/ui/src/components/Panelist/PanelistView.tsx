import { useState, useMemo } from "react";
import {
  PageLayout,
  PageHeader,
  Badge,
  EmptyState,
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
import { Users, Search, Building2, CheckCircle, Clock } from "lucide-react";
import type {
  PanelistResponseDto,
  PanelistAssignmentSummary,
  PanelistType,
  ScheduleResponseDto,
} from "@monteai/types";
import { fullNameHelper } from "@monteai/utils";
import { PanelistDetailPanel } from "./PanelistDetailPanel";
import { PanelistViewSkeleton } from "./skeletons";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "assigned" | "unassigned";

export interface PanelistViewProps {
  panelists: PanelistResponseDto[];
  /** Full schedule pool — used to resolve each assignment's scheduleId -> room venue etc. */
  schedules?: ScheduleResponseDto[];
  isLoading?: boolean;
  hasError?: boolean;
  onCreateNew?: () => void;
}

interface PanelistRow extends Record<string, unknown> {
  id: string;
  name: string;
  email: string;
  role: string;
  institute: string;
  panelistType: PanelistType;
  assignments: PanelistAssignmentSummary[];
  isAssigned: boolean;
  _raw: PanelistResponseDto;
}

// ─── Column definitions ───────────────────────────────────────────────────────

function panelistColumns(): DataTableColumn<PanelistRow>[] {
  return [
    {
      key: "name",
      label: "Panelist",
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
          {row.institute || "—"}
        </div>
      ),
    },
    {
      key: "isAssigned",
      label: "Status",
      render: (row) => (
        <Badge variant={row.isAssigned ? "defense" : "critical"} dot size="sm">
          {row.isAssigned
            ? `Assigned (${row.assignments.length})`
            : "Unassigned"}
        </Badge>
      ),
    },
  ];
}

// ─── View ─────────────────────────────────────────────────────────────────────

export function PanelistView({
  panelists,
  schedules = [],
  isLoading = false,
  hasError = false,
  onCreateNew,
}: PanelistViewProps) {
 

  const [activeTab, setActiveTab] = useState<Tab>("assigned");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<PanelistResponseDto | null>(null);

  // ── Lookup map — mirrors ScheduleCalendar's panelistsById pattern ──────────
  const schedulesById = useMemo(() => {
    const map = new Map<string, ScheduleResponseDto>();
    schedules.forEach((s) => map.set(s.scheduleId, s));
    return map;
  }, [schedules]);

  // ── Normalise ──────────────────────────────────────────────────────────────
  const allRows = useMemo<PanelistRow[]>(
    () =>
      panelists.map((p) => ({
        id: p.id,
        name: fullNameHelper(
          p.firstName,
          p.middleInitial,
          p.lastName,
          p.suffix,
        ),
        email: p.email,
        role: p.role,
        institute: p.institute ?? "",
        panelistType: p.panelistType,
        assignments: p.assignments,
        isAssigned: p.isAssigned,
        _raw: p,
      })),
    [panelists],
  );

  

  const assignedRows = useMemo(
    () => allRows.filter((r) => r.isAssigned),
    [allRows],
  );
  const unassignedRows = useMemo(
    () => allRows.filter((r) => !r.isAssigned),
    [allRows],
  );

  // ── Search ─────────────────────────────────────────────────────────────────
  const filteredRows = useMemo<PanelistRow[]>(() => {
    const source = activeTab === "assigned" ? assignedRows : unassignedRows;
    const q = search.trim().toLowerCase();
    if (!q) return source;
    return source.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.institute.toLowerCase().includes(q) ||
        r.role.toLowerCase().includes(q) ||
        r.assignments.some((a) => a.groupName.toLowerCase().includes(q)),
    );
  }, [activeTab, assignedRows, unassignedRows, search]);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats: StatCardItem[] = [
    {
      icon: Users,
      label: "Total Panelists",
      value: panelists.length,
      accent: "bg-primary/10 text-primary",
    },
    {
      icon: CheckCircle,
      label: "Assigned Panelists",
      value: assignedRows.length,
      accent: "bg-status-approved/10 text-status-approved",
    },
    {
      icon: Clock,
      label: "Unassigned Panelists",
      value: unassignedRows.length,
      accent: "bg-blue-100 text-blue-700",
    },
  ];

  const columns = panelistColumns();
  const tabLabel =
    activeTab === "assigned" ? "panelist" : "unassigned panelist";

     if (isLoading) {
    return <PanelistViewSkeleton />;
  }

  return (
    <PageLayout direction="row" className="overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-8">
          {/* ── Page header ───────────────────────────────────────────────── */}
          <PageHeader
            eyebrow="People management"
            title="Panelists"
            actions={
              <div className="flex items-center gap-3">
                <div className="w-full sm:w-80">
                  <Input
                    placeholder="Search by name, email, or institute…"
                    value={search}
                    onChange={(e) =>
                      setSearch((e.target as HTMLInputElement).value)
                    }
                    className="rounded-full border-outline-variant bg-surface-container-low"
                  />
                </div>
                {onCreateNew && (
                  <button
                    type="button"
                    onClick={onCreateNew}
                    className="px-4 py-2 rounded-full bg-primary text-on-primary text-sm font-semibold hover:bg-primary/90 transition-colors"
                  >
                    + Add Panelist
                  </button>
                )}
              </div>
            }
          />

          {/* ── Stat cards ────────────────────────────────────────────────── */}
          <StatCardGrid stats={stats} />

          {/* ── Tab toggle ────────────────────────────────────────────────── */}
          <Tabs
            value={activeTab}
            variant="pills"
            onValueChange={(val) => {
              setActiveTab(val as Tab);
              setSearch("");
            }}
          >
            <TabsList>
              <TabsTrigger
                value="assigned"
                icon={CheckCircle}
                badge={assignedRows.length}
              >
                Assigned
              </TabsTrigger>
              <TabsTrigger
                value="unassigned"
                icon={Clock}
                badge={unassignedRows.length}
              >
                Unassigned
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* ── Table card ────────────────────────────────────────────────── */}
          <Card className="overflow-hidden p-0">
            {/* Meta bar */}
            <div className="flex flex-col gap-3 border-b border-outline-variant/60 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-on-surface">
                  {activeTab === "assigned"
                    ? "Assigned Panelists"
                    : "Unassigned Panelists"}
                </h3>
                <p className="text-sm text-on-surface-variant">
                  {activeTab === "assigned"
                    ? "Panelists currently assigned to a defense group"
                    : "Panelists not yet assigned to any defense group"}
                </p>
              </div>
              {search && (
                <p className="text-xs text-on-surface-variant">
                  Showing {filteredRows.length} result
                  {filteredRows.length !== 1 ? "s" : ""} for{" "}
                  <span className="font-semibold text-primary">"{search}"</span>
                </p>
              )}
            </div>

            {/* Loading */}
            {/* Error */}
            {!isLoading && hasError && (
              <div className="p-8">
                <EmptyState
                  title="Failed to load panelists"
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
                      : `No ${activeTab === "assigned" ? "assigned" : "unassigned"} panelists found.`
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
                onRowClick={(row) => setSelected(row._raw)}
                unstyled
              />
            )}

            {/* Footer */}
            {!isLoading && !hasError && filteredRows.length > 0 && (
              <div className="border-t border-outline-variant/40 px-6 py-3">
                <p className="text-xs text-on-surface-variant">
                  {filteredRows.length} {tabLabel}
                  {filteredRows.length !== 1 ? "s" : ""} total
                </p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ── Detail panel ──────────────────────────────────────────────────── */}
      <PanelistDetailPanel
        panelist={selected}
        onClose={() => setSelected(null)}
        schedulesById={schedulesById}
      />
    </PageLayout>
  );
}
