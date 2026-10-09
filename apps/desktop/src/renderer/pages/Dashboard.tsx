import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTheses } from "@monteai/hooks";
import { FileText, BadgeCheck, Clock3, Database, ArrowRight } from "lucide-react";
import { Button, Card, EmptyState, PageHeader } from "@monteai/ui";
import { toThesisSummary } from "@monteai/types";
import { thesisService } from "../lib/thesisService";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export default function Dashboard() {
  const navigate = useNavigate();
  const { theses: rawTheses, isLoading, isError, refetch } = useTheses(thesisService);
  const theses = useMemo(() => rawTheses.map(toThesisSummary), [rawTheses]);

  const metrics = useMemo(() => {
    const pending = theses.filter(
      (thesis) => thesis.status === "pending" || thesis.status === "revision",
    ).length;
    const approved = theses.filter(
      (thesis) => thesis.status === "approved" || thesis.status === "scheduled",
    ).length;
    const indexed = theses.filter((thesis) => thesis.status === "indexed").length;

    return [
      {
        title: "Theses returned",
        value: theses.length,
        detail: "Records returned by the API",
        icon: FileText,
        accent: "bg-primary/10 text-primary",
      },
      {
        title: "Awaiting review",
        value: pending,
        detail: "Pending or revision requested",
        icon: Clock3,
        accent: "bg-amber-100 text-amber-700",
      },
      {
        title: "Approved or scheduled",
        value: approved,
        detail: "In the returned records",
        icon: BadgeCheck,
        accent: "bg-status-approved/10 text-status-approved",
      },
      {
        title: "Indexed",
        value: indexed,
        detail: "Available to AI retrieval",
        icon: Database,
        accent: "bg-blue-100 text-blue-700",
      },
    ];
  }, [theses]);

  const recentTheses = useMemo(
    () =>
      [...theses].sort(
        (a, b) =>
          new Date(b.submittedDate).getTime() - new Date(a.submittedDate).getTime(),
      ).slice(0, 5),
    [theses],
  );

  return (
    <div className="min-h-screen bg-surface-container-low/60 p-6 lg:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <PageHeader
          eyebrow="Administrator dashboard"
          title="Overview"
          actions={
            <Button
              type="button"
              variant="secondary"
              className="rounded-full"
              onClick={() => navigate("/theses")}
            >
              <span className="flex items-center gap-2">
                Browse theses <ArrowRight className="h-4 w-4" />
              </span>
            </Button>
          }
        />

        <p className="text-sm text-on-surface-variant">
          Counts reflect the thesis records currently returned by the API, not institution-wide totals.
        </p>

        {isError ? (
          <div
            role="alert"
            className="flex flex-col gap-3 rounded-xl border border-error/30 bg-error-container/40 p-4 text-sm text-on-surface sm:flex-row sm:items-center sm:justify-between"
          >
            <p>Thesis data could not be loaded. Check the server connection and try again.</p>
            <Button type="button" variant="secondary" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        ) : null}

        <section
          aria-label="Thesis overview metrics"
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          {metrics.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.title} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className={`rounded-xl p-3 ${item.accent}`}>
                    <Icon aria-hidden="true" className="h-5 w-5" />
                  </div>
                  <span className="rounded-full bg-surface-container-low px-2 py-1 text-[11px] font-semibold text-on-surface-variant">
                    Live data
                  </span>
                </div>
                <h3 className="mt-6 text-3xl font-semibold text-on-surface">
                  {isLoading ? "—" : item.value}
                </h3>
                <p className="mt-1 text-sm font-medium text-on-surface">{item.title}</p>
                <p className="mt-1 text-xs text-on-surface-variant">{item.detail}</p>
              </Card>
            );
          })}
        </section>

        <Card className="overflow-hidden p-0">
          <div className="flex flex-col gap-3 border-b border-outline-variant/60 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-on-surface">Recent thesis records</h3>
              <p className="text-sm text-on-surface-variant">
                Most recent submission dates in the records returned by the API
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              className="rounded-full"
              onClick={() => navigate("/theses")}
            >
              View catalog
            </Button>
          </div>

          {isLoading ? (
            <p role="status" className="p-6 text-sm text-on-surface-variant">
              Loading thesis records…
            </p>
          ) : isError ? (
            <p className="p-6 text-sm text-on-surface-variant">
              Recent records are unavailable until the server responds.
            </p>
          ) : recentTheses.length === 0 ? (
            <EmptyState
              className="m-6"
              icon={<FileText aria-hidden="true" className="h-10 w-10" />}
              title="No thesis records yet"
              description="When theses are submitted or archived, the latest records will appear here."
              action={
                <Button type="button" onClick={() => navigate("/theses")}>
                  Open thesis catalog
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] border-collapse text-left">
                <thead>
                  <tr className="bg-surface-container-low text-[11px] font-semibold uppercase tracking-wide text-outline">
                    <th className="px-6 py-4">Thesis title</th>
                    <th className="px-6 py-4">Authors</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="whitespace-nowrap px-6 py-4">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {recentTheses.map((thesis) => (
                    <tr
                      key={thesis.id}
                      className="border-t border-outline-variant/40 bg-surface/70 hover:bg-surface-container-low"
                    >
                      <td className="px-6 py-4 text-sm font-semibold text-on-surface">
                        <button
                          type="button"
                          className="text-left hover:text-primary focus-visible:underline"
                          onClick={() => navigate(`/thesis/view/${thesis.id}`)}
                        >
                          {thesis.title}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-sm text-on-surface-variant">
                        {thesis.authors.length > 0 ? thesis.authors.join(", ") : "—"}
                      </td>
                      <td className="px-6 py-4 text-sm capitalize text-on-surface-variant">
                        {thesis.status}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-on-surface-variant">
                        {Number.isNaN(new Date(thesis.submittedDate).getTime())
                          ? "—"
                          : dateFormatter.format(new Date(thesis.submittedDate))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
