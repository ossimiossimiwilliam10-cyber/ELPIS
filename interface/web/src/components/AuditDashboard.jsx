import React, { useState, useEffect } from 'react';

const API_URL = '/api';

export default function AuditDashboard({ isOpen, onClose }) {
  const [auditData, setAuditData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchAudit();
    }
  }, [isOpen]);

  const fetchAudit = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/audit`);
      const data = await res.json();
      setAuditData(data);
    } catch (e) {
      console.error("Failed to fetch audit data", e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const isPending = auditData?.status === "pending";
  const hasAnomalies = auditData?.total_anomalies > 0;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div style={{
        background: 'var(--bg-secondary)', width: '90%', maxWidth: '800px',
        maxHeight: '85vh', borderRadius: '12px', padding: '1.5rem',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🛡️ Code Health Audit
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.2rem' }}>
            ✕
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
          {loading ? (
            <p>Chargement du dernier rapport d'audit...</p>
          ) : isPending ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              <p>⏳ Aucun audit n'a encore été réalisé.</p>
              <p style={{ fontSize: '0.9rem' }}>L'agent Python tourne en arrière-plan et scannera le code sous peu.</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                <div style={{ background: 'var(--bg-primary)', padding: '1rem', borderRadius: '8px', flex: 1, minWidth: '150px' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Dernier Scan</div>
                  <div style={{ fontWeight: 'bold' }}>{new Date(auditData.last_scan).toLocaleString()}</div>
                </div>
                <div style={{ background: 'var(--bg-primary)', padding: '1rem', borderRadius: '8px', flex: 1, minWidth: '150px' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Fichiers scannés</div>
                  <div style={{ fontWeight: 'bold' }}>{auditData.files_scanned} fichiers</div>
                </div>
                <div style={{ background: hasAnomalies ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)', padding: '1rem', borderRadius: '8px', flex: 1, minWidth: '150px', border: `1px solid ${hasAnomalies ? '#ef4444' : '#10b981'}` }}>
                  <div style={{ fontSize: '0.8rem', color: hasAnomalies ? '#ef4444' : '#10b981' }}>Statut</div>
                  <div style={{ fontWeight: 'bold', color: hasAnomalies ? '#ef4444' : '#10b981' }}>
                    {hasAnomalies ? `${auditData.total_anomalies} Anomalies` : "100% Propre"}
                  </div>
                </div>
              </div>

              {hasAnomalies ? (
                <div>
                  <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>Détails des anomalies</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '1rem' }}>
                    {auditData.anomalies.map((anom, idx) => (
                      <div key={idx} style={{ 
                        background: 'var(--bg-primary)', 
                        borderLeft: `4px solid ${anom.severity === 'critical' ? '#ef4444' : anom.severity === 'warning' ? '#f59e0b' : '#3b82f6'}`,
                        padding: '0.8rem', borderRadius: '4px' 
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                          <strong style={{ fontSize: '0.9rem' }}>{anom.rule_id}</strong>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                            {anom.file}:{anom.line}
                          </span>
                        </div>
                        <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>{anom.description}</p>
                        <pre style={{ margin: 0, padding: '0.5rem', background: '#000', borderRadius: '4px', overflowX: 'auto', fontSize: '0.85rem' }}>
                          <code>{anom.code_snippet}</code>
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#10b981' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✨</div>
                  <p>Aucune anomalie détectée dans l'architecture ou le code.</p>
                </div>
              )}
            </>
          )}
        </div>
        <div style={{ marginTop: '1rem', textAlign: 'right' }}>
          <button className="btn-primary" onClick={fetchAudit} style={{ padding: '0.5rem 1rem' }}>
            Rafraîchir
          </button>
        </div>
      </div>
    </div>
  );
}
