import React from 'react';

export const FloatingStatsCard = ({ cameras }) => {
  const totalCount = cameras.length;
  const activeCount = cameras.filter(c => c.status === 'ACTIVE').length;
  const offlineCount = cameras.filter(c => c.status === 'OFFLINE').length;

  return (
    <div className="floating stats-card">
      <div className="stat-item">
        <div className="num" id="statTotal">{totalCount}</div>
        <div className="lbl">Total</div>
      </div>
      <div className="stat-divider"></div>
      <div className="stat-item active">
        <div className="num" id="statActive">{activeCount}</div>
        <div className="lbl">Active</div>
      </div>
      <div className="stat-divider"></div>
      <div className="stat-item offline">
        <div className="num" id="statOffline">{offlineCount}</div>
        <div className="lbl">Offline</div>
      </div>
    </div>
  );
};
