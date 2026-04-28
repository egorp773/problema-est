const createdKey = "problema_est_created_problem_ids";
const confirmedKey = "problema_est_confirmed_problem_ids";
const followedKey = "problema_est_followed_problem_ids";
const ownCommentsKey = "problema_est_own_comment_ids";

function readList(key: string) {
  if (typeof window === "undefined") return [];

  try {
    const value = window.localStorage.getItem(key);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function writeList(key: string, ids: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(Array.from(new Set(ids)).slice(0, 200)));
}

function addToList(key: string, id: string) {
  const cleanId = id.trim();
  if (!cleanId) return;
  writeList(key, [cleanId, ...readList(key)]);
}

function removeFromList(key: string, id: string) {
  const cleanId = id.trim();
  if (!cleanId) return;
  writeList(key, readList(key).filter((item) => item !== cleanId));
}

function scanLegacy(prefix: string) {
  if (typeof window === "undefined") return [];

  const ids: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key?.startsWith(prefix) && window.localStorage.getItem(key) === "1") {
      ids.push(key.slice(prefix.length));
    }
  }

  return ids;
}

export function rememberCreatedProblem(id: string) {
  addToList(createdKey, id);
}

export function rememberConfirmedProblem(id: string) {
  addToList(confirmedKey, id);
  window.localStorage.setItem(`problem_confirmed_${id}`, "1");
}

export function forgetConfirmedProblem(id: string) {
  removeFromList(confirmedKey, id);
  window.localStorage.removeItem(`problem_confirmed_${id}`);
}

export function rememberFollowedProblem(id: string) {
  addToList(followedKey, id);
  window.localStorage.setItem(`problem_subscribed_${id}`, "1");
}

export function forgetFollowedProblem(id: string) {
  removeFromList(followedKey, id);
  window.localStorage.removeItem(`problem_subscribed_${id}`);
}

export function rememberOwnComment(id: string) {
  addToList(ownCommentsKey, id);
}

export function forgetOwnComment(id: string) {
  removeFromList(ownCommentsKey, id);
}

export function isOwnCommentLocally(id: string) {
  return readList(ownCommentsKey).includes(id);
}

export function listCreatedProblemIds() {
  return readList(createdKey);
}

export function listConfirmedProblemIds() {
  return Array.from(new Set([...readList(confirmedKey), ...scanLegacy("problem_confirmed_")]));
}

export function listFollowedProblemIds() {
  return Array.from(new Set([...readList(followedKey), ...scanLegacy("problem_subscribed_")]));
}

export function isConfirmedLocally(id: string) {
  return listConfirmedProblemIds().includes(id);
}

export function isFollowedLocally(id: string) {
  return listFollowedProblemIds().includes(id);
}
