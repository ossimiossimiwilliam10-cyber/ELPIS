import { motion } from 'framer-motion';
import CircularProgress from '../CircularProgress';
import { Carte, TitreSection, Texte, Jauge } from '../ui';

/**
 * Progression d'ensemble et détail par matière.
 *
 * Les matières sont classées par avancement croissant : celles qui traînent
 * arrivent en tête, là où le regard se pose. Un défilement horizontal les
 * présentait auparavant dans l'ordre du cursus, ce qui laissait les retards
 * hors de vue derrière le bord de l'écran.
 */
export default function StatsSection({ stats, globalPercent }) {
  const matieres = [...(stats.perMatiere || [])].sort((a, b) => a.percent - b.percent);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.15 }}
      style={{ marginTop: 'var(--esp-6)' }}
    >
      <Carte>
        <TitreSection>Progression</TitreSection>

        <div className="el-rang" style={{ gap: 'var(--esp-5)', marginTop: 'var(--esp-4)', marginBottom: 'var(--esp-5)' }}>
          <CircularProgress percent={globalPercent} size={92} strokeWidth={8} />
          <div>
            <div className="el-chiffre" style={{ fontSize: 'var(--texte-xl)' }}>
              {stats.done} <span className="el-texte--mention">sur {stats.total}</span>
            </div>
            <Texte doux petit style={{ marginTop: 'var(--esp-1)' }}>
              cours et exercices réalisés depuis le début
            </Texte>
          </div>
        </div>

        {matieres.length > 0 ? (
          <div className="progression-matieres">
            {matieres.map(m => (
              <div key={m.nom} className="progression-matiere">
                <div className="el-rang el-rang--entre" style={{ marginBottom: 'var(--esp-2)' }}>
                  <span className="progression-matiere__nom" title={m.nom}>{m.nom}</span>
                  <span className="el-mono progression-matiere__valeur">{m.percent}%</span>
                </div>
                <Jauge
                  valeur={m.percent}
                  max={100}
                  ton={m.percent >= 80 ? 'succes' : m.percent < 30 ? 'attention' : undefined}
                  libelle={`Avancement en ${m.nom}`}
                />
              </div>
            ))}
          </div>
        ) : (
          <Texte doux petit>Aucune donnée pour l'instant. Ajoute des cours pour voir tes statistiques.</Texte>
        )}
      </Carte>
    </motion.div>
  );
}
