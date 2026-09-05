import { useState } from 'react';
import { motion } from 'framer-motion';
import { Bouton, Texte } from '../ui';
import { getApiUrl } from '../../utils/apiConfig';

/**
 * Épreuve de validation par Anki.
 *
 * Après avoir travaillé un cours, l'étudiant passe une courte épreuve sur les
 * cartes correspondantes. Le taux mesuré remplace son propre jugement, qui est
 * toujours trop indulgent après une relecture.
 *
 * C'est la seule voie de validation d'un cours rattaché à un chapitre. Un échec
 * ne bloque pas pour autant : il est enregistré tel quel, et la note transmise
 * à FSRS fait revenir le cours plus tôt — comportement attendu d'une révision
 * manquée. Ce qui est refusé, c'est de valider sans avoir été mesuré.
 *
 * @param {string}   deckMatiere    deck Anki de la matière
 * @param {string}   titreCours     titre du cours, cherché parmi les sous-decks
 * @param {string}   deckExplicite  chapitre rattaché au cours, prioritaire
 * @param {Function} onValide       reçoit (note, verdict) issus de la mesure
 */
export default function EpreuveAnki({ deckMatiere, titreCours, deckExplicite, onValide }) {
  const [etat, setEtat] = useState('prete');
  const [epreuve, setEpreuve] = useState(null);
  const [verdict, setVerdict] = useState(null);
  const [erreur, setErreur] = useState(null);

  const ouvrir = async () => {
    setEtat('ouverture');
    setErreur(null);
    try {
      const reponse = await fetch(`${getApiUrl()}/anki/epreuve/ouvrir`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deckMatiere, titreCours, deckExplicite }),
      });
      const donnees = await reponse.json();
      if (!reponse.ok || !donnees.success) throw new Error(donnees.error || 'Épreuve impossible.');
      setEpreuve(donnees);
      setEtat('en-cours');
    } catch (err) {
      setErreur(err.message);
      setEtat('prete');
    }
  };

  const relever = async () => {
    setEtat('releve');
    try {
      const reponse = await fetch(`${getApiUrl()}/anki/epreuve/relever`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requete: epreuve.requete, debut: epreuve.debut,
          origines: epreuve.origines, nouvelles: epreuve.nouvelles,
          population: epreuve.population,
        }),
      });
      const donnees = await reponse.json();
      if (!reponse.ok || !donnees.success) throw new Error(donnees.error || 'Relevé impossible.');
      setVerdict(donnees);
      setEtat('juge');
    } catch (err) {
      setErreur(err.message);
      setEtat('en-cours');
    }
  };

  return (
    <div className="epreuve">
      {etat === 'prete' && (
        <>
          <div className="epreuve__titre">Vérifier sur Anki</div>
          <Texte doux petit>
            Vingt cartes de ce chapitre, en priorité celles qui t'ont déjà échappé.
            C'est cette épreuve qui valide le cours — pas ton impression.
          </Texte>
          {erreur && <div className="epreuve__erreur">{erreur}</div>}
          <Bouton variante="primaire" grand pleineLargeur onClick={ouvrir}>Lancer l'épreuve</Bouton>
        </>
      )}

      {etat === 'ouverture' && <Texte doux petit>Ouverture d'Anki…</Texte>}

      {etat === 'en-cours' && (
        <>
          <div className="epreuve__titre">Épreuve en cours dans Anki</div>
          <Texte doux petit>
            {epreuve.cartes} cartes t'attendent dans « Séance de révisions personnalisées »
            {epreuve.precision === 'matiere' && ' — le deck du cours n\'a pas été trouvé, l\'épreuve porte sur toute la matière'}
            {epreuve.nouvelles?.length > 0 && `, dont ${epreuve.nouvelles.length} jamais étudiées`}.
            Reviens ici quand tu as terminé.
          </Texte>

          {/* Les nouveautés s'apprennent, elles ne se retrouvent pas : elles
              sortent du calcul du taux, faute de quoi un chapitre fraîchement
              rempli échouerait systématiquement. */}
          {epreuve.aApprendre > (epreuve.nouvelles?.length || 0) && (
            <Texte doux petit>
              {epreuve.aApprendre - epreuve.nouvelles.length} autres cartes neuves restent dans
              ce chapitre : elles entreront aux épreuves suivantes, par petits groupes.
            </Texte>
          )}
          {erreur && <div className="epreuve__erreur">{erreur}</div>}
          <Bouton variante="primaire" grand pleineLargeur onClick={relever}>J'ai terminé</Bouton>
        </>
      )}

      {etat === 'releve' && <Texte doux petit>Relevé du résultat…</Texte>}

      {etat === 'juge' && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <div className={`epreuve__verdict${verdict.reussie ? ' est-reussie' : verdict.concluante ? ' est-echouee' : ''}`}>
            {verdict.concluante ? (
              <>
                <span className="epreuve__taux">
                  {verdict.taux} %
                  {/* Un taux sans sa précision se lit comme une certitude : sur
                      vingt cartes tirées parmi cent trente-cinq, 78 % et 88 %
                      sont indiscernables. */}
                  {verdict.marge > 0 && <small> ± {verdict.marge}</small>}
                </span>
                <span className="epreuve__detail">
                  {verdict.motif}
                  {verdict.decouvertes > 0
                    && ` ${verdict.decouvertes} nouvelles cartes apprises au passage, hors du calcul.`}
                  {verdict.serre
                    && ` À cette précision, le résultat ne permet pas de trancher franchement autour de ${verdict.seuil} %.`}
                </span>
              </>
            ) : (
              <span className="epreuve__detail">{verdict.motif}</span>
            )}
          </div>

          {/* Un pourcentage dit qu'il faut retravailler ; il ne dit pas quoi.
              Les cartes échouées, elles, nomment les notions à reprendre. */}
          {verdict.lacunes?.notions?.length > 0 && (
            <div className="epreuve__lacunes">
              <div className="epreuve__lacunes-titre">
                Ce qui n'est pas revenu
                {verdict.lacunes.total > verdict.lacunes.affichees
                  && ` — ${verdict.lacunes.affichees} des ${verdict.lacunes.total}`}
              </div>
              <ul className="epreuve__lacunes-liste">
                {verdict.lacunes.notions.map(n => (
                  <li key={n.carte}>
                    {n.question}
                    {n.recurrente && <span className="epreuve__recurrente">déjà oubliée plusieurs fois</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="el-rang el-rang--serre">
            {verdict.concluante ? (
              <Bouton variante="primaire" onClick={() => onValide(verdict.note, verdict)}>
                {verdict.reussie ? 'Valider le cours' : 'Valider — il reviendra plus tôt'}
              </Bouton>
            ) : (
              <>
                <Bouton variante="primaire" onClick={() => setEtat('en-cours')}>Reprendre l'épreuve</Bouton>
                {/* Découvrir des cartes n'est pas échouer : le cours a bien été
                    travaillé, il revient simplement vite. */}
                {verdict.premierContact && (
                  <Bouton onClick={() => onValide(2, verdict)}>Valider ce premier passage</Bouton>
                )}
              </>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
