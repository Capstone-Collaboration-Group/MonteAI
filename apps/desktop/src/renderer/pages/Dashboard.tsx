import { Button, Card, Input } from "@monteai/ui";
import { formatDate } from "@monteai/utils";

const metrics = [
  {
    title: "Total submitted theses",
    value: "1,254",
    detail: "+12% vs last month",
    accent: "bg-primary/10 text-primary",
    progress: "w-[75%] bg-primary",
  },
  {
    title: "Approved theses",
    value: "1,169",
    detail: "+5.2% this quarter",
    accent: "bg-status-approved/10 text-status-approved",
    progress: "w-[90%] bg-status-approved",
  },
  {
    title: "Registered students",
    value: "856",
    detail: "+8% new enrollments",
    accent: "bg-blue-100 text-blue-700",
    progress: "w-[60%] bg-blue-600",
  },
  {
    title: "Pending reviews",
    value: "85",
    detail: "High attention required",
    accent: "bg-amber-100 text-amber-700",
    progress: "w-[40%] bg-amber-500",
  },
];

const activityFeed = [
  {
    title: "Maria Santos submitted a new thesis",
    subtitle: "Machine Learning-Based Grading System",
    time: "2 mins ago",
    icon: "note_add",
    accent: "bg-secondary-container/40 text-secondary",
  },
  {
    title: "Thesis approved by Dr. Reyes",
    subtitle: "Deep Learning Approach to Crop Disease Detection",
    time: "18 mins ago",
    icon: "check_circle",
    accent: "bg-primary/10 text-primary",
  },
  {
    title: "New student registered",
    subtitle: "Carlo Bautista — Computer Science",
    time: "1 hr ago",
    icon: "person_add",
    accent: "bg-blue-100 text-blue-700",
  },
];

const submissions = [
  {
    title: "Machine Learning-Based Grading System for Academic Institutions",
    student: "Maria Santos",
    department: "Computer Science",
    date: "2025-01-12",
    status: "Approved",
    statusClass: "bg-secondary-container/20 text-status-approved",
  },
  {
    title: "IoT-Enabled Smart Campus Monitoring and Alert System",
    student: "Juan dela Cruz",
    department: "Information Technology",
    date: "2025-01-14",
    status: "Pending",
    statusClass: "bg-amber-100 text-amber-700",
  },
  {
    title: "Blockchain Framework for Secure Student Records Management",
    student: "Ana Reyes",
    department: "Computer Science",
    date: "2025-01-15",
    status: "Pending",
    statusClass: "bg-amber-100 text-amber-700",
  },
];

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-surface-container-low/60 p-6 lg:p-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 rounded-2xl border border-outline-variant/60 bg-surface p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Administrator dashboard</p>
            <h2 className="text-2xl font-semibold text-on-surface">Overview</h2>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="w-full sm:w-80">
              <Input
                placeholder="Search thesis, student, or faculty"
                className="rounded-full border-outline-variant bg-surface-container-low"
              />
            </div>
            <Button variant="secondary" className="rounded-full">
              + New entry
            </Button>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map((item) => (
            <Card key={item.title} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className={`rounded-xl p-3 ${item.accent}`}>
                  <span className="material-symbols-outlined text-lg">description</span>
                </div>
                <span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary">
                  {item.detail}
                </span>
              </div>
              <h3 className="mt-6 text-3xl font-semibold text-on-surface">{item.value}</h3>
              <p className="mt-1 text-sm text-on-surface-variant">{item.title}</p>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-container">
                <div className={`h-full rounded-full ${item.progress}`} />
              </div>
            </Card>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
          <Card className="p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-on-surface">Thesis submission trends</h3>
                <p className="text-sm text-on-surface-variant">Monthly activity for the current academic year</p>
              </div>
              <Button variant="secondary" className="rounded-full px-3 py-2 text-sm">
                Last 12 months
              </Button>
            </div>

            <div className="flex h-64 items-end justify-between gap-2 rounded-2xl bg-surface-container-low p-4">
              {[40, 55, 45, 65, 85, 70, 95, 75, 60, 80, 100].map((height, index) => (
                <div key={index} className="flex flex-1 flex-col items-center gap-2">
                  <div className="w-full rounded-t-xl bg-primary/70" style={{ height: `${height}%` }} />
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
                    {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'][index]}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-on-surface">System activity</h3>
              <button className="text-sm font-semibold text-primary">View all</button>
            </div>
            <div className="space-y-4">
              {activityFeed.map((item) => (
                <div key={item.title} className="flex gap-3 rounded-xl border border-outline-variant/50 p-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${item.accent}`}>
                    <span className="material-symbols-outlined text-lg">{item.icon}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-on-surface">{item.title}</p>
                    <p className="text-sm text-on-surface-variant">{item.subtitle}</p>
                    <p className="mt-1 text-xs text-outline">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <Card className="overflow-hidden p-0">
          <div className="flex flex-col gap-4 border-b border-outline-variant/60 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-on-surface">Recent thesis submissions</h3>
              <p className="text-sm text-on-surface-variant">Latest records from your review queue</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" className="rounded-full px-3 py-2 text-sm">
                Filter
              </Button>
              <Button className="rounded-full px-3 py-2 text-sm">Create entry</Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left">
              <thead>
                <tr className="bg-surface-container-low text-[11px] font-semibold uppercase tracking-wide text-outline">
                  <th className="px-6 py-4">Thesis title</th>
                  <th className="px-6 py-4">Student</th>
                  <th className="px-6 py-4">Department</th>
                  <th className="px-6 py-4">Submission date</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((item) => (
                  <tr key={item.title} className="border-t border-outline-variant/40 bg-surface/70">
                    <td className="px-6 py-4 text-sm font-semibold text-on-surface">{item.title}</td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">{item.student}</td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">{item.department}</td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">{formatDate(item.date)}</td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${item.statusClass}`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}