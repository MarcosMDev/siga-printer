import type { PrintResult } from '../types';
import type { ConnectedThermalPrinter } from '../builder/ThermalPrinter';

// ─────────────────────────────────────────────────────────────
//  PrintQueue
//
//  Manages a FIFO queue of print jobs with:
//    - Automatic retry on failure (configurable)
//    - Job status tracking
//    - Pause / resume
//    - Event callbacks
//
//  Usage:
//    const queue = new PrintQueue(printer, { maxRetries: 3 });
//
//    queue.onStatusChange = (job) => console.log(job.status);
//
//    queue.add(async (p) => {
//      await p.init().text('Recibo #001').cut().print();
//    });
// ─────────────────────────────────────────────────────────────

export type JobFn = (printer: ConnectedThermalPrinter) => Promise<PrintResult>;

export interface QueuedJob {
  id:        string;
  fn:        JobFn;
  status:    'pending' | 'printing' | 'done' | 'error' | 'cancelled';
  retries:   number;
  error?:    string;
  result?:   PrintResult;
  addedAt:   Date;
  startedAt? : Date;
  finishedAt?: Date;
}

export interface PrintQueueOptions {
  maxRetries?:    number;  // default: 2
  retryDelayMs?:  number;  // default: 1500
  /** Process next job automatically (default: true) */
  autoProcess?:   boolean;
}

export class PrintQueue {
  private printer:      ConnectedThermalPrinter;
  private queue:        QueuedJob[] = [];
  private processing  = false;
  private paused      = false;
  private opts:         Required<PrintQueueOptions>;

  onJobStatusChange?: (job: QueuedJob) => void;
  onQueueEmpty?:      () => void;
  onError?:           (job: QueuedJob, error: Error) => void;

  constructor(printer: ConnectedThermalPrinter, opts: PrintQueueOptions = {}) {
    this.printer = printer;
    this.opts = {
      maxRetries:   opts.maxRetries   ?? 2,
      retryDelayMs: opts.retryDelayMs ?? 1500,
      autoProcess:  opts.autoProcess  ?? true,
    };
  }

  // ── Public API ───────────────────────────────────────────────

  /** Add a job to the queue. Returns the job ID. */
  add(fn: JobFn): string {
    const job: QueuedJob = {
      id:      `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      fn,
      status:  'pending',
      retries: 0,
      addedAt: new Date(),
    };

    this.queue.push(job);
    this._emit(job);

    if (this.opts.autoProcess && !this.processing && !this.paused) {
      this._processNext();
    }

    return job.id;
  }

  /** Cancel a pending job by ID. */
  cancel(jobId: string): boolean {
    const job = this.queue.find(j => j.id === jobId && j.status === 'pending');
    if (!job) return false;
    job.status = 'cancelled';
    this._emit(job);
    return true;
  }

  /** Pause processing after the current job finishes. */
  pause(): void {
    this.paused = true;
  }

  /** Resume processing. */
  resume(): void {
    this.paused = false;
    if (!this.processing) {
      this._processNext();
    }
  }

  /** Clear all pending jobs (does not cancel running job). */
  clear(): void {
    this.queue
      .filter(j => j.status === 'pending')
      .forEach(j => { j.status = 'cancelled'; this._emit(j); });
    this.queue = this.queue.filter(j => j.status !== 'pending');
  }

  get pending():  number { return this.queue.filter(j => j.status === 'pending').length;  }
  get done():     number { return this.queue.filter(j => j.status === 'done').length;     }
  get failed():   number { return this.queue.filter(j => j.status === 'error').length;    }
  get isRunning(): boolean { return this.processing; }
  get isPaused():  boolean { return this.paused; }

  /** All jobs (full history). */
  get jobs(): ReadonlyArray<QueuedJob> { return this.queue; }

  // ── Internal ─────────────────────────────────────────────────

  private async _processNext(): Promise<void> {
    if (this.paused) return;

    const job = this.queue.find(j => j.status === 'pending');
    if (!job) {
      this.processing = false;
      this.onQueueEmpty?.();
      return;
    }

    this.processing  = true;
    job.status       = 'printing';
    job.startedAt    = new Date();
    this._emit(job);

    try {
      job.result       = await job.fn(this.printer);
      job.status       = 'done';
      job.finishedAt   = new Date();
      this._emit(job);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      if (job.retries < this.opts.maxRetries) {
        job.retries++;
        job.status = 'pending'; // requeue
        this._emit(job);
        await this._delay(this.opts.retryDelayMs);
      } else {
        job.status     = 'error';
        job.error      = error.message;
        job.finishedAt = new Date();
        this._emit(job);
        this.onError?.(job, error);
      }
    }

    this.processing = false;
    this._processNext();
  }

  private _emit(job: QueuedJob): void {
    this.onJobStatusChange?.(job);
  }

  private _delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
