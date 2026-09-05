import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { blobDocument } from '../utils/documentsHorsLigne';
import { Bouton, Texte } from './ui';

/**
 * Lecteur de documents intégré à l'application.
 *
 * Le WebView Android ne sait pas afficher un PDF : ouvrir le fichier renvoyait
 * vers le navigateur du téléphone, donc vers le réseau, donc vers un PC allumé.
 * Impossible de réviser dans le train. Le rendu se fait donc ici, à partir du
 * contenu — cache local d'abord, réseau ensuite — ce qui règle le hors-ligne et
 * garde le chronomètre sous les yeux au lieu de basculer vers une autre
 * application.
 *
 * pdf.js n'est chargé qu'au moment où un PDF est réellement ouvert : une image
 * ou un message d'erreur n'a pas à traîner un mégaoctet de bibliothèque.
 */

const estImage = (chemin = '') => /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i.test(chemin);

export default function VisionneuseDocument({ chemin, titre, onClose }) {
  const [etat, setEtat] = useState('chargement'); // chargement | image | pdf | erreur
  const [urlImage, setUrlImage] = useState(null);
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const [echelle, setEchelle] = useState(1);

  const toileRef = useRef(null);
  const documentRef = useRef(null);
  const renduRef = useRef(null);

  // ---- Chargement du contenu ----
  useEffect(() => {
    let annule = false;
    let urlLocale = null;

    (async () => {
      setEtat('chargement');
      const blob = await blobDocument(chemin);
      if (annule) return;

      if (!blob) {
        setEtat('erreur');
        return;
      }

      if (estImage(chemin) || String(blob.type).startsWith('image/')) {
        urlLocale = URL.createObjectURL(blob);
        setUrlImage(urlLocale);
        setEtat('image');
        return;
      }

      try {
        const pdfjs = await import('pdfjs-dist');
        const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

        const donnees = await blob.arrayBuffer();
        if (annule) return;
        const doc = await pdfjs.getDocument({ data: donnees }).promise;
        if (annule) { doc.destroy?.(); return; }

        documentRef.current = doc;
        setPages(doc.numPages);
        setPage(1);
        setEtat('pdf');
      } catch (erreur) {
        console.error('Lecture du document impossible.', erreur);
        if (!annule) setEtat('erreur');
      }
    })();

    return () => {
      annule = true;
      if (urlLocale) URL.revokeObjectURL(urlLocale);
      documentRef.current?.destroy?.();
      documentRef.current = null;
    };
  }, [chemin]);

  // ---- Rendu d'une page ----
  const dessiner = useCallback(async () => {
    const doc = documentRef.current;
    const toile = toileRef.current;
    if (!doc || !toile) return;

    // Un rendu déjà en cours doit être interrompu : pdf.js refuse deux rendus
    // simultanés sur la même toile.
    renduRef.current?.cancel?.();

    const pageRendue = await doc.getPage(page);
    const largeurDispo = toile.parentElement?.clientWidth || 800;
    const base = pageRendue.getViewport({ scale: 1 });
    const vue = pageRendue.getViewport({ scale: (largeurDispo / base.width) * echelle });

    toile.width = Math.floor(vue.width);
    toile.height = Math.floor(vue.height);

    const tache = pageRendue.render({ canvasContext: toile.getContext('2d'), viewport: vue });
    renduRef.current = tache;
    try {
      await tache.promise;
    } catch (erreur) {
      if (erreur?.name !== 'RenderingCancelledException') console.error(erreur);
    }
  }, [page, echelle]);

  useEffect(() => {
    if (etat === 'pdf') dessiner();
  }, [etat, dessiner]);

  // ---- Clavier ----
  useEffect(() => {
    const auClavier = (e) => {
      if (e.key === 'Escape') onClose();
      if (etat !== 'pdf') return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') setPage(p => Math.min(pages, p + 1));
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') setPage(p => Math.max(1, p - 1));
    };
    window.addEventListener('keydown', auClavier);
    return () => window.removeEventListener('keydown', auClavier);
  }, [etat, pages, onClose]);

  return (
    <AnimatePresence>
      <div className="visionneuse__fond" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <motion.div
          className="visionneuse"
          role="dialog"
          aria-modal="true"
          aria-label={titre ? `Document : ${titre}` : 'Document'}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
        >
          <div className="visionneuse__barre">
            <span className="visionneuse__titre" title={titre}>{titre || 'Document'}</span>

            {etat === 'pdf' && (
              <div className="visionneuse__pages">
                <Bouton
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  aria-label="Page précédente"
                >‹</Bouton>
                <span className="el-mono">{page} / {pages}</span>
                <Bouton
                  onClick={() => setPage(p => Math.min(pages, p + 1))}
                  disabled={page >= pages}
                  aria-label="Page suivante"
                >›</Bouton>
                <Bouton onClick={() => setEchelle(e => Math.max(0.5, e - 0.25))} aria-label="Réduire">−</Bouton>
                <Bouton onClick={() => setEchelle(e => Math.min(3, e + 0.25))} aria-label="Agrandir">+</Bouton>
              </div>
            )}

            <Bouton variante="primaire" onClick={onClose}>Fermer</Bouton>
          </div>

          <div className="visionneuse__corps">
            {etat === 'chargement' && (
              <Texte doux>Ouverture du document…</Texte>
            )}

            {etat === 'image' && (
              <img className="visionneuse__image" src={urlImage} alt={titre || 'Document'} />
            )}

            {etat === 'pdf' && <canvas ref={toileRef} className="visionneuse__toile" />}

            {etat === 'erreur' && (
              <div className="visionneuse__erreur">
                <strong>Document indisponible</strong>
                <Texte doux>
                  Il n’est pas dans la copie hors ligne, et le PC ne répond pas. Télécharge
                  tes documents depuis les Réglages pendant que le PC est allumé : ils
                  seront ensuite lisibles partout.
                </Texte>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
