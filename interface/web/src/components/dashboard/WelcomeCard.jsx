import { motion } from 'framer-motion';
import InfoTooltip from '../InfoTooltip';
import CircularProgress from '../CircularProgress';

/**
 * Carte d'accueil du Dashboard — salutation, KPIs, progression.
 */
export default function WelcomeCard({ greeting, orderedTaches, recommendedDailyHours, tempsRequisMin, globalPercent, config, tempsTravailleToday }) {
  return (
    <div className="welcome-card">
      <div>
        <h2>{greeting} ! 👋</h2>
        <p>
          {orderedTaches.length > 0
            ? `Tu as encore ${orderedTaches.length} objectif${orderedTaches.length > 1 ? 's' : ''} \u00e0 accomplir aujourd'hui.`
            : "Tu as tout termin\u00e9 pour aujourd'hui. Bravo ! Pourquoi ne pas avancer sur tes projets persos ou lancer une Activit\u00e9 Libre ?"}
        </p>
      </div>
      <div className="welcome-stats">
        <div className="welcome-stat">
          <div className="welcome-stat-value" style={{color: 'var(--success-color)'}}>{recommendedDailyHours}h</div>
          <div className="welcome-stat-label">
            <InfoTooltip content="Calculé dynamiquement par le moteur de charge selon tes coefficients et les jours restants avant l'examen.">
              Cible IA <span style={{fontSize:'0.8rem'}}>ℹ️</span>
            </InfoTooltip>
          </div>
        </div>
        <div className="welcome-stat">
          <div className="welcome-stat-value">{orderedTaches.length}</div>
          <div className="welcome-stat-label">T\u00e2ches</div>
        </div>
        <div className="welcome-stat">
          <div className="welcome-stat-value" style={{color: 'var(--primary-color)'}}>{Math.round((tempsTravailleToday || 0) / 60 * 10) / 10}h</div>
          <div className="welcome-stat-label">
            <InfoTooltip content="Temps d\u00e9j\u00e0 travaill\u00e9 aujourd'hui.">
              Travaill\u00e9 <span style={{fontSize:'0.8rem'}}>ℹ️</span>
            </InfoTooltip>
          </div>
        </div>
        <div className="welcome-stat">
          <div className="welcome-stat-value">{Math.round(tempsRequisMin/60 * 10)/10}h</div>
          <div className="welcome-stat-label">
            <InfoTooltip content="Temps total estimé par le système pour accomplir toutes tes tâches du jour.">
              Requis <span style={{fontSize:'0.8rem'}}>ℹ️</span>
            </InfoTooltip>
          </div>
        </div>
        <div className="welcome-stat welcome-stat-circular">
          <CircularProgress percent={globalPercent} />
          <div className="welcome-stat-label">
            <InfoTooltip content="Pourcentage global d'avancement (tous cours et exercices confondus).">
              Global <span style={{fontSize:'0.8rem'}}>ℹ️</span>
            </InfoTooltip>
          </div>
        </div>
        <div className="welcome-stat welcome-stat-streak">
          <div className="welcome-stat-value" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#F59E0B' }}>
            <span style={{ filter: 'drop-shadow(0 0 10px rgba(245, 158, 11, 0.8))', fontSize: '2rem', animation: 'float 4s ease-in-out infinite' }}>🔥</span>
            <span style={{ fontSize: '2.4rem' }}>{config?.currentStreak || 0}</span>
          </div>
          <div className="welcome-stat-label" style={{ color: 'var(--text-secondary)' }}>
            <InfoTooltip content="Le nombre de jours consécutifs où tu as validé une tâche ou pris un jour de repos autorisé. Ne brise pas la chaîne !">
              Record : {config?.bestStreak || 0} <span style={{fontSize:'0.8rem'}}>ℹ️</span>
            </InfoTooltip>
          </div>
        </div>
      </div>
    </div>
  );
}


