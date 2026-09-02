import React from "react";
import { Card } from "../Card"; // adjust if Card lives elsewhere

// ─── StatCard ────────────────────────────────────────────────────────────────

export interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: number | string;
  accent: string;
}

export function StatCard({ icon: Icon, label, value, accent }: StatCardProps) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accent}`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-semibold text-on-surface">{value}</p>
        <p className="text-sm text-on-surface-variant">{label}</p>
      </div>
    </Card>
  );
}

// ─── StatCardGrid ─────────────────────────────────────────────────────────────

export interface StatCardItem extends StatCardProps {
  /**
   * Used as the React key. Falls back to `label` if omitted,
   * which is fine as long as labels are unique within the grid.
   */
  id?: string;
}

export interface StatCardGridProps {
  stats: StatCardItem[];
  /**
   * Tailwind classes for the wrapping <section>.
   * Defaults to a responsive 1 → 2 → 4 column grid.
   */
  className?: string;
}

export function StatCardGrid({
  stats,
  className = "grid gap-4 sm:grid-cols-2 xl:grid-cols-4",
}: StatCardGridProps) {
  return (
    <section className={className}>
      {stats.map((stat) => (
        <StatCard
          key={stat.id ?? stat.label}
          icon={stat.icon}
          label={stat.label}
          value={stat.value}
          accent={stat.accent}
        />
      ))}
    </section>
  );
}