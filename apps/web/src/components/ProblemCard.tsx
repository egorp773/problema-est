"use client";

import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { labelStatus } from "@/lib/format";
import type { Problem } from "@problema-est/shared";

export function ProblemCard({ problem }: { problem: Problem }) {
  return (
    <article className="rounded-lg border border-line bg-white p-4 shadow-soft">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold leading-snug text-ink">{problem.title}</h3>
          <p className="mt-1 flex items-center gap-1 text-sm text-muted">
            <MapPin className="h-4 w-4" />
            {problem.city}, {problem.address}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-brand">
          {labelStatus(problem.status)}
        </span>
      </div>

      <div className="mb-3 flex flex-wrap gap-2 text-sm">
        <span className="rounded-md bg-slate-100 px-2 py-1">{problem.category}</span>
        <span className="rounded-md bg-slate-100 px-2 py-1">{problem.confirmations_count} подтверждений</span>
      </div>

      <p className="line-clamp-3 text-sm leading-6 text-slate-700">{problem.clean_description}</p>

      <Link
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-3 font-semibold text-white transition hover:bg-brandDark"
        href={`/problems/${problem.id}`}
      >
        Открыть <ArrowRight className="h-5 w-5" />
      </Link>
    </article>
  );
}
