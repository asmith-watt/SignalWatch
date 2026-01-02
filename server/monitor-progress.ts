export interface MonitorProgress {
  isRunning: boolean;
  total: number;
  current: number;
  currentCompany: string | null;
  startedAt: Date | null;
  type: 'all' | 'industry' | 'company' | null;
  industryName?: string;
  signalsFound: number;
  stopRequested?: boolean;
}

let progress: MonitorProgress = {
  isRunning: false,
  total: 0,
  current: 0,
  currentCompany: null,
  startedAt: null,
  type: null,
  signalsFound: 0,
  stopRequested: false,
};

let stopRequested = false;

export function startMonitoring(total: number, type: 'all' | 'industry' | 'company', industryName?: string): void {
  stopRequested = false;
  progress = {
    isRunning: true,
    total,
    current: 0,
    currentCompany: null,
    startedAt: new Date(),
    type,
    industryName,
    signalsFound: 0,
    stopRequested: false,
  };
}

export function requestStop(): void {
  stopRequested = true;
  progress.stopRequested = true;
}

export function shouldStop(): boolean {
  return stopRequested;
}

export function updateProgress(current: number, currentCompany: string, signalsFound: number): void {
  progress.current = current;
  progress.currentCompany = currentCompany;
  progress.signalsFound = signalsFound;
}

export function finishMonitoring(): void {
  progress.isRunning = false;
  progress.currentCompany = null;
}

export function getProgress(): MonitorProgress {
  return { ...progress };
}
