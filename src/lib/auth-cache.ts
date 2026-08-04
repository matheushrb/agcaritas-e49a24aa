// Lightweight in-memory cache to avoid re-querying the profile on every
// navigation inside the authenticated area.
const onboardedUsers = new Set<string>();

export function isOnboardedCached(userId: string) {
  return onboardedUsers.has(userId);
}

export function markOnboarded(userId: string) {
  onboardedUsers.add(userId);
}

export function clearAuthCache() {
  onboardedUsers.clear();
}
