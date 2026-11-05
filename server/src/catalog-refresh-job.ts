import { randomUUID } from "node:crypto";

import { safeLogger, type Logger } from "./logger.js";

export type CatalogRefreshJobStatus = "queued" | "running" | "completed" | "failed";

export interface CatalogRefreshProgress {
  total_batches: number;
  completed_batches: number;
  updated_count: number;
  skipped_count: number;
}

export interface CatalogRefreshResult {
  updated_count: number;
  skipped_count: number;
  batches: number;
}

export interface CatalogRefreshJob {
  job_id: string;
  status: CatalogRefreshJobStatus;
  total_batches: number | null;
  completed_batches: number;
  updated_count: number;
  skipped_count: number;
  batches: number;
  error?: string;
}

export interface CatalogRefreshJobOptions {
  research?: boolean;
  onProgress?(progress: CatalogRefreshProgress): void;
}

type Refresh = (options?: CatalogRefreshJobOptions) => Promise<CatalogRefreshResult>;

interface MutableJob extends CatalogRefreshJob {
  error?: string;
}

export class CatalogRefreshJobManager {
  private activeJob: MutableJob | undefined;

  constructor(private readonly logger: Logger = safeLogger) {}

  start(refresh: Refresh): CatalogRefreshJob {
    if (this.activeJob && (this.activeJob.status === "queued" || this.activeJob.status === "running")) {
      return this.snapshot(this.activeJob);
    }

    const job: MutableJob = {
      job_id: randomUUID(),
      status: "queued",
      total_batches: null,
      completed_batches: 0,
      updated_count: 0,
      skipped_count: 0,
      batches: 0,
    };
    this.activeJob = job;
    void this.run(job, refresh);
    return this.snapshot(job);
  }

  current(): CatalogRefreshJob | null {
    return this.activeJob ? this.snapshot(this.activeJob) : null;
  }

  private async run(job: MutableJob, refresh: Refresh): Promise<void> {
    job.status = "running";
    try {
      const result = await refresh({
        onProgress: (progress) => {
          job.total_batches = progress.total_batches;
          job.completed_batches = progress.completed_batches;
          job.updated_count = progress.updated_count;
          job.skipped_count = progress.skipped_count;
        },
      });
      job.status = "completed";
      job.updated_count = result.updated_count;
      job.skipped_count = result.skipped_count;
      job.batches = result.batches;
      if (job.total_batches !== null) job.completed_batches = job.total_batches;
    } catch (caught) {
      job.status = "failed";
      job.error = "Catalog refresh failed.";
      this.logger.error("catalog refresh failed", {
        code: "CATALOG_REFRESH_FAILED",
        ...(caught instanceof Error && caught.stack ? { stack: caught.stack } : {}),
      });
    }
  }

  private snapshot(job: MutableJob): CatalogRefreshJob {
    return { ...job };
  }
}
