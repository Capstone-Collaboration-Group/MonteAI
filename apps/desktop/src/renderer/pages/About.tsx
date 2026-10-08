import { BookOpen, Database, ShieldCheck } from "lucide-react";
import { Card, PageHeader } from "@monteai/ui";

const responsibilities = [
  {
    title: "Thesis records",
    description: "Review and manage institutional thesis submissions.",
    icon: BookOpen,
  },
  {
    title: "Research catalog",
    description: "Browse records and their indexing status.",
    icon: Database,
  },
  {
    title: "Administration",
    description: "Access administrative tools according to your account role.",
    icon: ShieldCheck,
  },
];

export default function About() {
  return (
    <div className="min-h-screen bg-surface-container-low/60 p-6 lg:p-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <PageHeader eyebrow="Administrator console" title="About MonteSkolar" />
        <Card className="p-6 sm:p-8">
          <h2 className="text-xl font-semibold text-on-surface">
            Research and thesis repository
          </h2>
          <p className="mt-3 max-w-3xl leading-relaxed text-on-surface-variant">
            MonteSkolar supports the Colegio de Montalban research repository.
            This desktop console provides staff with tools for thesis records,
            schedules, announcements, and related administration.
          </p>
        </Card>
        <section aria-label="Console capabilities" className="grid gap-4 md:grid-cols-3">
          {responsibilities.map(({ title, description, icon: Icon }) => (
            <Card key={title} className="p-5">
              <Icon aria-hidden="true" className="h-6 w-6 text-primary" />
              <h3 className="mt-4 font-semibold text-on-surface">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
                {description}
              </p>
            </Card>
          ))}
        </section>
      </div>
    </div>
  );
}
