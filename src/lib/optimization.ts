import { OperationalRecord, Optimization, UserSettings } from '../types';

export function applyOptimizations(records: OperationalRecord[], optimization: Optimization | null, settings: UserSettings | null): OperationalRecord[] {
  if (!optimization || !settings) return records;

  return records.map(r => {
    // Clone record to avoid mutation
    const modified = { ...r };

    if (optimization.impacts.materialCostMultiplier !== 1) {
      modified.materialCost = modified.materialCost * optimization.impacts.materialCostMultiplier;
    }
    if (optimization.impacts.unplannedCostMultiplier !== 1) {
      modified.unplannedCost = modified.unplannedCost * optimization.impacts.unplannedCostMultiplier;
    }
    if (optimization.impacts.downtimeMultiplier !== 1) {
      modified.downtime = modified.downtime * optimization.impacts.downtimeMultiplier;
      modified.timeWaste = modified.waitingTime + modified.downtime;
    }
    if (optimization.impacts.laborHoursMultiplier !== 1) {
      modified.laborHours = modified.laborHours * optimization.impacts.laborHoursMultiplier;
    }
    if (optimization.impacts.energyConsumptionMultiplier !== 1) {
      modified.energyConsumption = modified.energyConsumption * optimization.impacts.energyConsumptionMultiplier;
    }

    // Re-calculate totals 
    const laborCost = modified.laborHours * settings.laborRate;
    const energyCost = modified.energyConsumption * settings.energyTariff;
    modified.laborCost = laborCost;
    modified.energyCost = energyCost;
    modified.totalOperatingCost = laborCost + energyCost + modified.materialCost + modified.miscCost + modified.unplannedCost;

    return modified;
  });
}
