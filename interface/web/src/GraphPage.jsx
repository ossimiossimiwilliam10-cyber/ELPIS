import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import useStore from './store';
import { motion } from 'framer-motion';

export default function GraphPage() {
  const { coursConfig } = useStore();
  const graphRef = useRef();
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight - 80 });

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      // Sidebar is typically 280px or 80px wide on desktop. We can just use window dimensions and flexbox.
      // We will let flex grow handle it, but ForceGraph3D needs explicit width/height in px.
      const container = document.getElementById('graph-container');
      if (container) {
        setDimensions({
          width: container.clientWidth,
          height: container.clientHeight
        });
      }
    };
    window.addEventListener('resize', handleResize);
    setTimeout(handleResize, 100); // Initial calculation
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Build Graph Data
  const graphData = useMemo(() => {
    const nodes = [];
    const links = [];
    const subjectMap = new Map();

    if (!coursConfig || !coursConfig.licences) return { nodes, links };

    let idCounter = 1;

    // First pass: create nodes
    coursConfig.licences.forEach(lic => {
      (lic.semestres || []).forEach(sem => {
        (sem.ues || []).forEach(ue => {
          (ue.matieres || []).forEach(mat => {
            const nodeId = mat.nom;
            if (!subjectMap.has(nodeId)) {
              
              // Calculate a simple "mastery" score based on FSRS stats or evaluations
              let masteryScore = 50; // default 50%
              if (mat.evaluations && mat.evaluations.length > 0) {
                const avg = mat.evaluations.reduce((acc, ev) => acc + ((ev.note || 10)/(ev.sur || 20))*20, 0) / mat.evaluations.length;
                masteryScore = (avg / 20) * 100;
              }
              
              // Map score to color (Red -> Yellow -> Green)
              const hue = Math.max(0, Math.min(120, (masteryScore / 100) * 120)); // 0=red, 120=green
              const color = `hsl(${hue}, 80%, 60%)`;

              // Node size based on coefficient
              const val = Math.max(1, (mat.coefficient || 1) * 2);

              const node = {
                id: nodeId,
                name: mat.nom,
                group: ue.nom,
                val,
                color,
                mastery: masteryScore
              };
              nodes.push(node);
              subjectMap.set(nodeId, node);
            }
            
            // Connect subjects in the same UE
            if (ue.matieres.length > 1) {
              ue.matieres.forEach(sibling => {
                if (sibling.nom !== mat.nom) {
                  const linkId = [mat.nom, sibling.nom].sort().join('-');
                  links.push({
                    id: linkId,
                    source: mat.nom,
                    target: sibling.nom,
                    value: 1 // thin line for UE connection
                  });
                }
              });
            }
          });
        });
      });
    });

    // Remove duplicate links
    const uniqueLinks = [];
    const linkSet = new Set();
    links.forEach(l => {
      if (!linkSet.has(l.id)) {
        linkSet.add(l.id);
        uniqueLinks.push(l);
      }
    });

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
            nodeLabel={node => `${node.name}<br>Maîtrise: ${Math.round(node.mastery)}%`}
            nodeColor="color"
            nodeRelSize={4}
            linkOpacity={0.3}
            linkColor={() => 'rgba(255,255,255,0.2)'}
            onNodeClick={handleNodeClick}
            backgroundColor="transparent"
          />
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <p>Aucune donnée disponible pour le graphe.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
