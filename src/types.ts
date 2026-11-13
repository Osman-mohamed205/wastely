export interface UserSettings {
  email: string;
  workspaceName?: string;
  energyTariff: number; // RM per kWh
  laborRate: number; // RM per hour
  machineRate?: number; // RM per hour machine downtime cost
  targetWasteIndex?: number; // % benchmark target
  industry?: string;
  theme?: 'light' | 'dark' | 'blue' | 'burgundy';
}

export interface Department {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
}

export interface Optimization {
  id: string;
  title: string;
  impacts: {
    materialCostMultiplier: number;
    unplannedCostMultiplier: number;
    downtimeMultiplier: number;
    laborHoursMultiplier: number;
    energyConsumptionMultiplier: number;
  };
}

export interface OperationalRecord {
  id?: string;
  userId: string;
  date: string;
  department: string;
  outputUnits: number;
  laborHours: number;
  energyConsumption: number; // kWh
  waitingTime: number; // minutes
  downtime: number; // minutes
  materialCost: number; // RM
  miscCost: number; // RM
  unplannedCost: number; // RM
  
  // Calculated fields
  timeWaste?: number; // minutes
  energyCost?: number; // RM
  laborCost?: number; // RM
  totalOperatingCost?: number; // RM
  wasteIndex?: number; // ratio
}

export type View = 'dashboard' | 'input' | 'analytics' | 'reports' | 'settings' | 'profile' | 'departments' | 'forecasting';
