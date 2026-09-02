/**
 * GujRaksha (ગુજ રક્ષા) — Database Initial Seed Definitions
 * Copyright (c) 2026 Fenil Patel. All Rights Reserved.
 *
 * Direct database seeding models and dynamic camera dataset loader.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../');
const CAMERAS_JSON_PATH = path.join(PROJECT_ROOT, 'data/cameras.json');

export const initialDepartments = [
  {
    "code": "AGRICULTURE",
    "name": "Agriculture & Farmers Welfare (APMC)",
    "nodal_officer": "Director of Agricultural Marketing",
    "contact_email": "agri.cctv@gujarat.gov.in",
    "contact_phone": "+91 79 2325 6000",
    "color": "#84cc16",
    "created_at": "2026-08-26T08:49:26.071Z",
    "updated_at": "2026-08-26T08:49:26.071Z"
  },
  {
    "code": "CIVIL_SUPPLIES",
    "name": "Food, Civil Supplies & Consumer Affairs",
    "nodal_officer": "Director of Civil Supplies / Storage Division",
    "contact_email": "civilsupplies.cctv@gujarat.gov.in",
    "contact_phone": "+91 79 2325 1066",
    "color": "#fbbf24",
    "created_at": "2026-08-26T08:49:26.034Z",
    "updated_at": "2026-08-26T08:49:26.034Z"
  },
  {
    "code": "EDUCATION",
    "name": "Education Department (GSEB / Colleges)",
    "nodal_officer": "Director of Higher Education / Examination Controller",
    "contact_email": "education.cctv@gujarat.gov.in",
    "contact_phone": "+91 79 2325 1301",
    "color": "#a855f7",
    "created_at": "2026-08-26T08:49:26.051Z",
    "updated_at": "2026-08-26T08:49:26.051Z"
  },
  {
    "code": "ENERGY",
    "name": "Energy & Petrochemicals Department",
    "nodal_officer": "Chief Electrical Inspector / Grid Security",
    "contact_email": "energy.cctv@gujarat.gov.in",
    "contact_phone": "+91 79 2325 0701",
    "color": "#e11d48",
    "created_at": "2026-08-26T08:49:26.056Z",
    "updated_at": "2026-08-26T08:49:26.056Z"
  },
  {
    "code": "FINANCE",
    "name": "Finance & State Tax Department (GST)",
    "nodal_officer": "Chief Commissioner of State Tax",
    "contact_email": "finance.cctv@gujarat.gov.in",
    "contact_phone": "+91 79 2325 0501",
    "color": "#16a34a",
    "created_at": "2026-08-26T08:49:26.090Z",
    "updated_at": "2026-08-26T08:49:26.090Z"
  },
  {
    "code": "FOREST",
    "name": "Forests & Environment Department",
    "nodal_officer": "Principal Chief Conservator of Forests (Wildlife)",
    "contact_email": "forest.cctv@gujarat.gov.in",
    "contact_phone": "+91 79 2325 4125",
    "color": "#34d399",
    "created_at": "2026-08-26T08:49:26.045Z",
    "updated_at": "2026-08-26T08:49:26.045Z"
  },
  {
    "code": "GENERAL_ADMIN",
    "name": "General Administration Department (GAD)",
    "nodal_officer": "Chief Security Officer (Sachivalaya Complex)",
    "contact_email": "gad.cctv@gujarat.gov.in",
    "contact_phone": "+91 79 2325 0300",
    "color": "#475569",
    "created_at": "2026-08-26T08:49:26.092Z",
    "updated_at": "2026-08-26T08:49:26.092Z"
  },
  {
    "code": "GSDMA",
    "name": "Gujarat State Disaster Management Authority",
    "nodal_officer": "Emergency Operations Center Director",
    "contact_email": "gsdma.cctv@gujarat.gov.in",
    "contact_phone": "+91 79 2325 9220",
    "color": "#ef4444",
    "created_at": "2026-08-26T08:49:26.068Z",
    "updated_at": "2026-08-26T08:49:26.068Z"
  },
  {
    "code": "HEALTH",
    "name": "Health & Family Welfare Department",
    "nodal_officer": "Additional Director (Medical Infrastructure)",
    "contact_email": "health.cctv@gujarat.gov.in",
    "contact_phone": "+91 79 2325 0801",
    "color": "#ec4899",
    "created_at": "2026-08-26T08:49:26.048Z",
    "updated_at": "2026-08-26T08:49:26.048Z"
  },
  {
    "code": "HOME",
    "name": "Home Department / Gujarat Police",
    "nodal_officer": "DGP / DIG State Command & Control Center",
    "contact_email": "police.surveillance@gujarat.gov.in",
    "contact_phone": "+91 79 2325 0000",
    "color": "#f87171",
    "created_at": "2026-08-26T08:49:26.027Z",
    "updated_at": "2026-08-26T08:49:26.027Z"
  },
  {
    "code": "INDUSTRIES",
    "name": "Industries & Mines (GIDC)",
    "nodal_officer": "Managing Director (GIDC Infrastructure)",
    "contact_email": "gidc.cctv@gujarat.gov.in",
    "contact_phone": "+91 79 2325 2501",
    "color": "#64748b",
    "created_at": "2026-08-26T08:49:26.059Z",
    "updated_at": "2026-08-26T08:49:26.059Z"
  },
  {
    "code": "LABOUR",
    "name": "Labour, Skill Development & Employment",
    "nodal_officer": "Director of Employment & Training (DET)",
    "contact_email": "labour.cctv@gujarat.gov.in",
    "contact_phone": "+91 79 2325 3900",
    "color": "#6366f1",
    "created_at": "2026-08-26T08:49:26.077Z",
    "updated_at": "2026-08-26T08:49:26.077Z"
  },
  {
    "code": "LEGAL",
    "name": "Legal Department & Judiciary",
    "nodal_officer": "Registrar (Infrastructure - High Court of Gujarat)",
    "contact_email": "legal.cctv@gujarat.gov.in",
    "contact_phone": "+91 79 2325 2100",
    "color": "#7c3aed",
    "created_at": "2026-08-26T08:49:26.095Z",
    "updated_at": "2026-08-26T08:49:26.095Z"
  },
  {
    "code": "PANCHAYAT",
    "name": "Panchayats & Rural Development",
    "nodal_officer": "Development Commissioner (Rural Surveillance)",
    "contact_email": "panchayat.cctv@gujarat.gov.in",
    "contact_phone": "+91 79 2325 3300",
    "color": "#14b8a6",
    "created_at": "2026-08-26T08:49:26.074Z",
    "updated_at": "2026-08-26T08:49:26.074Z"
  },
  {
    "code": "PORTS",
    "name": "Gujarat Maritime Board & Ports",
    "nodal_officer": "Chief Port Officer / Maritime Security",
    "contact_email": "gmb.surveillance@gujarat.gov.in",
    "contact_phone": "+91 79 2323 8346",
    "color": "#22d3ee",
    "created_at": "2026-08-26T08:49:26.036Z",
    "updated_at": "2026-08-26T08:49:26.036Z"
  },
  {
    "code": "PRIVATE_FEED",
    "name": "Private Commercial & Society Feeder",
    "nodal_officer": "Gujarat Police Public-Private CCTV Integration Cell",
    "contact_email": "private.cctv@sentinelgujarat.in",
    "contact_phone": "+91 79 2325 9999",
    "color": "#8b5cf6",
    "created_at": "2026-08-26T08:49:26.101Z",
    "updated_at": "2026-08-26T08:49:26.101Z"
  },
  {
    "code": "REVENUE",
    "name": "Revenue Department",
    "nodal_officer": "Revenue Inspection Commissioner",
    "contact_email": "revenue.cctv@gujarat.gov.in",
    "contact_phone": "+91 79 2325 1501",
    "color": "#eab308",
    "created_at": "2026-08-26T08:49:26.054Z",
    "updated_at": "2026-08-26T08:49:26.054Z"
  },
  {
    "code": "ROADS_BUILDINGS",
    "name": "Roads & Buildings Department (R&B)",
    "nodal_officer": "Chief Engineer (State Highways & Bridges)",
    "contact_email": "rnb.cctv@gujarat.gov.in",
    "contact_phone": "+91 79 2325 1801",
    "color": "#f97316",
    "created_at": "2026-08-26T08:49:26.042Z",
    "updated_at": "2026-08-26T08:49:26.042Z"
  },
  {
    "code": "SCIENCE_TECH",
    "name": "Science & Technology (GIL / Science City)",
    "nodal_officer": "Managing Director (Gujarat Informatics Ltd)",
    "contact_email": "dst.cctv@gujarat.gov.in",
    "contact_phone": "+91 79 2325 0301",
    "color": "#0284c7",
    "created_at": "2026-08-26T08:49:26.087Z",
    "updated_at": "2026-08-26T08:49:26.087Z"
  },
  {
    "code": "SOCIAL_JUSTICE",
    "name": "Social Justice & Empowerment",
    "nodal_officer": "Director of Social Defense",
    "contact_email": "socialjustice.cctv@gujarat.gov.in",
    "contact_phone": "+91 79 2325 3200",
    "color": "#d946ef",
    "created_at": "2026-08-26T08:49:26.080Z",
    "updated_at": "2026-08-26T08:49:26.080Z"
  },
  {
    "code": "SPORTS_YOUTH",
    "name": "Sports, Youth & Cultural Activities",
    "nodal_officer": "Director General (Sports Authority of Gujarat)",
    "contact_email": "sports.cctv@gujarat.gov.in",
    "contact_phone": "+91 79 2325 8000",
    "color": "#f59e0b",
    "created_at": "2026-08-26T08:49:26.085Z",
    "updated_at": "2026-08-26T08:49:26.085Z"
  },
  {
    "code": "TOURISM",
    "name": "Tourism & Pilgrimage Development",
    "nodal_officer": "Director of Tourism Infrastructure",
    "contact_email": "tourism.cctv@gujarat.gov.in",
    "contact_phone": "+91 79 2322 2517",
    "color": "#10b981",
    "created_at": "2026-08-26T08:49:26.064Z",
    "updated_at": "2026-08-26T08:49:26.064Z"
  },
  {
    "code": "TRANSPORT",
    "name": "Transport Department / RTO Gujarat",
    "nodal_officer": "Transport Commissioner / RTO Surveillance Head",
    "contact_email": "rto.cctv@gujarat.gov.in",
    "contact_phone": "+91 79 2325 1361",
    "color": "#38bdf8",
    "created_at": "2026-08-26T08:49:26.030Z",
    "updated_at": "2026-08-26T08:49:26.030Z"
  },
  {
    "code": "TRIBAL_DEV",
    "name": "Tribal Development Department",
    "nodal_officer": "Commissioner of Tribal Development",
    "contact_email": "tribal.cctv@gujarat.gov.in",
    "contact_phone": "+91 79 2325 3600",
    "color": "#0d9488",
    "created_at": "2026-08-26T08:49:26.098Z",
    "updated_at": "2026-08-26T08:49:26.098Z"
  },
  {
    "code": "URBAN_DEV",
    "name": "Urban Development & Municipal Corporations",
    "nodal_officer": "Chief Urban Planner / ICCC Operations Head",
    "contact_email": "urbandev.cctv@gujarat.gov.in",
    "contact_phone": "+91 79 2325 0901",
    "color": "#818cf8",
    "created_at": "2026-08-26T08:49:26.039Z",
    "updated_at": "2026-08-26T08:49:26.039Z"
  },
  {
    "code": "WATER_RESOURCES",
    "name": "Water Resources & Narmada Water Supply",
    "nodal_officer": "Chief Engineer (Narmada Project Surveillance)",
    "contact_email": "water.cctv@gujarat.gov.in",
    "contact_phone": "+91 79 2325 1601",
    "color": "#06b6d4",
    "created_at": "2026-08-26T08:49:26.061Z",
    "updated_at": "2026-08-26T08:49:26.061Z"
  },
  {
    "code": "WOMEN_CHILD",
    "name": "Women & Child Development",
    "nodal_officer": "Commissioner of Women and Child Welfare",
    "contact_email": "wcd.cctv@gujarat.gov.in",
    "contact_phone": "+91 79 2325 7900",
    "color": "#f43f5e",
    "created_at": "2026-08-26T08:49:26.082Z",
    "updated_at": "2026-08-26T08:49:26.082Z"
  }
];

function loadInitialCameras() {
  try {
    if (fs.existsSync(CAMERAS_JSON_PATH)) {
      const raw = fs.readFileSync(CAMERAS_JSON_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {}
  return [];
}

export const initialCameras = loadInitialCameras();

export const initialWatchlist = [
  {
    "id": "wl-1787656966583",
    "vehicle_plate": "HR-98-AA-0000",
    "category": "STOLEN_VEHICLE",
    "fir_number": "t",
    "police_station": "State Police Surveillance Cell",
    "owner_name": "Under Investigation",
    "priority": "CRITICAL",
    "status": "ACTIVE",
    "description": "Flagged in statewide CCTV police watchlist.",
    "created_at": "2026-08-25T11:22:46.583Z"
  },
  {
    "id": "wl-1787647839738",
    "vehicle_plate": "GJ-01-HW-8888",
    "category": "STOLEN_VEHICLE",
    "fir_number": "FIR #502/2026",
    "police_station": "SG Highway PS",
    "owner_name": "Under Investigation",
    "priority": "CRITICAL",
    "status": "ACTIVE",
    "description": "Flagged in statewide CCTV police watchlist.",
    "created_at": "2026-08-25T08:50:39.738Z"
  },
  {
    "id": "wl-1787303333857",
    "vehicle_plate": "GJ-01-AA-1234",
    "category": "STOLEN_VEHICLE",
    "fir_number": "FIR01",
    "police_station": "ahmedabad",
    "owner_name": "Under Investigation",
    "priority": "CRITICAL",
    "status": "ACTIVE",
    "description": "Flagged in statewide CCTV police watchlist.",
    "created_at": "2026-08-21T09:08:53.857Z"
  }
];


export const initialDetections = [];
