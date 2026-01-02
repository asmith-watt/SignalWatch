export interface MonitorProgress {
  isRunning: boolean;
  total: number;
  current: number;
  currentCompany: string | null;
  startedAt: Date | null;
  type: 'all' | 'industry' | 'company' | null;
  industryName?: string;
  signalsFound: number;
}

let progress: MonitorProgress = {
  isRunning: false,
  total: 0,
  current: 0,
  currentCompany: null,
  startedAt: null,
  type: null,
  signalsFound: 0,
};

export function startMonitoring(total: number, type: 'all' | 'industry' | 'company', industryName?: string): void {
  progress = {
    isRunning: true,
    total,
    current: 0,
    currentCompany: null,
    startedAt: new Date(),
    type,
    industryName,
    signalsFound: 0,
  };
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
