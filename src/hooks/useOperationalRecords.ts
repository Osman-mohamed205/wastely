import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { OperationalRecord } from '../types';
import { useAuth } from '../App';
import { applyOptimizations } from '../lib/optimization';

export function useOperationalRecords() {
  const { user, settings, activeOptimization } = useAuth();
  const [rawRecords, setRawRecords] = useState<OperationalRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRawRecords([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'records'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as OperationalRecord));
      // Sort by date desc
      data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setRawRecords(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'records');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const records = useMemo(() => {
    return applyOptimizations(rawRecords, activeOptimization, settings);
  }, [rawRecords, activeOptimization, settings]);

  return { records, loading, rawRecords };
}
