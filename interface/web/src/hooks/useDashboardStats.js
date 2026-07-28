import { useMemo } from 'react';
import useStore from '../store';

/**
 * Hook pour les statistiques du Dashboard.
 * Calcule la progression globale, par matière, et les jours de repos.
 */
export function useDashboardStats() {
  const { coursConfig, config } = useStore();

  const getTodayStr = () => {
    const d = new Date();
    d.setHours(d.getHours() - 4);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };

  const getRestDaysUsed = () => {
    if (!config?.restDays) return 0;
    const now = new Date();
    now.setHours(now.getHours() - 4);
    const dayOfWeek = now.getDay() || 7;
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - dayOfWeek + 1);
    startOfWeek.setHours(0, 0, 0, 0);
    return config.restDays.filter(d => {
      const date = new Date(d + 'T00:00:00');
      return date >= startOfWeek;
    }).length;
  };

  const allMatieres = useMemo(() => {
    const list = [];
    if (!coursConfig) return list;
    coursConfig.licences?.forEach(l => {
      l.semestres?.forEach(s => {
        s.ues?.forEach(u => {
          u.matieres?.forEach(m => list.push(m.nom));
        });
      });
    });
    return list;
  }, [coursConfig]);

  const stats = useMemo(() => {
    if (!coursConfig) return { total: 0, done: 0, perMatiere: [] };
    let total = 0, done = 0;
    const perMatiere = [];

    coursConfig.licences?.forEach(l => {
      l.semestres?.forEach(s => {
        s.ues?.forEach(u => {
          u.matieres?.forEach(m => {
            if (m.dispense) return;
            let mTotal = 0, mDone = 0;
            if (m.listeCM) { mTotal += m.listeCM.length; mDone += m.listeCM.filter(cm => cm.jActuel > 0).length; }
            if (m.listeTD) { mTotal += m.listeTD.length; mDone += m.listeTD.filter(td => td.nombrePratiques > 0).length; }
            if (m.listeTP) { mTotal += m.listeTP.length; mDone += m.listeTP.filter(tp => tp.nombrePratiques > 0).length; }
            if (m.listeAnnales) { mTotal += m.listeAnnales.length; mDone += m.listeAnnales.filter(a => a.nombrePratiques > 0).length; }
            total += mTotal; done += mDone;
            if (mTotal > 0) perMatiere.push({ nom: m.nom, total: mTotal, done: mDone, percent: Math.round((mDone / mTotal) * 100) });
          });
        });
      });
    });
    return { total, done, perMatiere };
  }, [coursConfig]);

  const globalPercent = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;

  const todayStr = getTodayStr();
  const restDaysUsed = getRestDaysUsed();
  const isRestDayToday = config?.restDays?.includes(todayStr);

  return { stats, globalPercent, allMatieres, restDaysUsed, todayStr, isRestDayToday, getTodayStr };
}
