import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SyncStatus {
  accountId: string;
  status: "pending" | "running" | "completed" | "failed";
  startedAt: string | null;
  completedAt: string | null;
  messagesSynced: number;
  errorMessage: string | null;
  updatedAt: string;
}

export function useSyncStatus(accountIds?: string[]) {
  const [syncStatuses, setSyncStatuses] = useState<Map<string, SyncStatus>>(new Map());

  useEffect(() => {
    // Fetch initial sync statuses for the accounts
    const fetchInitialStatuses = async () => {
      if (!accountIds || accountIds.length === 0) return;

      try {
        let query = supabase
          .from("sync_jobs")
          .select("*")
          .order("created_at", { ascending: false });

        if (accountIds) {
          query = query.in("account_id", accountIds);
        }

        const { data } = await query.limit(accountIds.length);

        if (data) {
          const statusMap = new Map<string, SyncStatus>();
          // Get the most recent sync job for each account
          data.forEach((job: any) => {
            if (!statusMap.has(job.account_id)) {
              statusMap.set(job.account_id, {
                accountId: job.account_id,
                status: job.status,
                startedAt: job.started_at,
                completedAt: job.completed_at,
                messagesSynced: job.messages_synced || 0,
                errorMessage: job.error_message,
                updatedAt: job.updated_at,
              });
            }
          });
          setSyncStatuses(statusMap);
        }
      } catch (err) {
        console.error("Error fetching sync statuses:", err);
      }
    };

    fetchInitialStatuses();

    // Subscribe to real-time sync_jobs changes
    const channel = supabase
      .channel("sync-status-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sync_jobs",
        },
        (payload) => {
          const job = payload.new as any;
          if (job && (!accountIds || accountIds.includes(job.account_id))) {
            setSyncStatuses((prev) => {
              const newMap = new Map(prev);
              newMap.set(job.account_id, {
                accountId: job.account_id,
                status: job.status,
                startedAt: job.started_at,
                completedAt: job.completed_at,
                messagesSynced: job.messages_synced || 0,
                errorMessage: job.error_message,
                updatedAt: job.updated_at,
              });
              return newMap;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [accountIds?.join(",")]);

  return syncStatuses;
}
