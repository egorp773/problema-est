import { statusLabel, type ProblemStatus } from "@problema-est/shared";

export function labelStatus(status: ProblemStatus | string) {
  return statusLabel[status as ProblemStatus] ?? status;
}

export function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}
