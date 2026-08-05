/**
 * Deep links into PostHog People / Session Replay for Mandi admin.
 * Customers never see this — admin-only tooling.
 */
export function getPostHogHost() {
  const raw =
    process.env.NEXT_PUBLIC_POSTHOG_HOST ||
    process.env.EXPO_PUBLIC_POSTHOG_HOST ||
    'https://us.posthog.com';
  return raw.replace(/\/$/, '').replace('i.posthog.com', 'posthog.com');
}

export function getPostHogProjectId() {
  return (
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_ID ||
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT ||
    // MandiPlus customer-app PostHog project (from setup wizard dashboards).
    '501782'
  ).trim();
}

/** Person profile (events + Recordings tab). distinct_id === Mandi user id. */
export function postHogPersonUrl(userId: string) {
  const projectId = getPostHogProjectId();
  const id = String(userId || '').trim();
  if (!projectId || !id) return null;
  return `${getPostHogHost()}/project/${projectId}/person/${encodeURIComponent(id)}`;
}

/** Prefer Recordings tab when PostHog supports the hash; otherwise person page. */
export function postHogSessionRecordingsUrl(userId: string) {
  const personUrl = postHogPersonUrl(userId);
  if (!personUrl) return null;
  return `${personUrl}#activeTab=sessionRecordings`;
}
