import { useToast } from '../ToastProvider';

export function useICalExport(orchestratorData) {
  const { toast } = useToast();

  const exportToICal = () => {
    if (!orchestratorData?.tachesDuJour?.length) { toast.info("Aucune t\u00e2che \u00e0 exporter."); return; }
    const formatLocalICSDate = (date) => {
      const y = date.getFullYear();
      const mo = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      const h = String(date.getHours()).padStart(2, '0');
      const mi = String(date.getMinutes()).padStart(2, '0');
      const s = String(date.getSeconds()).padStart(2, '0');
      return `${y}${mo}${d}T${h}${mi}${s}`;
    };
    let icsContent = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//ELPIS//Planning//FR\r\nCALSCALE:GREGORIAN\r\nMETHOD:PUBLISH\r\n";
    let currentBlockStart = new Date(); currentBlockStart.setHours(8, 0, 0, 0);
    orchestratorData.tachesDuJour.forEach((tache, index) => {
      const durationMin = typeof tache.dureeEstimee === 'number' ? tache.dureeEstimee : parseInt(tache.dureeEstimee) || 30;
      const endBlock = new Date(currentBlockStart.getTime() + durationMin * 60000);
      const title = tache.type === 'ANKI' ? 'R\u00e9visions (Anki)' : `[${tache.type}] ${tache.titre || 'T\u00e2che'}`;
      icsContent += `BEGIN:VEVENT\r\nUID:${Date.now()}-${index}@elpis.app\r\nDTSTAMP:${formatLocalICSDate(new Date())}\r\nDTSTART;TZID=Europe/Paris:${formatLocalICSDate(currentBlockStart)}\r\nDTEND;TZID=Europe/Paris:${formatLocalICSDate(endBlock)}\r\nSUMMARY:${title}\r\nEND:VEVENT\r\n`;
      currentBlockStart = new Date(endBlock.getTime() + 5 * 60000);
    });
    icsContent += "END:VCALENDAR";
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `elpis_planning_${new Date().toISOString().split('T')[0]}.ics`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
  };

  return { exportToICal };
}
