import { useMemo } from 'react';
import { useToast } from './ToastProvider';
import useStore from './store';
import { getRawIp, setApiUrl } from './utils/apiConfig';
import { getDb, syncFromBackend } from './database';

function ConfigPage() {
  const { config, coursConfig, setConfig } = useStore();
  const { addToast } = useToast();

  // Profile summary
  const profileSummary = useMemo(() => {
    if (!coursConfig) return { semestres: 0, ues: 0, matieres: 0, cm: 0, td: 0, tp: 0 };
    let ues = 0, matieres = 0, cm = 0, td = 0, tp = 0;
    let semestres = 0;
    coursConfig.licences?.forEach(l => {
      l.semestres?.forEach(s => {
        semestres++;
        s.ues?.forEach(u => {
          ues++;
          u.matieres?.forEach(m => {
            matieres++;
            cm += m.listeCM?.length || 0;
            td += m.listeTD?.length || 0;
            tp += m.listeTP?.length || 0;
          });
        });
      });
    });
    return { semestres, ues, matieres, cm, td, tp };
  }, [coursConfig]);

  const downloadBackup = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(coursConfig, null, 4));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "espoir_cours_backup.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    addToast("Backup exporté avec succès !", 'success');
  };

  const handleImportBackup = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result);
        if (json.licences || json.semestres) {
          useStore.getState().setCoursConfig(json);
          addToast("Backup importé avec succès ! Auto-sauvegarde en cours...", 'success');
        } else {
          addToast("Fichier invalide : pas de données de cours détectées.", 'error');
        }
      } catch {
        addToast("Impossible de lire le fichier (JSON invalide).", 'error');
      }
    };
    reader.readAsText(file);
    event.target.value = null;
  };

  const handleManualSync = async () => {
    addToast("Synchronisation en cours...", 'info');
    try {
      const db = await getDb();
      await syncFromBackend(db);
      addToast("Synchronisation terminée !", 'success');
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      addToast("Erreur de synchronisation. Le serveur est-il allumé ?", 'error');
    }
  };

  const handleFactoryReset = async () => {
    if (window.confirm("ATTENTION : Supprimer toutes les données ? Cette action est IRREVERSIBLE.")) {
      if (window.confirm("Derniere chance ! Confirmez la suppression totale ?")) {
        try {
          const emptyConfig = { studyStartDate: "07-09-2026", bedtime: "23:00", wakeUpTime: "07:00", targetGrade: 14, targetRank: 10, summerStudyHoursCompleted: 0, maxSubjectsPerDay: 3, studyBlockDurationMinutes: 50, activeRecallMinutesPerDay: 30, subjects: [], fixedCommitments: [], theme: "dark", pomoWork: 25, pomoBreak: 5, lastActiveDate: "", currentStreak: 0, bestStreak: 0, enableTD: false, enableAnnales: false };
          useStore.getState().setConfig(emptyConfig);
          const emptyCours = { licences: [] };
          useStore.getState().setCoursConfig(emptyCours);
          addToast("Reinitialisation terminee. Rechargement...", 'info');
          setTimeout(() => window.location.reload(), 1500);
        } catch (err) {
          addToast("Erreur lors de la reinitialisation : " + err.message, 'error');
        }
      }
    }
  };

  return (
    <div>
      {/* En-tête Configuration */}
      <div style={{display: 'flex', alignItems: 'center', marginBottom: '2rem', gap: '1rem'}}>
        <h1 style={{margin: 0, fontSize: '2rem'}}>⚙️ Configuration</h1>
      </div>

      {/* Profile Summary - Sleek KPIs */}
      <div className="kpi-grid">
        {[
          { label: "Semestres", val: profileSummary.semestres, color: "#a78bfa", icon: "📅" },
          { label: "UEs", val: profileSummary.ues, color: "#60a5fa", icon: "📚" },
          { label: "Matières", val: profileSummary.matieres, color: "#f59e0b", icon: "📘" },
          { label: "CM", val: profileSummary.cm, color: "#3b82f6", icon: "🏛️" },
          { label: "TD", val: profileSummary.td, color: "#34d399", icon: "📝" },
          { label: "TP", val: profileSummary.tp, color: "#fbbf24", icon: "🔬" }
        ].map((stat, i) => (
          <div key={i} className="card glass-panel kpi-card" style={{borderTop: `3px solid ${stat.color}`}}>
            <div className="kpi-icon">{stat.icon}</div>
            <div className="kpi-value" style={{color: stat.color}}>{stat.val}</div>
            <div className="kpi-label">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="config-panels-grid">
        {/* Objectifs de Réussite */}
        <div className="card glass-panel config-panel">
          <h2 className="config-panel-title" style={{color: 'var(--accent-primary)'}}>
            <span>🎯</span> Objectifs de Réussite
          </h2>
          <p className="config-panel-subtitle">
            Renseigne tes objectifs, l'IA s'occupe de calculer ton temps d'étude optimal chaque jour.
          </p>

          <div className="config-field">
            <label className="config-label-between">
              Note Cible Estimée
              <span style={{fontSize: '1.2rem', color: 'var(--success-color)'}}>{config.targetGrade || 14}/20</span>
            </label>
            <input
              type="range"
              value={config.targetGrade || 14}
              onChange={e => setConfig({...config, targetGrade: parseFloat(e.target.value) || 10})}
              min="10" max="20" step="0.5"
              className="config-range"
            />
          </div>

          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem'}}>
            <div className="config-field">
              <label className="config-label">Rang Visé</label>
              <select
                value={config.targetRank || 50}
                onChange={e => setConfig({...config, targetRank: parseInt(e.target.value) || 50})}
                className="config-select"
              >
                <option value={50}>Moyen (Top 50%)</option>
                <option value={20}>Bon (Top 20%)</option>
                <option value={10}>Très Bon (Top 10%)</option>
                <option value={5}>Excellent (Top 5%)</option>
                <option value={1}>Major (Top 1%)</option>
              </select>
            </div>
          </div>

          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem'}}>
            <div className="config-field">
              <label className="config-label">
                Heure de Coucher (24h)
                <span className="config-label-hint">L'affichage AM/PM dépend du navigateur (ex: 11:00 PM = 23:00).</span>
              </label>
              <input
                type="time"
                value={config?.bedtime || "23:00"}
                onChange={e => setConfig({...config, bedtime: e.target.value})}
                className="config-input"
              />
            </div>
            <div className="config-field">
              <label className="config-label">Heure de Réveil (24h)</label>
              <input
                type="time"
                value={config?.wakeUpTime || "07:00"}
                onChange={e => setConfig({...config, wakeUpTime: e.target.value})}
                className="config-input"
              />
            </div>
          </div>
        </div>

        {/* Paramètres de l'Orchestrateur */}
        <div className="card glass-panel config-panel">
          <h2 className="config-panel-title" style={{color: '#a855f7'}}>
            <span>🧠</span> Paramètres de l'Orchestrateur
          </h2>
          <p className="config-panel-subtitle">
            Contrôle la façon dont l'IA génère les nouvelles tâches pour éviter la surcharge.
          </p>

          <div className="config-fields-stack">
            <div className="config-field-bordered" style={{borderLeftColor: '#3b82f6'}}>
              <label className="config-checkbox-label">
                <input
                  type="checkbox"
                  checked={!!config.enableTD}
                  onChange={e => setConfig({...config, enableTD: e.target.checked})}
                />
                Activer les Travaux Dirigés (TD)
              </label>
              <label className="config-checkbox-label">
                <input
                  type="checkbox"
                  checked={!!config.enableAnnales}
                  onChange={e => setConfig({...config, enableAnnales: e.target.checked})}
                />
                Activer les Annales
              </label>
              <p className="config-field-hint">
                Désactivez ces options pour vous focaliser uniquement sur la théorie (CM) dans un premier temps.
              </p>
            </div>

            <div className="config-field-bordered" style={{borderLeftColor: '#a855f7'}}>
              <label className="config-label-between">
                Agressivité Anti-Ennui (Fast-Track)
                <span style={{fontSize: '1rem', color: '#a855f7'}}>x{config.antiEnnuiMultiplier || 2.0}</span>
              </label>
              <input
                type="range"
                min="1.0" max="4.0" step="0.1"
                value={config.antiEnnuiMultiplier || 2.0}
                onChange={e => setConfig({...config, antiEnnuiMultiplier: parseFloat(e.target.value) || 2.0})}
                className="config-range"
              />
              <p className="config-field-hint">
                Multiplicateur d'intervalle quand un exercice est jugé "Très Facile". Plus c'est haut, plus le planning se purge vite.
              </p>
            </div>

            <div className="config-field-bordered" style={{borderLeftColor: '#ef4444'}}>
              <label className="config-label">Max Nouveaux CM / Matière / Jour</label>
              <input
                type="number"
                min="1" max="10"
                value={config.maxNewCMPerSubjectPerDay || 1}
                onChange={e => setConfig({...config, maxNewCMPerSubjectPerDay: parseInt(e.target.value) || 1})}
                className="config-input"
              />
            </div>

            <div className="config-field-bordered" style={{borderLeftColor: '#f59e0b'}}>
              <label className="config-label">Max Nouveaux CM / Semestre / Jour</label>
              <input
                type="number"
                min="1" max="20"
                value={config.maxNewCMPerSemesterPerDay || 3}
                onChange={e => setConfig({...config, maxNewCMPerSemesterPerDay: parseInt(e.target.value) || 3})}
                className="config-input"
              />
            </div>
          </div>

          <div className="config-warning-box">
            <strong>⚠️ Fortement conseillé :</strong> Garde ces limites basses pour ne pas t'épuiser. Augmente-les uniquement en dernier recours si tu as beaucoup de retard.
          </div>
        </div>

        {/* Calibrage de l'Algorithme */}
        <div className="card glass-panel config-panel">
          <h2 className="config-panel-title" style={{color: '#34d399'}}>
            <span>⏱️</span> Calibrage de l'Algorithme
          </h2>
          <p className="config-panel-subtitle">
            Durées par défaut allouées aux exercices sans moyenne personnalisée.
          </p>
          <div className="duration-grid">
            {[
              { key: 'defaultDurationNewCM', label: 'Nouveau CM', color: '#3b82f6', defaultVal: 120 },
              { key: 'defaultDurationRevCM', label: 'Révision CM', color: '#60a5fa', defaultVal: 30 },
              { key: 'defaultDurationTD', label: 'Durée TD', color: '#34d399', defaultVal: 20 },
              { key: 'defaultDurationAnki', label: 'Flashcards (Anki)', color: '#8b5cf6', defaultVal: 30 },
              { key: 'defaultDurationTP_Etape1', label: 'TP (Étape 1)', color: '#fbbf24', defaultVal: 45 },
              { key: 'defaultDurationTP_Etape2', label: 'TP (Étape 2)', color: '#fbbf24', defaultVal: 180 },
              { key: 'defaultDurationTP_Etape3', label: 'TP (Étape 3)', color: '#fbbf24', defaultVal: 90 },
              { key: 'defaultDurationTP_Etape4', label: 'TP (Étape 4)', color: '#fbbf24', defaultVal: 30 },
              { key: 'defaultDurationAnnales', label: 'Annales', color: '#ef4444', defaultVal: 60 }
            ].map(item => (
              <div key={item.key} className="duration-item" style={{borderLeft: `3px solid ${item.color}`}}>
                <label className="duration-label">{item.label}</label>
                <div className="duration-input-row">
                  <input
                    type="number"
                    min="5"
                    value={config[item.key] || item.defaultVal}
                    onChange={e => setConfig({...config, [item.key]: parseInt(e.target.value) || item.defaultVal})}
                    className="duration-input"
                  />
                  <span className="duration-unit">min</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Actions & Danger Zone */}
      <div className="config-actions-row">
        <div className="card glass-panel config-action-card" style={{borderTop: '3px solid #10b981'}}>
          <h3 style={{color: '#10b981', marginBottom: '1rem'}}>💾 Sauvegarde Locale</h3>
          <p className="config-action-desc">
            L'application sauvegarde tout automatiquement dans ton navigateur. Tu peux exporter un backup manuel de sécurité (Format JSON).
          </p>
          <div className="config-action-buttons">
            <button onClick={downloadBackup} className="btn-success">
              Export JSON
            </button>
            <div style={{flex: 1}}>
              <input
                type="file"
                accept=".json"
                id="import-backup"
                style={{display: 'none'}}
                onChange={handleImportBackup}
              />
              <label htmlFor="import-backup" className="btn-outline-success">
                Importer
              </label>
            </div>
          </div>
        </div>

        <div className="card glass-panel config-action-card" style={{borderTop: '3px solid #ef4444'}}>
          <h3 style={{color: '#ef4444', marginBottom: '1rem'}}>⚠️ Zone de Danger</h3>
          <p className="config-action-desc">
            Attention, ces actions sont irréversibles. Une remise à zéro supprime ton historique, tes cours, et tes statistiques.
          </p>
          <div style={{marginTop: '1.5rem'}}>
            <button onClick={handleFactoryReset} className="btn-danger-outline">
              Remise à Zéro Totale
            </button>
          </div>
        </div>

        <div className="card glass-panel config-action-card" style={{borderTop: '3px solid #3b82f6'}}>
          <h3 style={{color: '#3b82f6', marginBottom: '1rem'}}>🔄 Synchro Locale (Wi-Fi)</h3>
          <p className="config-action-desc">
            Synchronisez le téléphone avec le PC via le réseau local.
          </p>
          <div style={{marginTop: '1rem'}}>
            <label className="config-label">
              Adresse IP du PC (ex: 192.168.1.15)
            </label>
            <input
              type="text"
              placeholder="192.168.x.x"
              defaultValue={getRawIp()}
              onBlur={(e) => setApiUrl(e.target.value)}
              className="config-input"
              style={{marginBottom: '1rem'}}
            />
            <button onClick={handleManualSync} className="btn-primary" style={{width: '100%'}}>
              Synchroniser Maintenant
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConfigPage;
