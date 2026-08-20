import React, { useState, useEffect, useMemo } from 'react';
import { PieChart, X, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';

export const GapAnalysisModal = ({ isOpen, onClose, cameras = [] }) => {
  const [apiData, setApiData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetch('/api/v1/analytics/gap-analysis')
        .then(res => res.json())
        .then(json => {
          if (json && json.success && json.data) {
            setApiData(json.data);
          }
        })
        .catch(err => console.warn('Gap analysis endpoint fetch error:', err))
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  // Client-side instant computation fallback
  const computedData = useMemo(() => {
    const total = cameras.length;
    const active = cameras.filter(c => c.status === 'ACTIVE').length;
    const maintenance = cameras.filter(c => c.status === 'MAINTENANCE').length;
    const offline = cameras.filter(c => c.status === 'OFFLINE').length;

    const districtMap = {};
    cameras.forEach(c => {
      const d = c.district || 'Unassigned';
      districtMap[d] = (districtMap[d] || 0) + 1;
    });

    const majorDistricts = ['Gandhinagar', 'Ahmedabad', 'Surat', 'Rajkot', 'Vadodara', 'Jamnagar', 'Dwarka', 'Kutch', 'Valsad', 'Dahod', 'Navsari', 'Patan', 'Gir Somnath', 'Junagadh', 'Bhavnagar', 'Mehsana'];
    const gapDistricts = majorDistricts.map(dist => {
      const count = districtMap[dist] || 0;
      let coverageStatus = 'OPTIMAL';
      let urgency = 'MONITORED';
      let recommendation = 'Optimal surveillance density established.';

      if (count === 0) {
        coverageStatus = 'CRITICAL_GAP';
        urgency = 'CRITICAL';
        recommendation = 'Zero onboarded cameras detected. Urgent deployment required.';
      } else if (count < 3) {
        coverageStatus = 'LOW_DENSITY';
        urgency = 'HIGH PRIORITY';
        recommendation = 'Sub-optimal camera density. Recommend onboarding 6+ additional nodes.';
      }

      return {
        district: dist,
        region: `${dist} Surveillance Sector`,
        gapType: recommendation,
        urgency: urgency,
        onboardedCount: count,
        coverageStatus: coverageStatus
      };
    });

    const highPriorityGaps = gapDistricts.filter(g => g.coverageStatus !== 'OPTIMAL');

    return {
      summary: {
        totalCameras: total,
        totalOnboarded: total,
        activeSlaCount: active,
        maintenanceCount: maintenance,
        offlineCount: offline,
        districtCoverage: Object.keys(districtMap).length,
        uptimePercentage: total > 0 ? ((active / total) * 100).toFixed(1) + '%' : '0%'
      },
      highPriorityGaps: highPriorityGaps
    };
  }, [cameras]);

  if (!isOpen) return null;

  const data = apiData || computedData;
  const summary = data?.summary || { totalCameras: cameras.length, activeSlaCount: 0, districtCoverage: 0, uptimePercentage: '0%' };
  const highPriorityGaps = data?.highPriorityGaps || [];

  return (
    <div className="modal-overlay">
      <div className="modal modal-lg">
        <div className="modal-head">
          <h3><PieChart size={16} strokeWidth={2.2} style={{ color: 'var(--accent)' }} /> Spatial Gap Analysis & Coverage Report</h3>
          <button className="modal-close" onClick={onClose}><X size={16} strokeWidth={2.2} /></button>
        </div>
        <div className="modal-body">
          {loading && !apiData && cameras.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Loader2 size={36} strokeWidth={1.8} style={{ color: 'var(--accent)', margin: '0 auto 12px', animation: 'radarSpin 1.2s linear infinite' }} />
              <div style={{ color: 'var(--text-secondary)' }}>Computing statewide spatial gap analysis metrics...</div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '18px' }}>
                <div style={{ background: 'var(--input-bg)', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--panel-border)', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>{summary.totalCameras ?? summary.totalOnboarded ?? cameras.length}</div>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: '2px' }}>REGISTERED NODES</div>
                </div>
                <div style={{ background: 'var(--input-bg)', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--panel-border)', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--success)', fontFamily: 'var(--font-display)' }}>{summary.activeSlaCount ?? 0}</div>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: '2px' }}>ACTIVE ONLINE</div>
                </div>
                <div style={{ background: 'var(--input-bg)', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--panel-border)', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-2)', fontFamily: 'var(--font-display)' }}>{summary.districtCoverage ?? 0}</div>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: '2px' }}>DISTRICTS COVERED</div>
                </div>
                <div style={{ background: 'var(--input-bg)', padding: '12px 14px', borderRadius: '10px', border: '1px solid var(--panel-border)', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--danger)', fontFamily: 'var(--font-display)' }}>{highPriorityGaps.length}</div>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: '2px' }}>PRIORITY GAPS</div>
                </div>
              </div>

              <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={15} strokeWidth={2.2} style={{ color: 'var(--warning)' }} /> High Priority Surveillance Coverage Gaps
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {highPriorityGaps.length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', padding: '20px', textAlign: 'center', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <CheckCircle2 size={16} strokeWidth={2} /> Full statewide surveillance coverage achieved across all monitored sectors.
                  </div>
                ) : (
                  highPriorityGaps.map((gap, i) => (
                    <div key={i} style={{ background: 'var(--input-bg)', padding: '10px 14px', borderRadius: '10px', border: '1px solid var(--panel-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '12.5px' }}>{gap.region}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>{gap.gapType}</div>
                      </div>
                      <span className={`badge ${gap.urgency === 'CRITICAL' ? 'offline' : 'maintenance'}`} style={{ whiteSpace: 'nowrap', marginLeft: '8px' }}>
                        {gap.urgency}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
