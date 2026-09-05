import { useMemo } from 'react';
import useStore from './store';
import { synthetiserClassement, POIDS , formaterRang } from './utils/classement';
import {
  Carte, EtatVide, Jauge, Pastille, TitrePage, TitreSection, Texte,
} from './components/ui';

/** Une des trois composantes du score, avec sa jauge et sa part. */
function Composante({ titre, score, poids, aide, ton }) {
  const indisponible = score === null;
  return (
    <Carte>
      <div className="rang-composante__entete">
        <span className="rang-composante__titre">{titre}</span>
        <Pastille>{Math.round(poids * 100)} %</Pastille>
      </div>
      <div className={`rang-composante__valeur${indisponible ? ' est-vide' : ''}`}>
        {indisponible ? 'pas encore mesurable' : <>{score.toFixed(0)}<small> / 100</small></>}
      </div>
      {!indisponible && (
        <Jauge valeur={score} ton={ton} libelle={`${titre} : ${score.toFixed(0)} sur 100`} />
      )}
      <div className="rang-composante__aide">{aide}</div>
    </Carte>
  );
}

export default function ClassementPage() {
  const { config, coursConfig, historique, rankingBaseline, intelligence } = useStore();

  const bilan = useMemo(
    () => synthetiserClassement({ coursConfig, historique, config, rankingBaseline, intelligence }),
    [config, coursConfig, historique, rankingBaseline, intelligence],
  );

  const { notes, retention, regularite, scoreGlobal, rang, parMatiere } = bilan;

  return (
    <div className="rang-page">
      <div>
        <TitrePage>Performances</TitrePage>
        <Texte doux petit>
          Un score unique construit sur tes notes, ta rétention et ta régularité.
        </Texte>
      </div>

      <Carte>
        <div className="rang-global">
          {scoreGlobal === null ? (
            <EtatVide
              icone="📊"
              titre="Pas encore assez de données"
              texte="Ce score se construit à partir de tes notes, de tes révisions et de ta régularité. Travaille quelques séances pour le voir apparaître."
            />
          ) : (
            <>
              <div className="rang-global__valeur">
                {scoreGlobal.toFixed(0)}<small> / 100</small>
              </div>
              <div className="rang-global__libelle">Score global</div>

              {/* Sans moyennes de référence, la page affichait « Top 50 % » — la
                  valeur par défaut du calcul — comme s'il s'agissait d'un fait. */}
              {rang !== null ? (
                <div className="rang-global__position">
                  Environ dans les <strong>{formaterRang(rang)} %</strong> de tête, par rapport
                  aux moyennes de référence enregistrées.
                </div>
              ) : (
                <div className="rang-global__position est-indisponible">
                  Aucune moyenne de promotion n'est enregistrée : ton score ne peut être
                  comparé à personne pour l'instant.
                </div>
              )}
            </>
          )}
        </div>
      </Carte>

      <div className="rang-composantes">
        <Composante
          titre="Notes"
          score={notes.score}
          poids={POIDS.notes}
          ton="accent"
          aide={
            notes.moyenne === null
              ? 'Renseigne des notes dans le Bulletin.'
              : `Moyenne générale de ${notes.moyenne.toFixed(2)} / 20, coefficients compris.`
          }
        />
        <Composante
          titre="Rétention"
          score={retention.score}
          poids={POIDS.retention}
          ton="succes"
          aide={
            retention.source === 'anki'
              ? 'Rétention réelle mesurée par Anki.'
              : retention.source === 'historique'
                ? 'Part de tes révisions menées à leur terme.'
                : 'Aucune révision enregistrée pour le moment.'
          }
        />
        <Composante
          titre="Régularité"
          score={regularite.score}
          poids={POIDS.regularite}
          ton="attention"
          aide={`${regularite.sessions} séances sur les ${regularite.fenetre} derniers jours, pour un objectif de ${regularite.attendues}.`}
        />
      </div>

      <section className="rang-section">
        <TitreSection>Matière par matière</TitreSection>

        {parMatiere.length === 0 ? (
          <Carte>
            <EtatVide
              icone="📈"
              titre="Aucune comparaison disponible"
              texte="Le détail par matière s'affiche dès qu'une moyenne de promotion est enregistrée pour au moins l'une d'entre elles."
            />
          </Carte>
        ) : (
          <div className="rang-matieres">
            {parMatiere.map(m => (
              <Carte key={m.nom} className="rang-matiere">
                <div className="rang-matiere__identite">
                  <div className="rang-matiere__nom">
                    {m.nom}
                    {m.estimee && <Pastille ton="accent">note projetée</Pastille>}
                  </div>
                  <div className="rang-matiere__detail">
                    {m.note.toFixed(2)} / 20 · promotion à {m.moyennePromo.toFixed(1)} (± {m.ecartType.toFixed(1)})
                  </div>
                  {m.retention !== null && (
                    <div className="rang-matiere__detail">
                      Rétention Anki : {m.retention.toFixed(0)} %
                    </div>
                  )}
                </div>
                <div className={`rang-matiere__position${m.rang < 50 ? ' est-haute' : ''}`}>
                  {formaterRang(m.rang)} %
                  <small>de tête</small>
                </div>
              </Carte>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
