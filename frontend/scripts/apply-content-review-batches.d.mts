export function applyContentReviewBatches(options?: {
  dataDir?: string;
  batchDir?: string;
  write?: boolean;
}): Promise<{ batch_files: number; patches: number; updated: number; write: boolean }>;
