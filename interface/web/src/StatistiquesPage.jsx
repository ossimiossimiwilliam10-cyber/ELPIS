import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  LineChart, Line,
} from 'recharts';
import useStore from './store';
import { getApiUrl } from './utils/apiConfig';
import { useToast } from './ToastProvider';
import { construireCsv, telechargerCsv } from './utils/csv';
import useCouleursGraphiques from './hooks/useCouleursGraphiques';
import {
  filtrerParPeriode, serieParJour, repartitionParMatiere, indicateursCles,
  metriquesFsrs, courbeOubli, projections, formaterDuree, dureeDe, tonNote,
} from './utils/statistiques';
import {
  Bouton, Carte, EtatVide, Pile, Rang, Espace, TitrePage, TitreSection, Texte, Pastille,
  couleurType, tonType,
} from './components/ui';

const PERIODES = [
  { valeur: 7, libelle: '7 jours' },
  { valeur: 30, libelle: '30 jours' },
  { valeur: null, libelle: 'Tout' },
];

/** Journées à tracer sur l'histogramme : au-delà, les barres deviennent illisibles. */
const HORIZON_GRAPHIQUE = 90;

/** Un chiffre de tête. */
function Indicateur({ libelle, valeur, unite, indice, texte, ton }) {
  return (
    <div className="stats-cle">
      <div className="stats-cle__libelle">{libelle}</div>
      <div
        className={`stats-cle__valeur${texte ? ' est-texte' : ''}`}
        style={ton ? { color: `var(--${ton})` } : undefined}
      >
        {valeur}{unite && <small>{unite}</small>}
      </div>
      {indice && <div className="stats-cle__indice">{indice}</div>}
    </div>
  );
}

/** Un bloc de graphique, avec son titre et sa légende explicative. */
function Graphique({ titre, mention, hauteur, children }) {
  const classeToile = hauteur ? `stats-graphique__toile stats-graphique__toile--${hauteur}` : 'stats-graphique__toile';
  return (
    <div className="stats-graphique">
      <div className="stats-graphique__entete">
        <h3 className="stats-graphique__titre">{titre}</h3>
        {mention && <span className="stats-graphique__mention">{mention}</span>}
      </div>
      <div className={classeToile}>
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
      </div>
    </div>
  );
}

