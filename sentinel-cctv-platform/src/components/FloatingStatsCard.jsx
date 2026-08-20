import React from 'react';

export const FloatingStatsCard = ({ cameras }) => {
  const totalCount = cameras.length;
  const activeCount = cameras.filter(c => c.status === 'ACTIVE').length;

  return (
    <div className="floating-stats-card">
      <div className="stat-item">
        <i className="fa-solid fa-video" style={{ color: 'var(--accent-gold)' }}></i>
        <div>
          <div className="stat-val" style={{ color: 'var(--accent-gold)' }}>{totalCount}</div>
          <div className="stat-lbl">Cameras</div>
        </div>
      </div>

      <div className="stat-item">
        <i className="fa-solid fa-circle-check" style={{ color: '#22c55e' }}></i>
        <div>
          <div className="stat-val" style={{ color: '#22c55e' }}>{activeCount}</div>
          <div className="stat-lbl">Active SLA</div>
        </div>
      </div>
    </div>
  );
};
