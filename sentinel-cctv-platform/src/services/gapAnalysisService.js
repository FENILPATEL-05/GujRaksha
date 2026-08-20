const db = require('../db/pool');

class GapAnalysisService {
  generateReport() {
    const cameras = db.getAll({});
    const total = cameras.length;
    const active = cameras.filter(c => c.status === 'ACTIVE').length;
    const maintenance = cameras.filter(c => c.status === 'MAINTENANCE').length;
    const offline = cameras.filter(c => c.status === 'OFFLINE').length;

    // Group by District
    const districtMap = {};
    const departmentMap = {};

    cameras.forEach(c => {
      const d = c.district || 'Unassigned';
      districtMap[d] = (districtMap[d] || 0) + 1;

      const dept = c.department_name || c.department_id || 'Other';
      departmentMap[dept] = (departmentMap[dept] || 0) + 1;
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
      timestamp: new Date().toISOString(),
      summary: {
        totalCameras: total,
        totalOnboarded: total,
        activeSlaCount: active,
        maintenanceCount: maintenance,
        offlineCount: offline,
        districtCoverage: Object.keys(districtMap).length,
        uptimePercentage: total > 0 ? ((active / total) * 100).toFixed(1) + '%' : '0%'
      },
      departmentDistribution: departmentMap,
      districtDistribution: districtMap,
      districtGapAnalysis: gapDistricts,
      highPriorityGaps: highPriorityGaps
    };
  }
}

module.exports = new GapAnalysisService();
