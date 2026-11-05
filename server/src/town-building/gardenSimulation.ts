import { Worker } from 'node:worker_threads';
import { AppError } from '../errors.js';
import type { TownState } from './game.js';
import type { GardenEnvironment } from './garden.js';
import type { GardenWork, GardenResult } from './gardenWorker.js';
import type { MapId } from './maps/types.js';

export type GardenSimulation = (state: TownState, mapId: MapId, now: number, environment: GardenEnvironment, resume: boolean) => Promise<TownState>;
interface Job {
    work: GardenWork;
    resolve: (state: TownState) => void;
    reject: (error: AppError) => void;
    timer: ReturnType<typeof setTimeout>;
}
interface Slot { worker: Worker; job: Job | null; stopping: boolean }
const unavailable = () => new AppError(503, 'GARDEN_UNAVAILABLE', 'Gardening is temporarily unavailable. Your saved progress is safe.');

/** One CPU worker per API process, with bounded admission and an end-to-end
 * deadline. Never fall back to synchronous simulation after an overload/error.
 */
export class GardenWorkerPool {
    private queue: Job[] = [];
    private slot: Slot | null = null;
    private closed = false;
    constructor(private options: { maxJobs?: number; timeoutMs?: number; workerUrl?: URL } = {}) {}

    run(state: TownState, mapId: MapId, now: number, environment: GardenEnvironment, resume: boolean): Promise<TownState> {
        if (this.closed) return Promise.reject(unavailable());
        if (this.queue.length + (this.slot?.job ? 1 : 0) >= (this.options.maxJobs ?? 8)) {
            return Promise.reject(new AppError(503, 'GARDEN_BUSY', 'Gardening is busy. Try again shortly.'));
        }
        return new Promise((resolve, reject) => {
            const job: Job = { work: { state, mapId, now, environment, resume }, resolve, reject,
                timer: setTimeout(() => this.expire(job), this.options.timeoutMs ?? 10000) };
            this.queue.push(job);
            this.pump();
        });
    }

    private pump(): void {
        if (this.closed || !this.queue.length || this.slot?.job || this.slot?.stopping) return;
        if (!this.slot) {
            try {
                const source = import.meta.url.endsWith('.ts');
                const worker = new Worker(this.options.workerUrl ?? new URL(source ? './gardenWorker.ts' : './gardenWorker.js', import.meta.url), {
                    // Do not inherit watch/test flags or database/bootstrap preloads.
                    execArgv: source ? ['--import', import.meta.resolve('tsx')] : [],
                    resourceLimits: { maxOldGenerationSizeMb: 128, stackSizeMb: 4 },
                    name: 'town-garden',
                });
                const slot: Slot = { worker, job: null, stopping: false };
                this.slot = slot;
                worker.on('message', (result: GardenResult) => {
                    const job = slot.job;
                    if (!job || slot.stopping) return;
                    slot.job = null;
                    clearTimeout(job.timer);
                    if (result.ok) job.resolve(result.state); else job.reject(unavailable());
                    worker.unref();
                    this.pump();
                });
                worker.on('error', () => this.retire(slot));
                worker.on('exit', () => {
                    if (slot.job) { clearTimeout(slot.job.timer); slot.job.reject(unavailable()); }
                    if (this.slot === slot) this.slot = null;
                    this.pump();
                });
                worker.unref();
            } catch {
                for (const job of this.queue.splice(0)) { clearTimeout(job.timer); job.reject(unavailable()); }
                return;
            }
        }
        const slot = this.slot, job = this.queue.shift()!;
        slot.job = job;
        slot.worker.ref();
        try { slot.worker.postMessage(job.work); }
        catch { this.retire(slot); }
    }

    private expire(job: Job): void {
        if (this.slot?.job === job) this.retire(this.slot);
        else {
            const index = this.queue.indexOf(job);
            if (index >= 0) { this.queue.splice(index, 1); job.reject(unavailable()); }
        }
    }
    private retire(slot: Slot): void {
        if (slot.stopping) return;
        slot.stopping = true;
        if (slot.job) { clearTimeout(slot.job.timer); slot.job.reject(unavailable()); slot.job = null; }
        void slot.worker.terminate();
    }
    async close(): Promise<void> {
        this.closed = true;
        for (const job of this.queue.splice(0)) { clearTimeout(job.timer); job.reject(unavailable()); }
        if (this.slot) {
            const slot = this.slot;
            this.retire(slot);
            await slot.worker.terminate();
        }
    }
}

// Lazily starts the single shared worker, even when several repositories exist.
const gardenWorkers = new GardenWorkerPool();
export const simulateGarden: GardenSimulation = (state, mapId, now, environment, resume) => gardenWorkers.run(state, mapId, now, environment, resume);
