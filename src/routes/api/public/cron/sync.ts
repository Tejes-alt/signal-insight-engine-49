import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Background synchronization sweep. Called on a schedule; refreshes only the
 * connections whose next_sync_at has elapsed, so provider quota is respected.
 */
export const Route = createFileRoute("/api/public/cron/sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const { syncDueConnections } = await import("@/lib/services/social.server");
        try {
          const result = await syncDueConnections(25);
          console.info(`[cron] sync sweep`, result);
          return Response.json({ ok: true, ...result });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Sweep failed";
          console.error("[cron] sync sweep failed:", message);
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
