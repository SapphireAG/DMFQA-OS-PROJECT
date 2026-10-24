/**
 * CPU discrete-event engine: the Review 1 C11 rules on a single CPU, no I/O, zero switch
 * time, 1 ms ticks (inputs are whole milliseconds, so ticking is exact).
 *
 * ASSUMPTION (flag for the team): a context switch is counted whenever the CPU passes
 * from one process to a different one without going idle in between. Swap this for the
 * C11 definition and add a parity test once the C11 trace JSON is supplied.
 */
import { quantumFor } from './quantum';
import { max, mean } from './metrics';
import {
  POLICY_FLAGS,
  type CPUConfig,
  type CPUMark,
  type CPUProcess,
  type CPURun,
  type GanttSeg,
  type Level,
  type Policy,
} from './types';

export const DEFAULT_CPU: CPUConfig = {
  quanta: [4, 8, 16],
  ref: 8,
  aging: [0, 24, 48],
};

export const CPU_PRESETS: Record<string, CPUProcess[]> = {
  Textbook: [
    { pid: 'P1', arrival: 0, burst: 24 },
    { pid: 'P2', arrival: 2, burst: 6 },
    { pid: 'P3', arrival: 4, burst: 40 },
    { pid: 'P4', arrival: 6, burst: 3 },
    { pid: 'P5', arrival: 10, burst: 12 },
    { pid: 'P6', arrival: 14, burst: 2 },
  ],
  'Heavy CPU': [
    { pid: 'P1', arrival: 0, burst: 90 },
    { pid: 'P2', arrival: 0, burst: 70 },
    { pid: 'P3', arrival: 5, burst: 60 },
    { pid: 'P4', arrival: 10, burst: 4 },
    { pid: 'P5', arrival: 20, burst: 50 },
    { pid: 'P6', arrival: 30, burst: 3 },
    { pid: 'P7', arrival: 40, burst: 80 },
  ],
  Bursty: [
    { pid: 'P1', arrival: 0, burst: 60 },
    { pid: 'P2', arrival: 0, burst: 45 },
    { pid: 'P3', arrival: 12, burst: 3 },
    { pid: 'P4', arrival: 12, burst: 5 },
    { pid: 'P5', arrival: 13, burst: 2 },
    { pid: 'P6', arrival: 13, burst: 4 },
    { pid: 'P7', arrival: 40, burst: 3 },
    { pid: 'P8', arrival: 41, burst: 6 },
    { pid: 'P9', arrival: 41, burst: 2 },
    { pid: 'P10', arrival: 42, burst: 5 },
    { pid: 'P11', arrival: 70, burst: 30 },
  ],
};

export function simulateCPU(cfg: CPUConfig, policy: Policy, procs: CPUProcess[]): CPURun {
  const { dynamic, aging } = POLICY_FLAGS[policy];
  // stable arrival order; ties keep table order
  const P = procs
    .map((p, k) => ({ ...p, k }))
    .sort((a, b) => a.arrival - b.arrival || a.k - b.k);
  const n = P.length;

  const level = new Int8Array(n);
  const seq = new Float64Array(n);
  const qLeft = new Float64Array(n);
  const ageStart = new Float64Array(n);
  const waitStart = new Float64Array(n);
  const maxWait = new Float64Array(n);
  const remaining = P.map((p) => p.burst);
  const firstRun = new Array<number>(n).fill(NaN);
  const finish = new Array<number>(n).fill(NaN);

  const ready: number[] = [];
  const segments: GanttSeg[] = [];
  const marks: CPUMark[] = [];
  let seqCtr = 0;
  let next = 0;
  let done = 0;
  let cur = -1; // process holding the CPU
  let prevRan = -1; // process that ran in the previous tick (-1 if idle)
  let switches = 0;
  let t = 0;
  const guard = P.reduce((s, p) => Math.max(s, p.arrival), 0) + P.reduce((s, p) => s + p.burst, 0) + 1;

  const best = () => {
    let b = -1;
    for (const i of ready) if (b === -1 || level[i] < level[b] || (level[i] === level[b] && seq[i] < seq[b])) b = i;
    return b;
  };

  while (done < n && t <= guard) {
    while (next < n && P[next].arrival <= t) {
      const i = next++;
      level[i] = 0;
      seq[i] = seqCtr++;
      qLeft[i] = cfg.quanta[0];
      ageStart[i] = t;
      waitStart[i] = t;
      ready.push(i);
    }

    if (aging) {
      for (const i of ready) {
        if (level[i] === 0 || t - ageStart[i] < cfg.aging[level[i]]) continue;
        const L = level[i] - 1;
        level[i] = L;
        qLeft[i] = quantumFor(L, cfg.quanta, dynamic, ready.length - 1, cfg.ref);
        ageStart[i] = t;
        seq[i] = seqCtr++;
        marks.push({ t, pid: P[i].pid, kind: 'promote' });
      }
    }

    // preemption by a strictly higher-priority ready process; remaining quantum is kept
    const b = best();
    if (cur !== -1 && b !== -1 && level[b] < level[cur]) {
      ready.push(cur);
      waitStart[cur] = t;
      marks.push({ t, pid: P[cur].pid, kind: 'preempt' });
      cur = -1;
    }
    if (cur === -1) {
      const pick = best();
      if (pick !== -1) {
        ready.splice(ready.indexOf(pick), 1);
        cur = pick;
        maxWait[cur] = Math.max(maxWait[cur], t - waitStart[cur]);
        if (Number.isNaN(firstRun[cur])) firstRun[cur] = t;
      }
    }

    if (cur === -1) {
      prevRan = -1;
      t = next < n ? P[next].arrival : t + 1;
      continue;
    }

    if (prevRan !== -1 && prevRan !== cur) switches++;
    const last = segments[segments.length - 1];
    if (last && last.pid === P[cur].pid && last.end === t && last.level === level[cur]) last.end = t + 1;
    else segments.push({ pid: P[cur].pid, start: t, end: t + 1, level: level[cur] as Level });

    remaining[cur]--;
    qLeft[cur]--;
    prevRan = cur;
    t += 1;
    ageStart[cur] = t;

    if (remaining[cur] === 0) {
      finish[cur] = t;
      done++;
      cur = -1;
    } else if (qLeft[cur] <= 0) {
      const L = Math.min(level[cur] + 1, 2);
      level[cur] = L;
      seq[cur] = seqCtr++;
      qLeft[cur] = quantumFor(L, cfg.quanta, dynamic, ready.length, cfg.ref);
      ready.push(cur);
      waitStart[cur] = t;
      cur = -1;
    }
  }

  const perProcess = P.map((p, i) => ({
    pid: p.pid,
    turnaround: finish[i] - p.arrival,
    waiting: finish[i] - p.arrival - p.burst,
    response: firstRun[i] - p.arrival,
    maxReadyWait: maxWait[i],
  }));
  return {
    summary: {
      policy,
      avgWaiting: mean(perProcess.map((m) => m.waiting)),
      avgTurnaround: mean(perProcess.map((m) => m.turnaround)),
      avgResponse: mean(perProcess.map((m) => m.response)),
      maxReadyWait: max(perProcess.map((m) => m.maxReadyWait)),
      switches,
    },
    segments,
    marks,
    perProcess,
  };
}
