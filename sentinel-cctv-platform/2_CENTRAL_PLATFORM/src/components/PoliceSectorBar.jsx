import React from 'react';
import { Navigation, Compass, Shield, MapPin, Building, Waves, Flame, Crosshair } from 'lucide-react';

export const POLICE_SECTORS = [
  { id: 'all', name: 'All Gujarat', coords: [22.35, 71.0], zoom: 7, icon: Compass, tag: 'STATE' },
  { id: 'ahmedabad', name: 'Ahmedabad S.G. Hwy', coords: [23.0225, 72.5714], zoom: 13, icon: Building, tag: 'URBAN-1' },
  { id: 'gandhinagar', name: 'Gandhinagar Capital', coords: [23.2156, 72.6369], zoom: 13, icon: Shield, tag: 'GOV-HQ' },
  { id: 'surat', name: 'Surat Diamond Ring', coords: [21.1702, 72.8311], zoom: 13, icon: Building, tag: 'URBAN-2' },
  { id: 'vadodara', name: 'Vadodara Express', coords: [22.3072, 73.1812], zoom: 13, icon: MapPin, tag: 'CORRIDOR' },
  { id: 'rajkot', name: 'Rajkot Smart Hub', coords: [22.3039, 70.8022], zoom: 13, icon: Crosshair, tag: 'JUNCTION' },
  { id: 'kutch', name: 'Kutch Border Post', coords: [23.1000, 70.0500], zoom: 12, icon: Shield, tag: 'BORDER' },
  { id: 'somnath', name: 'Somnath Coastal Belt', coords: [20.8880, 70.4012], zoom: 13, icon: Waves, tag: 'COASTAL' },
  { id: 'navsari', name: 'Navsari Highway', coords: [20.8500, 72.9300], zoom: 13, icon: MapPin, tag: 'SOUTH' }
];

export const PoliceSectorBar = ({ activeSector, onSelectSector }) => {
  return (
    <div className="police-sector-toolbar">
      <div className="sector-toolbar-label">
        <Navigation size={13} strokeWidth={2.4} style={{ color: 'var(--accent)' }} />
        <span>POLICE SURVEILLANCE SECTORS:</span>
      </div>

      <div className="sector-chips-scroll">
        {POLICE_SECTORS.map(sec => {
          const Icon = sec.icon;
          const isActive = activeSector === sec.id;
          return (
            <button
              key={sec.id}
              className={`sector-chip ${isActive ? 'active' : ''}`}
              onClick={() => onSelectSector(sec)}
              title={`Jump map view to ${sec.name}`}
            >
              <Icon size={12} strokeWidth={2.2} />
              <span className="sec-name">{sec.name}</span>
              <span className="sec-tag">{sec.tag}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
