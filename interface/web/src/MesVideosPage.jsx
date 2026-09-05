import { useState, useMemo, useId } from 'react';
import useStore from './store';
import ConfirmModal from './components/ConfirmModal';
import { useToast } from './ToastProvider';
import { estUrlSure, miniatureYoutube, hoteLisible } from './utils/videoUrl';
import {
  Bouton, BoutonIcone, Carte, Champ, EtatVide, Pastille, Selection, TitreCarte, TitrePage, Espace, Rang,
} from './components/ui';

/** Identifiant robuste, y compris pour deux ajouts dans la même milliseconde. */
const nouvelId = () =>
  (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.round(Math.random() * 1e6)}`);

/**
 * Vignette de la vidéo, avec repli quand la miniature n'est pas joignable.
 * L'image est décorative : le titre figure juste en dessous, l'annoncer deux
 * fois n'apporterait rien.
 */
function Vignette({ url }) {
  const [echec, setEchec] = useState(false);
  const miniature = miniatureYoutube(url);

  if (!miniature || echec) {
    return (
      <div className="video-carte__vignette video-carte__repli">
        <span aria-hidden="true">🎬</span>
        <span>{hoteLisible(url) || 'Lien vidéo'}</span>
      </div>
    );
  }

  return (
    <img
      className="video-carte__vignette"
      src={miniature}
      alt=""
      loading="lazy"
      onError={() => setEchec(true)}
    />
  );
}

export default function MesVideosPage() {
  const { config, coursConfig, setConfig, setActiveTab } = useStore();
  const { addToast } = useToast();
  const champId = useId();

  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [selectedMatiere, setSelectedMatiere] = useState('');
  const [recherche, setRecherche] = useState('');

  const [editingVideoId, setEditingVideoId] = useState(null);
  const [editData, setEditData] = useState({ title: '', url: '', matiereNom: '' });

  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  const videos = config.mesVideos || [];

  // Matières proposées : dédoublonnées, une même matière pouvant être suivie sur
  // plusieurs semestres — elle apparaissait alors en double, avec la même clé React.
  const matieres = useMemo(() => {
    const noms = new Set();
    coursConfig?.licences?.forEach(l => {
      l.semestres?.forEach(s => {
        s.ues?.forEach(u => {
          u.matieres?.forEach(m => {
            if (m.nom) noms.add(m.nom);
          });
        });
      });
    });
    return Array.from(noms).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [coursConfig]);

  /** Contrôle commun à l'ajout et à la modification. */
  const champsValides = ({ title: t, url: u, matiereNom: m }, idCourant = null) => {
    if (!t?.trim() || !u?.trim() || !m) {
      addToast("Renseigne le titre, le lien et la matière.", 'error');
      return false;
    }
    // Un champ `type="url"` accepte « javascript: » : l'ouvrir exécuterait
    // le script dans le contexte de l'application.
    if (!estUrlSure(u)) {
      addToast("Le lien doit commencer par http:// ou https://", 'error');
      return false;
    }
    if (videos.some(v => v.url === u.trim() && v.id !== idCourant)) {
      addToast("Ce lien figure déjà dans ta liste.", 'error');
      return false;
    }
    return true;
  };

  const handleAddVideo = (e) => {
    e.preventDefault();
    const donnees = { title: title.trim(), url: url.trim(), matiereNom: selectedMatiere };
    if (!champsValides(donnees)) return;

    setConfig({
      ...config,
      mesVideos: [...videos, { id: nouvelId(), ...donnees, addedAt: new Date().toISOString() }]
    });
    addToast("Vidéo ajoutée.", 'success');

    setUrl('');
    setTitle('');
    setSelectedMatiere('');
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirmId) return;
    setConfig({ ...config, mesVideos: videos.filter(v => v.id !== deleteConfirmId) });
    addToast("Vidéo supprimée.", 'info');
  };

  const startEditing = (video) => {
    setEditingVideoId(video.id);
    setEditData({ title: video.title, url: video.url, matiereNom: video.matiereNom });
  };

  const cancelEditing = () => {
    setEditingVideoId(null);
    setEditData({ title: '', url: '', matiereNom: '' });
  };

  const saveEdit = (id) => {
    const donnees = { ...editData, title: editData.title.trim(), url: editData.url.trim() };
    if (!champsValides(donnees, id)) return;

    setConfig({ ...config, mesVideos: videos.map(v => (v.id === id ? { ...v, ...donnees } : v)) });
    addToast("Vidéo modifiée.", 'success');
    cancelEditing();
  };

  const videosFiltrees = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    if (!terme) return videos;
    return videos.filter(v =>
      v.title?.toLowerCase().includes(terme) || v.matiereNom?.toLowerCase().includes(terme)
    );
  }, [videos, recherche]);

  const videosByMatiere = useMemo(() => {
    const grouped = {};
    videosFiltrees.forEach(v => {
      const cle = v.matiereNom || 'Sans matière';
      if (!grouped[cle]) grouped[cle] = [];
      grouped[cle].push(v);
    });
    return grouped;
  }, [videosFiltrees]);

  const videoASupprimer = videos.find(v => v.id === deleteConfirmId);
  const aucuneMatiere = matieres.length === 0;

  return (
    <div className="videos-page">
      <Rang entre>
        <TitrePage>Mes vidéos</TitrePage>
        <Espace />
        {videos.length > 3 && (
          <input
            type="search"
            className="el-champ"
            value={recherche}
            onChange={e => setRecherche(e.target.value)}
            placeholder="Filtrer par titre ou matière…"
            aria-label="Filtrer les vidéos"
            style={{ width: '260px' }}
          />
        )}
      </Rang>

      {/* Premier lancement : sans matière, l'ajout échouait sur un message
          générique qui n'expliquait pas la vraie cause. */}
      {aucuneMatiere ? (
        <Carte>
          <EtatVide
            icone="📚"
            titre="Aucune matière à associer"
            texte="Chaque vidéo se range sous une matière. Crée-les d'abord dans la Bibliothèque, puis reviens constituer ta collection."
            actions={
              <Bouton variante="primaire" grand onClick={() => setActiveTab('cours')}>
                Ouvrir la Bibliothèque
              </Bouton>
            }
          />
        </Carte>
      ) : (
        <Carte>
          <TitreCarte>Ajouter une vidéo</TitreCarte>
          <form onSubmit={handleAddVideo} className="videos-formulaire">
            <Champ
              id={`${champId}-titre`}
              label="Titre de la vidéo"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Explication du théorème…"
            />
            <Champ
              id={`${champId}-url`}
              label="Lien de la vidéo"
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=…"
            />
            <Selection
              id={`${champId}-matiere`}
              label="Matière associée"
              value={selectedMatiere}
              onChange={e => setSelectedMatiere(e.target.value)}
            >
              <option value="">Choisir une matière</option>
              {matieres.map(m => <option key={m} value={m}>{m}</option>)}
            </Selection>
            <Bouton variante="primaire" type="submit">Ajouter</Bouton>
          </form>
        </Carte>
      )}

      {videos.length === 0 ? (
        <Carte>
          <EtatVide
            icone="📭"
            titre="Aucune vidéo enregistrée"
            texte="Range ici les vidéos qui t'aident à comprendre : elles resteront classées par matière, à portée de clic."
          />
        </Carte>
      ) : videosFiltrees.length === 0 ? (
        <Carte>
          <EtatVide
            icone="🔍"
            titre={`Aucune vidéo ne correspond à « ${recherche} »`}
            actions={<Bouton onClick={() => setRecherche('')}>Effacer le filtre</Bouton>}
          />
        </Carte>
      ) : (
        Object.entries(videosByMatiere).map(([matiere, vids]) => {
          // Une matière supprimée du cursus laisse ses vidéos orphelines : mieux
          // vaut le dire que de les laisser sous un intitulé devenu trompeur.
          const orpheline = !matieres.includes(matiere);
          return (
            <div key={matiere} className="videos-groupe">
              <h3 className={`videos-groupe__titre${orpheline ? ' est-orpheline' : ''}`}>
                {matiere}
                {orpheline && <Pastille ton="attention">absente du cursus</Pastille>}
              </h3>

              <div className="videos-grille">
                {vids.map(video => (
                  <Carte key={video.id} variante="compacte" className="video-carte">
                    {editingVideoId === video.id ? (
                      <div className="video-carte__edition">
                        <input
                          type="text"
                          className="el-champ"
                          value={editData.title}
                          onChange={e => setEditData({ ...editData, title: e.target.value })}
                          placeholder="Titre"
                          // Libellés distincts de ceux du formulaire d'ajout :
                          // deux champs homonymes sur la même page se confondent
                          // à l'oreille comme sous le curseur.
                          aria-label="Modifier le titre"
                        />
                        <input
                          type="url"
                          className="el-champ"
                          value={editData.url}
                          onChange={e => setEditData({ ...editData, url: e.target.value })}
                          placeholder="Lien de la vidéo"
                          aria-label="Modifier le lien"
                        />
                        <select
                          className="el-champ"
                          value={editData.matiereNom}
                          onChange={e => setEditData({ ...editData, matiereNom: e.target.value })}
                          aria-label="Modifier la matière"
                        >
                          {/* Sans cette entrée, une matière disparue du cursus était
                              remplacée en silence par la première de la liste. */}
                          {!matieres.includes(editData.matiereNom) && (
                            <option value={editData.matiereNom}>{editData.matiereNom} (absente du cursus)</option>
                          )}
                          {matieres.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <Rang serre>
                          <Bouton variante="primaire" onClick={() => saveEdit(video.id)}>Enregistrer</Bouton>
                          <Bouton variante="fantome" onClick={cancelEditing}>Annuler</Bouton>
                        </Rang>
                      </div>
                    ) : (
                      <>
                        <Vignette url={video.url} />
                        <h4 className="video-carte__titre">{video.title}</h4>
                        <div className="video-carte__date">
                          Ajoutée le {new Date(video.addedAt).toLocaleDateString('fr-FR')}
                        </div>

                        <div className="video-carte__actions">
                          <a
                            href={estUrlSure(video.url) ? video.url : undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="el-bouton el-bouton--primaire"
                          >
                            Ouvrir
                          </a>
                          <BoutonIcone libelle={`Modifier « ${video.title} »`} onClick={() => startEditing(video)}>
                            ✏️
                          </BoutonIcone>
                          <BoutonIcone danger libelle={`Supprimer « ${video.title} »`} onClick={() => setDeleteConfirmId(video.id)}>
                            🗑️
                          </BoutonIcone>
                        </div>
                      </>
                    )}
                  </Carte>
                ))}
              </div>
            </div>
          );
        })
      )}

      <ConfirmModal
        isOpen={deleteConfirmId !== null}
        onConfirm={() => {
          handleConfirmDelete();
          setDeleteConfirmId(null);
        }}
        onCancel={() => setDeleteConfirmId(null)}
        title="Supprimer la vidéo"
        message={videoASupprimer ? `Supprimer « ${videoASupprimer.title} » de ta collection ?` : 'Supprimer cette vidéo ?'}
        confirmLabel="Supprimer"
        danger
      />
    </div>
  );
}
