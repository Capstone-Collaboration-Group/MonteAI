import type { ThesisResponseDto } from "@monteai/types";
import {LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,} from "recharts";

interface SubmissionHealthCardProps {
  theses: ThesisResponseDto[];
}

export function SubmissionHealthCard({ theses }: SubmissionHealthCardProps) {
  const indexedTheses = theses.filter((thesis) => thesis.status === "Indexed" && thesis.indexedAt);

  const yearlyCounts = indexedTheses.reduce<Record<number, number>>(
    (counts, thesis) => {
      const year = new Date(thesis.indexedAt!).getFullYear();
      counts[year] = (counts[year] ?? 0) + 1;
      return counts;
    },
    {}
  );

  const yearlyData = Object.entries(yearlyCounts)
    .map(([year, count]) => ({
      year,
      count,
    }))
    .sort((a, b) => Number(a.year) - Number(b.year));

  const approvalRate =
    theses.length > 0
      ? Math.round((indexedTheses.length / theses.length) * 100)
      : 0;

  return (
    <div className="flex h-full flex-col rounded-2xl bg-primary p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-on-primary/60">
        Submission Health
      </p>

      <p className="mt-3 font-serif text-4xl font-semibold leading-none text-on-primary">
        {approvalRate}%
        <span className="ml-2 align-middle text-base font-sans font-normal text-on-primary/75">
          Approval
        </span>
      </p>

      <p className="mt-3 text-sm leading-relaxed text-on-primary/75">
        Based on indexed theses in the repository.
      </p>

      <div className="mt-auto h-40 pt-6">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={yearlyData}>
            <XAxis
              dataKey="year"
              tick={{ fontSize: 10 }}
              stroke="currentColor"
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 10 }}
              stroke="currentColor"
            />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="count"
              stroke="currentColor"
              strokeWidth={2}
              dot
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
