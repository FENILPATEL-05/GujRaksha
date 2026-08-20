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
    // Group by Department
    const departmentMap = {};

    cameras.forEach(c => {
      const d = c.district || 'Unassigned';
      districtMap[d] = (districtMap[d] || 0) + 1;

      const dept = c.department_name || c.department_id || 'Other';
      departmentMap[dept] = (departmentMap[dept] || 0) + 1;
    });

    const majorDistricts = ['Gandhinagar', 'Ahmedabad', 'Surat', 'Rajkot', 'Vadodara', 'Jamnagar', 'Dwarka', 'Kutch', 'Valsad', 'Dahod'];
    const gapDistricts = majorDistricts.map(dist => {
      const count = districtMap[dist] || 0;
      let coverageStatus = 'OPTIMAL';
      let recommendation = 'Coverage meets baseline requirements.';

      if (count === 0) {
        coverageStatus = 'CRITICAL_GAP';
        recommendation = 'Zero onboarded cameras detected. Urgent deployment required.';
      } else if (count < 4) {
        coverageStatus = 'LOW_DENSITY';
        recommendation = 'Sub-optimal camera density. Recommend onboarding 10+ additional surveillance nodes.';
      }

      return {
        district: dist,
        onboardedCount: count,
        coverageStatus: coverageStatus,
        recommendation: recommendation
      };
    });

    return {
      timestamp: new Date().toISOString(),
      summary: {
        totalOnboarded: total,
        activeSlaCount: active,
        maintenanceCount: maintenance,
        offlineCount: offline,
        uptimePercentage: total > 0 ? ((active / total) * 100).toFixed(1) + '%' : '0%'
      },
      departmentDistribution: departmentMap,
      districtDistribution: districtMap,
      districtGapAnalysis: gapDistricts
    };
  }
}

module.exports = new GapAnalysisService();
