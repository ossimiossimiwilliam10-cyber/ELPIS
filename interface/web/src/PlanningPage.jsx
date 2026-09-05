import { useState, useEffect, useCallback, useMemo } from 'react';
import useStore from './store';
import { getApiUrl } from './utils/apiConfig';
import { dateCalendaire } from './utils/dateUtils';
import { Bouton, Carte, EtatVide, TitrePage, Texte, couleurType } from './components/ui';

/** Plage horaire affichée par défaut. Elle s'élargit si des créneaux débordent. */
const HEURE_DEBUT_DEFAUT = 7;
const HEURE_FIN_DEFAUT = 23;
const HAUTEUR_HEURE = 60; // px par heure (1 px par minute)

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

const enHeure = (min) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/** Date locale à partir de « AAAA-MM-JJ », sans passer par le fuseau UTC. */


export default function PlanningPage() {
  const setActiveTab = useStore(s => s.setActiveTab);
  const [weeks, setWeeks] = useState([]);
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSimulation = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // L'adresse était figée sur localhost : la page ne pouvait pas fonctionner
      // depuis l'application Android ni depuis un autre appareil du réseau.
      const res = await fetch(`${getApiUrl()}/orchestrateur/simulation`);
      if (!res.ok) throw new Error(`Le serveur a répondu ${res.status}`);
      const data = await res.json();
      setWeeks(data.weeks || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSimulation(); }, [fetchSimulation]);

  // Un index conservé au-delà de la dernière semaine faisait tomber la page.
  const semaineIndex = Math.min(currentWeekIndex, Math.max(0, weeks.length - 1));
  const currentWeek = weeks[semaineIndex];

  // Une tâche planifiée avant 7 h ou après 23 h était purement escamotée : la
  // plage s'ajuste désormais au contenu réel de la semaine.
  const [heureDebut, heureFin] = useMemo(() => {
    const creneaux = (currentWeek?.days || []).flatMap(d => d.slots || []);
    if (creneaux.length === 0) return [HEURE_DEBUT_DEFAUT, HEURE_FIN_DEFAUT];

    const premier = Math.min(...creneaux.map(s => Math.floor(s.startMin / 60)));
    const dernier = Math.max(...creneaux.map(s => Math.ceil((s.startMin + s.duree) / 60)));
    return [
      Math.max(0, Math.min(HEURE_DEBUT_DEFAUT, premier)),
      Math.min(24, Math.max(HEURE_FIN_DEFAUT, dernier)),
    ];
  }, [currentWeek]);

  if (loading) {
    return (
      <div className="session-chargement">
        <div className="loading-spinner" role="status" aria-label="Génération du calendrier" />
      </div>
    );
  }

  if (error) {
    return (
      <Carte>
        <EtatVide
          icone="📡"
          titre="Calendrier indisponible"
          texte={error}
          actions={<Bouton variante="primaire" grand onClick={fetchSimulation}>Réessayer</Bouton>}
        />
      </Carte>
    );
  }

  if (!weeks || weeks.length === 0) {
    return (
      <Carte>
        <EtatVide
          icone="🗓️"
          titre="Rien à planifier pour l'instant"
          texte="Le calendrier projette tes cours et exercices sur les semaines à venir. Ajoute-les dans la Bibliothèque pour le voir se remplir."
          actions={
            <Bouton variante="primaire" grand onClick={() => setActiveTab('cours')}>
              Ouvrir la Bibliothèque
            </Bouton>
          }
        />
      </Carte>
    );
  }

  const hauteurTotale = (heureFin - heureDebut) * HAUTEUR_HEURE;

  return (
    <div className="cal-page">
      <div className="cal-entete">
        <div>
          <TitrePage>Calendrier</TitrePage>
          <Texte doux petit>
            Projection de tes séances sur les prochaines semaines, à partir de tes
            disponibilités et de tes échéances.
          </Texte>
        </div>

        <div className="cal-navigation">
          <Bouton
            variante="fantome"
            onClick={() => setCurrentWeekIndex(Math.max(0, semaineIndex - 1))}
            disabled={semaineIndex === 0}
            aria-label="Semaine précédente"
          >
            ◀
          </Bouton>
          <span className="cal-navigation__position">
            Semaine {(currentWeek.weekIndex ?? semaineIndex) + 1} / {weeks.length}
          </span>
          <Bouton
            variante="fantome"
            onClick={() => setCurrentWeekIndex(Math.min(weeks.length - 1, semaineIndex + 1))}
            disabled={semaineIndex === weeks.length - 1}
            aria-label="Semaine suivante"
          >
            ▶
          </Bouton>
        </div>
      </div>

      <div className="cal-grille">
        <div className="cal-jours">
          <div className="cal-jours__marge" />
          {currentWeek.days.map((day, i) => (
            <div key={day.date || i} className="cal-jour">
              <div className="cal-jour__nom">{JOURS[i]}</div>
              <div className="cal-jour__date">
                {/* Sans date exploitable, mieux vaut ne rien afficher que
                    « Invalid Date » : le nom du jour reste, lui, correct. */}
                {dateCalendaire(day.date)?.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) ?? ''}
              </div>
            </div>
          ))}
        </div>

        <div className="cal-corps custom-scrollbar">
          <div className="cal-toile" style={{ height: `${hauteurTotale}px` }}>
            <div className="cal-heures">
              {Array.from({ length: heureFin - heureDebut + 1 }).map((_, i) => (
                <div key={i} className="cal-heure" style={{ top: `${i * HAUTEUR_HEURE - 8}px` }}>
                  {heureDebut + i}h
                </div>
              ))}
            </div>

            {currentWeek.days.map((day, dIndex) => (
              <div key={day.date || dIndex} className="cal-colonne">
                {Array.from({ length: heureFin - heureDebut }).map((_, i) => (
                  <div key={i} className="cal-ligne" style={{ top: `${(i + 1) * HAUTEUR_HEURE}px` }} />
                ))}

                {day.slots.map((slot, sIndex) => {
                  const haut = (slot.startMin - heureDebut * 60) * (HAUTEUR_HEURE / 60);
                  const hauteur = slot.duree * (HAUTEUR_HEURE / 60);
                  if (haut < 0 || haut > hauteurTotale) return null;

                  const fin = enHeure(slot.startMin + slot.duree);
                  const debut = enHeure(slot.startMin);

                  return (
                    <div
                      key={`${slot.startMin}-${sIndex}`}
                      className="cal-creneau"
                      // Même couleur que partout ailleurs : le calendrier peignait
                      // les TD en orange et les TP en turquoise, alors que le reste
                      // de l'application les montre en vert et en ambre.
                      style={{
                        top: `${haut}px`,
                        height: `${Math.max(20, hauteur)}px`,
                        '--teinte': couleurType(slot.type),
                      }}
                      title={`${debut} – ${fin} · ${slot.titre}`}
                    >
                      <div className="cal-creneau__matiere">{slot.matiere}</div>
                      <div className="cal-creneau__intitule">{slot.type} · {slot.titre}</div>
                      {hauteur > 38 && <div className="cal-creneau__horaire">{debut} – {fin}</div>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
