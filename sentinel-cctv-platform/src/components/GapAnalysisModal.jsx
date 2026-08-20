import React, { useState, useEffect } from 'react';

export const GapAnalysisModal = ({ isOpen, onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetch('/api/v1/analytics/gap-analysis')
        .then(res => res.json())
        .then(json => {
          if (json.success) setData(json.data);
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card-3d modal-lg">
        <div className="modal-header">
          <h3><i className="fa-solid fa-chart-line"></i> Gujarat Police Spatial Gap Analysis & Coverage Report</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          {loading || !data ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '2rem', color: 'var(--accent-gold)' }}></i>
              <div style={{ marginTop: '12px', color: 'var(--text-sub)' }}>Computing statewide spatial gap analysis metrics...</div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
                <div style={{ background: 'var(--bg-card)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--accent-gold)' }}>{data.summary.totalCameras}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>REGISTERED NODES</div>
                </div>
                <div style={{ background: 'var(--bg-card)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#22c55e' }}>{data.summary.activeSlaCount}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ACTIVE ONLINE</div>
                </div>
                <div style={{ background: 'var(--bg-card)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0284c7' }}>{data.summary.districtCoverage}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>DISTRICTS COVERED</div>
                </div>
                <div style={{ background: 'var(--bg-card)', padding: '14px', borderRadius: '10px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#ef4444' }}>{data.highPriorityGaps.length}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>PRIORITY GAPS</div>
                </div>
              </div>

              <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--accent-gold)', marginBottom: '10px' }}>
                <i className="fa-solid fa-triangle-exclamation"></i> High Priority Surveillance Coverage Gaps
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {data.highPriorityGaps.map((gap, i) => (
                  <div key={i} style={{ background: 'var(--bg-card)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.88rem' }}>{gap.region}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>{gap.gapType}</div>
                    </div>
                    <span className="badge-police-red">{gap.urgency}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
