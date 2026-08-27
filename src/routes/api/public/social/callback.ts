/**
 * The single OAuth return point for every platform.
 *
 * Public by necessity — the platform redirects the browser here without our
 * session cookie. Authorization is proven by the single-use `state` row created
 * when the user started the connection, not by the request itself.
 */

import { createFileRoute } from "@tanstack/react-router";

function redirectTo(url: string): Response {
  return new Response(null, { status: 302, headers: { Location: url } });
}

function withParams(base: string, params: Record<string, string>): string {
  try {
    const url = new URL(base);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return url.toString();
  } catch {
    return base;
  }
}

export const Route = createFileRoute("/api/public/social/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const origin = url.origin;
        const state = url.searchParams.get("state");
        const code = url.searchParams.get("code");
        const denied =
          url.searchParams.get("error_description") ??
          url.searchParams.get("error") ??
          (code ? null : "The platform did not return an authorization code.");

        if (!state) {
          return redirectTo(withParams(`${origin}/accounts`, { connect_error: "Missing authorization state." }));
        }

        const { consumeState, completeAuthorization } = await import("@/lib/social/oauth/flow.server");

        let consumed;
        try {
          consumed = await consumeState(state);
        } catch (error) {
          const message = error instanceof Error ? error.message : "Authorization failed.";
          return redirectTo(withParams(`${origin}/accounts`, { connect_error: message }));
        }

        const back = consumed.redirectTo.startsWith(origin) ? consumed.redirectTo : `${origin}/accounts`;

        if (denied || !code) {
          return redirectTo(
            withParams(back, {
              connect_error: denied ?? "Authorization was cancelled.",
              platform: consumed.platform,
            }),
          );
        }

        try {
          const result = await completeAuthorization({ state: consumed, code, origin });

          // First synchronization runs immediately so the dashboard has real
          // data by the time the user lands back on it.
          const { syncConnection, generateInsights, notify } = await import("@/lib/services/social.server");
          await notify(
            result.orgId,
            "account_connected",
            `${result.account.displayName ?? result.account.handle ?? result.platform} connected`,
            "Collecting your analytics now.",
            "success",
            { platform: result.platform },
          );
          await syncConnection(result.orgId, result.connectionId);
          try {
            await generateInsights(result.orgId, 30);
          } catch {
            // Insights are derived data; a failure never breaks the connection.
          }

          return redirectTo(withParams(back, { connected: result.platform }));
        } catch (error) {
          const message = error instanceof Error ? error.message : "The connection could not be completed.";
          return redirectTo(withParams(back, { connect_error: message, platform: consumed.platform }));
        }
      },
    },
  },
});
