import { motion } from 'framer-motion';

/**
 * Anneau de progression.
 *
 * Deux versions coexistaient : celle-ci et une copie locale dans la Session du
 * Jour, avec un rendu et une accessibilité différents pour la même information.
 *
 * @param {number}  percent    0 à 100
 * @param {string}  libelle    ce que mesure l'anneau, annoncé aux lecteurs d'écran
 * @param {string}  ton        jeton de couleur du remplissage (succes par défaut)
 * @param {boolean} showText   affiche le pourcentage au centre
 */
export default function CircularProgress({
  percent,
  size = 64,
  strokeWidth = 6,
  showText = true,
  libelle = 'Progression',
  ton,
}) {
  const valeur = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (valeur / 100) * circumference;
  const couleur = `var(--${ton || (valeur >= 100 ? 'succes' : 'accent')})`;

  return (
    <div
      className="el-anneau"
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={valeur}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={libelle}
    >
      <svg width={size} height={size} className="el-anneau__trace" aria-hidden="true">
        <circle
          cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth}
          fill="none" stroke="var(--surface-3)"
        />
        <motion.circle
          cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth}
          fill="none" stroke={couleur} strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
        />
      </svg>
      {showText && (
        <div className="el-anneau__valeur" style={{ fontSize: size * 0.26 }}>
          <motion.span initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, delay: 0.3 }}>
            {valeur}%
          </motion.span>
        </div>
      )}
    </div>
  );
}