function StatistiquesPage() {
  // `loadCours` n'existe pas dans le store : la synchronisation Anki affichait
  // un succès sans jamais rafraîchir les données à l'écran.
  const { historique, coursConfig, intelligence, initData } = useStore();
  const { toast } = useToast();
  const { couleur, styleInfobulle, grille, axe } = useCouleursGraphiques();

  // `null` = tout l'historique.
  const [periode, setPeriode] = useState(30);

  const filtre = useMemo(() => filtrerParPeriode(historique, periode), [historique, periode]);
  const cles = useMemo(() => indicateursCles(filtre, periode), [filtre, periode]);
  const serie = useMemo(
    () => serieParJour(historique, periode ?? HORIZON_GRAPHIQUE),
    [historique, periode],
  );
  const parts = useMemo(() => repartitionParMatiere(filtre), [filtre]);
  const memoire = useMemo(() => metriquesFsrs(coursConfig), [coursConfig]);
  const oubli = useMemo(() => courbeOubli(memoire?.stabiliteMoyenne), [memoire]);
  const projete = useMemo(() => projections(intelligence, coursConfig), [intelligence, coursConfig]);

  const couleursParts = [couleur('type-cm'), couleur('type-td'), couleur('type-tp'), couleur('type-anki'), couleur('accent-clair'), couleur('texte-doux')];

  const exporter = () => {
    // Les champs étaient concaténés sans échappement : un titre contenant un
    // guillemet décalait toutes les colonnes.
    const contenu = construireCsv(
      ['Date', 'Matiere', 'Titre', 'Type', 'Duree_Minutes', 'Ease_Factor'],
      (historique || []).map(h => [
        h.timestamp, h.matiere || '', h.titre || '', h.type || '',
        h.dureeMinutes ?? '', h.easeFactor ?? '',
      ]),
    );
    telechargerCsv('elpis_historique.csv', contenu);
    toast.success(`${(historique || []).length} entrées exportées.`);
  };

  const synchroniserAnki = async () => {
    try {
      const res = await fetch(`${getApiUrl()}/anki/sync`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'Synchronisation Anki terminée.');
        // Sans rechargement, l'écran restait figé sur les données d'avant la
        // synchronisation, jusqu'à un rafraîchissement manuel.
        await initData?.();
      } else {
        toast.error('Synchronisation refusée : ' + (data.error || 'raison inconnue'));
      }
    } catch (err) {
      toast.error('Serveur injoignable : ' + err.message);
    }
  };

  // Premier lancement : une page entière de graphiques vides et de « N/A »
  // n'apprend rien. Mieux vaut dire d'où viendront les données.
  if (!historique || historique.length === 0) {
    return (
      <div className="stats-page">
        <TitrePage>Ta progression</TitrePage>
        <Carte>
          <EtatVide
            icone="📈"
            titre="Pas encore de données"
            texte="Tes statistiques se construisent au fil de tes séances : temps par matière, rétention de la mémoire, courbe d'oubli, moyennes projetées. Termine une première tâche pour voir apparaître les premières courbes."
            actions={
              <Bouton variante="primaire" grand onClick={() => useStore.getState().setActiveTab('entrainement')}>
                Aller à ma Session du Jour
              </Bouton>
            }
          />
        </Carte>
      </div>
    );
  }

  const libellePeriode = periode ? `sur ${periode} jours` : 'sur tout l\'historique';

  return (
    <div className="stats-page">
      <Rang entre>
        <div>
          <TitrePage>Ta progression</TitrePage>
          <Texte doux petit>Ce que tu as réellement travaillé, ce que ta mémoire en retient, et où cela te mène.</Texte>
        </div>
        <Espace />
        <div className="stats-barre">
          <div className="stats-periodes" role="group" aria-label="Période observée">
            {PERIODES.map(p => (
              <button
                key={String(p.valeur)}
                type="button"
                className="stats-periode"
                aria-pressed={periode === p.valeur}
                onClick={() => setPeriode(p.valeur)}
              >
                {p.libelle}
              </button>
            ))}
          </div>
          <Bouton onClick={exporter} title="Exporter tout l'historique au format CSV">Exporter CSV</Bouton>
          <Bouton variante="primaire" onClick={synchroniserAnki} title="Récupérer les révisions faites dans Anki">
            Synchroniser Anki
          </Bouton>
        </div>
      </Rang>

      {/* ---------- Ce qui est mesuré ---------- */}
      <section className="stats-section">
        <div className="stats-section__entete">
          <TitreSection>Ton activité</TitreSection>
          <p>{libellePeriode}</p>
        </div>

        <div className="stats-cles">
          <Indicateur
            libelle="Temps travaillé"
            valeur={cles.totalHeures}
            unite="h"
            indice={`${filtre.length} séance${filtre.length > 1 ? 's' : ''}`}
          />
          <Indicateur
            libelle="Moyenne par jour"
            valeur={cles.moyenneQuotidienne}
            indice={`réparti sur ${cles.joursCouverts} jour${cles.joursCouverts > 1 ? 's' : ''}`}
          />
          <Indicateur
            libelle="Régularité"
            valeur={cles.regularite}
            unite="%"
            ton={cles.regularite >= 60 ? 'succes' : cles.regularite >= 30 ? 'attention' : 'danger'}
            indice={cles.serie > 0 ? `${cles.serie} jour${cles.serie > 1 ? 's' : ''} d'affilée` : 'série interrompue'}
          />
          <Indicateur
            libelle="Matière la plus travaillée"
            valeur={cles.matierePhare || '—'}
            texte
            indice={parts[0] ? formaterDuree(parts[0].minutes) : null}
          />
        </div>

        <div className="stats-graphiques">
          <Graphique
            titre="Rythme de travail"
            mention={periode ? null : `${HORIZON_GRAPHIQUE} derniers jours`}
          >
            <BarChart data={serie} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={grille} vertical={false} />
              <XAxis dataKey="date" stroke={axe} fontSize={11} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis stroke={axe} fontSize={11} tickLine={false} axisLine={false} tickFormatter={formaterDuree} />
              <Tooltip contentStyle={styleInfobulle} cursor={{ fill: grille }} formatter={formaterDuree} />
              <Legend verticalAlign="top" height={32} />
              <Bar dataKey="CM" stackId="a" fill={couleur('type-cm')} name="CM" />
              <Bar dataKey="TD" stackId="a" fill={couleur('type-td')} name="TD" />
              <Bar dataKey="TP" stackId="a" fill={couleur('type-tp')} name="TP" />
              <Bar dataKey="ANNALE" stackId="a" fill={couleur('type-annale')} name="Annales" radius={[4, 4, 0, 0]} />
            </BarChart>
          </Graphique>

          <Graphique titre="Répartition par matière" mention="en heures">
            <PieChart>
              <Pie data={parts} cx="50%" cy="50%" innerRadius={58} outerRadius={96} paddingAngle={4} dataKey="value" stroke="none">
                {parts.map((part, i) => (
                  <Cell key={part.name} fill={part.estRegroupement ? couleur('texte-doux') : couleursParts[i % couleursParts.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={styleInfobulle} formatter={(v, nom) => [`${v} h`, nom]} />
              <Legend verticalAlign="bottom" height={36} />
            </PieChart>
          </Graphique>
        </div>
      </section>

      {/* ---------- Ce que la mémoire retient ---------- */}
      {memoire && (
        <motion.section
          className="stats-section"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="stats-section__entete">
            <TitreSection>Ta mémoire</TitreSection>
            <p>{memoire.total} cours suivis par la répétition espacée</p>
          </div>

          <div className="stats-memoire">
            <div className="stats-cles">
              <Indicateur
                libelle="Stabilité moyenne"
                valeur={memoire.stabiliteMoyenne}
                unite=" j"
                indice="délai avant que le souvenir ne s'estompe"
              />
              <Indicateur
                libelle="Rétention actuelle"
                valeur={memoire.retentionMoyenne}
                unite="%"
                ton={memoire.retentionMoyenne >= 90 ? 'succes' : memoire.retentionMoyenne >= 75 ? 'attention' : 'danger'}
                indice="chance de retrouver un cours maintenant"
              />
            </div>

            <div className="stats-graphique">
              <div className="stats-graphique__entete">
                <h3 className="stats-graphique__titre">Maturité des souvenirs</h3>
              </div>
              <div className="stats-maturite">
                {memoire.maturite.map(niveau => (
                  <div key={niveau.name} className="stats-maturite__ligne">
                    <span className="stats-maturite__puce" style={{ background: couleur(niveau.ton) }} aria-hidden="true" />
                    <span className="stats-maturite__nom">
                      {niveau.name}
                      <span>{niveau.aide}</span>
                    </span>
                    <span className="stats-maturite__part">
                      {niveau.value} <small>({Math.round((niveau.value / memoire.total) * 100)} %)</small>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {oubli && (
            <Graphique
              titre="Courbe d'oubli"
              mention="plus la stabilité monte, plus la mémoire tient"
              hauteur="haute"
            >
              <LineChart data={oubli.points} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={grille} />
                <XAxis
                  dataKey="jours" stroke={axe} fontSize={11} tickLine={false} axisLine={false}
                  label={{ value: 'jours écoulés', position: 'insideBottomRight', offset: -4, fill: axe, fontSize: 11 }}
                />
                <YAxis
                  stroke={axe} fontSize={11} tickLine={false} axisLine={false}
                  domain={[0, 100]} tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  contentStyle={styleInfobulle}
                  formatter={(v, nom) => [`${v} %`, nom]}
                  labelFormatter={(j) => `Après ${j} jour${j > 1 ? 's' : ''}`}
                />
                <Legend verticalAlign="top" height={30} />
                {oubli.reperes.map(repere => (
                  <Line
                    key={repere.libelle}
                    type="monotone"
                    dataKey={repere.libelle}
                    stroke={couleur(repere.ton)}
                    strokeWidth={repere.estMien ? 3 : 1.5}
                    strokeDasharray={repere.estMien ? undefined : '5 5'}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            </Graphique>
          )}
        </motion.section>
      )}

      {/* ---------- Où cela mène ---------- */}
      {projete && (
        <motion.section
          className="stats-section"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="stats-section__entete">
            <TitreSection>Tes projections</TitreSection>
            <p>estimations à partir de ton rythme, de tes annales et de ta maîtrise des cours</p>
          </div>

          <div className="stats-projections">
            <Pile>
              <div className="stats-cles">
                <Indicateur
                  libelle="Moyenne projetée"
                  valeur={projete.moyenne.toFixed(1)}
                  unite="/20"
                  ton={tonNote(projete.moyenne)}
                  indice={`${projete.matieres.length} matière${projete.matieres.length > 1 ? 's' : ''} évaluée${projete.matieres.length > 1 ? 's' : ''}`}
                />
              </div>
              <Carte variante="compacte">
                <Texte petit>
                  {projete.moyenne >= 14
                    ? 'Trajectoire solide. Garde ce rythme, il produit ses effets.'
                    : projete.moyenne >= 10
                      ? 'Tu es au-dessus de la barre. Sécurise les acquis avant d\'élargir.'
                      : 'La trajectoire passe sous 10. Reprends les cours en retard et enchaîne des annales.'}
                </Texte>
              </Carte>
            </Pile>

            {projete.radar.length >= 2 && (
              <Graphique titre="Profil par UE" mention="projeté sur 20" hauteur="basse">
                <RadarChart cx="50%" cy="50%" outerRadius="72%" data={projete.radar}>
                  <PolarGrid stroke={grille} />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: axe, fontSize: 10 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 20]} tick={false} axisLine={false} />
                  <Radar name="Projection" dataKey="valeur" stroke={couleur('type-anki')} fill={couleur('type-anki')} fillOpacity={0.35} />
                  <Tooltip contentStyle={styleInfobulle} formatter={(v) => [`${v} / 20`, 'Projection']} />
                </RadarChart>
              </Graphique>
            )}

            <div className="stats-graphique">
              <div className="stats-graphique__entete">
                <h3 className="stats-graphique__titre">Matière par matière</h3>
              </div>
              <div className="stats-matieres">
                {projete.matieres.map(m => (
                  <div key={m.matiere} className="stats-matiere" style={{ '--liseré': `var(--${tonNote(m.score)})` }}>
                    <div className="stats-matiere__identite">
                      <div className="stats-matiere__nom">{m.matiere}</div>
                      <div className="stats-matiere__detail">
                        {m.cmTotal > 0 && `${m.cmMaitrises} / ${m.cmTotal} cours maîtrisés`}
                        {m.apprentissageLent && (
                          <> · <span style={{ color: 'var(--attention)' }}>progression lente</span></>
                        )}
                      </div>
                    </div>
                    <div className="stats-matiere__note" style={{ color: `var(--${tonNote(m.score)})` }}>
                      {m.score.toFixed(1)}<small> /20</small>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.section>
      )}

      {/* ---------- Journal ---------- */}
      <section className="stats-section">
        <div className="stats-section__entete">
          <TitreSection>Dernières séances</TitreSection>
        </div>
        <Carte>
          {filtre.length === 0 ? (
            <Texte doux>Aucune séance sur cette période.</Texte>
          ) : (
            <div className="stats-seances">
              {[...filtre].reverse().slice(0, 15).map((h, i) => (
                <div
                  key={`${h.timestamp}-${i}`}
                  className="stats-seance"
                  style={{ '--liseré': couleurType(h.type) }}
                >
                  <span className="stats-seance__duree">{formaterDuree(dureeDe(h))}</span>
                  <div className="stats-seance__intitule">
                    <div className="stats-seance__titre">{h.titre}</div>
                    <div className="stats-seance__matiere">{h.matiere}</div>
                  </div>
                  <Rang serre>
                    {tonType(h.type) && <Pastille ton={tonType(h.type)}>{h.type}</Pastille>}
                    <span className="stats-seance__date">
                      {h.timestamp
                        ? new Date(h.timestamp).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                        : 'date inconnue'}
                    </span>
                  </Rang>
                </div>
              ))}
            </div>
          )}
        </Carte>
      </section>
    </div>
  );
}

export default StatistiquesPage;
