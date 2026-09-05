import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import useStore from './store';
import { motion } from 'framer-motion';
import { moyenneMatiere } from './utils/bulletin';

/** Couleur d'un nœud selon sa maîtrise : rouge → jaune → vert, gris si inconnue. */
const couleurMaitrise = (maitrise) => {
  if (maitrise === null) return 'hsl(220, 10%, 45%)';
  const teinte = Math.max(0, Math.min(120, (maitrise / 100) * 120));
  return `hsl(${teinte}, 80%, 60%)`;
};

export default function GraphPage() {
  const { coursConfig } = useStore();
  const setActiveTab = useStore(s => s.setActiveTab);
  const graphRef = useRef();
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight - 80 });

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      // ForceGraph3D exige des dimensions explicites en pixels : on les prend
      // sur le conteneur plutôt que sur la fenêtre, à cause de la barre latérale.
      const container = document.getElementById('graph-container');
      if (container) {
        setDimensions({
          width: container.clientWidth,
          height: container.clientHeight
        });
      }
    };
    window.addEventListener('resize', handleResize);
    // Le délai laissait s'exécuter une écriture d'état sur un composant démonté
    // si l'utilisateur changeait d'onglet aussitôt.
    const premierCalcul = setTimeout(handleResize, 100);
    return () => {
      clearTimeout(premierCalcul);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Build Graph Data
  const graphData = useMemo(() => {
    const nodes = [];
    const links = [];
    const subjectMap = new Map();

    if (!coursConfig || !coursConfig.licences) return { nodes, links };

    // First pass: create nodes
    coursConfig.licences.forEach(lic => {
      (lic.semestres || []).forEach(sem => {
        (sem.ues || []).forEach(ue => {
          (ue.matieres || []).forEach(mat => {
            const nodeId = mat.nom;
            if (!nodeId) return;

            if (!subjectMap.has(nodeId)) {
              // Même moyenne que le bulletin. L'ancien calcul comptait une
              // évaluation sans note pour 10/20 : une matière jamais évaluée
              // s'affichait « maîtrise 50 % », en jaune, comme si elle l'était
              // à moitié.
              const moyenne = moyenneMatiere(mat.evaluations);
              const masteryScore = typeof moyenne === 'number' ? (moyenne / 20) * 100 : null;

              const node = {
                id: nodeId,
                name: mat.nom,
                group: ue.nom,
                // Taille selon le coefficient
                val: Math.max(1, (mat.coefficient || 1) * 2),
                color: couleurMaitrise(masteryScore),
                mastery: masteryScore
              };
              nodes.push(node);
              subjectMap.set(nodeId, node);
            }

            const ajouterLien = (autre, type) => {
              if (!autre || autre === mat.nom) return;
              const linkId = [mat.nom, autre].sort().join('-') + `::${type}`;
              links.push({ id: linkId, source: mat.nom, target: autre, type, value: type === 'synergie' ? 3 : 1 });
            };

            // Voisinage d'UE
            (ue.matieres || []).forEach(sibling => ajouterLien(sibling.nom, 'ue'));

            // Synergies déclarées dans la Bibliothèque. La page annonçait
            // « leurs synergies » mais ne traçait que les liens d'UE : les
            // ponts inter-matières configurés par l'utilisateur n'apparaissaient
            // nulle part.
            (mat.synergies || []).forEach(nom => ajouterLien(nom, 'synergie'));
          });
        });
      });
    });

    // Une synergie prime sur un simple voisinage d'UE entre les deux mêmes matières.
    const parPaire = new Map();
    links.forEach(l => {
      const paire = [l.source, l.target].sort().join('-');
      const existant = parPaire.get(paire);
      if (!existant || (existant.type === 'ue' && l.type === 'synergie')) {
        parPaire.set(paire, l);
      }
    });

    // Un lien vers une matière absente du cursus ferait planter le moteur de rendu.
    const uniqueLinks = Array.from(parPaire.values())
      .filter(l => subjectMap.has(l.source) && subjectMap.has(l.target));

    return { nodes, links: uniqueLinks };
  }, [coursConfig]);

  const handleNodeClick = useCallback(node => {
    // Aim at node from outside it
    const distance = 80;
    const distRatio = 1 + distance/Math.hypot(node.x, node.y, node.z);
    
    if (graphRef.current) {
      graphRef.current.cameraPosition(
        { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, // new position
        node, // lookAt ({ x, y, z })
        2000  // ms transition duration
      );
    }
  }, [graphRef]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="page-container" 
      style={{ padding: 0, height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <div className="page-header" style={{ padding: '1.5rem', paddingBottom: '0' }}>
        <h1 className="page-title">Graphe de Connaissances 🌌</h1>
        <p className="page-subtitle">Visualisation 3D de l'ensemble des matières et de leurs synergies.</p>
      </div>

      <div id="graph-container" style={{ flex: 1, position: 'relative', overflow: 'hidden', marginTop: '1rem' }}>
        {graphData.nodes.length > 0 ? (
          <ForceGraph3D
            ref={graphRef}
            width={dimensions.width}
            height={dimensions.height}
            graphData={graphData}
            nodeLabel={node => (
              // `Math.round(null)` valait 0 : une matière sans note affichait
              // « Maîtrise: 0% » au lieu de reconnaître l'absence de données.
              node.mastery === null
                ? `${node.name}<br>Pas encore de note`
                : `${node.name}<br>Maîtrise: ${Math.round(node.mastery)}%`
            )}
            nodeColor="color"
            nodeRelSize={4}
            linkOpacity={0.3}
            // Les synergies déclarées se distinguent du simple voisinage d'UE.
            linkColor={link => (link.type === 'synergie' ? 'rgba(96, 165, 250, 0.65)' : 'rgba(255,255,255,0.2)')}
            linkWidth={link => (link.type === 'synergie' ? 2 : 0.5)}
            onNodeClick={handleNodeClick}
            backgroundColor="transparent"
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', textAlign: 'center', padding: '2rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }} aria-hidden="true">🌌</div>
            <h3 style={{ marginBottom: '0.5rem' }}>Le graphe est encore vide</h3>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '44ch', marginBottom: '2rem' }}>
              Chaque matière devient une étoile, reliée à celles de son UE et à celles
              que tu déclares en synergie. Ajoute tes matières pour voir la carte apparaître.
            </p>
            <button className="btn-primary" onClick={() => setActiveTab('cours')} style={{ padding: '0.9rem 1.8rem' }}>
              📚 Ouvrir la Bibliothèque
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
