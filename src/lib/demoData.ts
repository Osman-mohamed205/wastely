import { writeBatch, collection, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { OperationalRecord } from '../types';

export const generateDemoData = async (userId: string, laborRate: number, energyTariff: number, industry: string) => {
  try {
    const batch = writeBatch(db);
    const recordsCollection = collection(db, 'records');
    
    const today = new Date();
    const departments = industry === 'Restaurant' ? ['Kitchen', 'Service', 'Bar'] : 
                       industry === 'Retail' ? ['Sales Floor', 'Stockroom', 'Checkout'] :
                       industry === 'Warehouse' ? ['Receiving', 'Storage', 'Shipping'] :
                       ['Production', 'Packaging', 'Assembly', 'Maintenance'];

    for (let i = 30; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const trendParam = (30 - i) * 0.05;

      departments.forEach(dept => {
        // Reduced activity on weekends
        const outputMultiplier = isWeekend ? 0.3 : 1;
        const baseOutput = Math.round((800 + Math.random() * 400 + trendParam * 10) * outputMultiplier);
        const laborRaw = Math.round((40 + Math.random() * 20 - trendParam) * outputMultiplier);
        const waitRaw = Math.round((30 + Math.random() * 60) * outputMultiplier);
        const downRaw = Math.round((15 + Math.random() * 30) * outputMultiplier);
        
        let multiplier = 1;
        if (industry === 'Restaurant') {
          multiplier = dept === 'Kitchen' ? 1.5 : 0.8;
        } else if (industry === 'Retail') {
          multiplier = dept === 'Sales Floor' ? 1.2 : 0.5;
        } else if (industry === 'Warehouse') {
          multiplier = dept === 'Shipping' ? 1.3 : 1;
        } else {
          multiplier = dept === 'Production' ? 1.8 : 1;
        }

        const outputUnits = Math.round(baseOutput * multiplier);
        const laborHours = Math.round(laborRaw * multiplier);
        const energyConsumption = Math.round((200 + Math.random() * 100) * outputUnits * 0.01 * multiplier);
        const waitingTime = Math.round(waitRaw * multiplier);
        const downtime = Math.round(downRaw * multiplier);
        const materialCost = Math.round((500 + Math.random() * 300) * outputUnits * 0.05 * multiplier);
        const miscCost = Math.round((50 + Math.random() * 100) * multiplier);
        const unplannedCost = Math.random() > 0.8 ? Math.round(500 + Math.random() * 1500) : 0; // occasional spikes

        const timeWaste = waitingTime + downtime;
        const energyCost = energyConsumption * energyTariff;
        const laborCost = laborHours * laborRate;
        const totalOperatingCost = energyCost + laborCost + materialCost + miscCost + unplannedCost;

        const recordRef = doc(recordsCollection);
        batch.set(recordRef, {
          userId,
          date: date.toISOString().split('T')[0],
          department: dept,
          outputUnits,
          laborHours,
          energyConsumption,
          waitingTime,
          downtime,
          materialCost,
          miscCost,
          unplannedCost,
          timeWaste,
          energyCost,
          laborCost,
          totalOperatingCost
        });
      });
    }

    // Add a few departments implicitly
    const deptsCollection = collection(db, 'departments');
    departments.forEach(dept => {
      const deptRef = doc(deptsCollection);
      batch.set(deptRef, {
        userId,
        name: dept,
        createdAt: today.toISOString()
      });
    });

    await batch.commit();
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'records');
    return false;
  }
};
