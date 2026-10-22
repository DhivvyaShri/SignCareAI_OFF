import React, { useState } from 'react';
import { 
  AlertCircle, 
  Check, 
  ChevronRight, 
  Edit3, 
  HelpCircle, 
  Info, 
  RotateCcw, 
  Sliders, 
  Trash2, 
  User, 
  X 
} from 'lucide-react';

// Anatomical region definitions
export const ANATOMICAL_REGIONS = [
  { id: 'head_face', name: 'Head and Face', view: 'front', bilateral: false, group: 'Head/Neck' },
  { id: 'neck', name: 'Neck', view: 'both', bilateral: false, group: 'Head/Neck' },
  { id: 'left_shoulder', name: 'Left Shoulder', view: 'both', bilateral: true, side: 'Left', group: 'Upper Limbs' },
  { id: 'right_shoulder', name: 'Right Shoulder', view: 'both', bilateral: true, side: 'Right', group: 'Upper Limbs' },
  { id: 'chest', name: 'Chest', view: 'front', bilateral: false, group: 'Torso' },
  { id: 'abdomen', name: 'Abdomen', view: 'front', bilateral: false, group: 'Torso' },
  { id: 'upper_back', name: 'Upper Back', view: 'back', bilateral: false, group: 'Back' },
  { id: 'lower_back', name: 'Lower Back', view: 'back', bilateral: false, group: 'Back' },
  { id: 'pelvis', name: 'Pelvic Region', view: 'front', bilateral: false, group: 'Torso' },
  { id: 'left_upper_arm', name: 'Left Upper Arm', view: 'both', bilateral: true, side: 'Left', group: 'Upper Limbs' },
  { id: 'right_upper_arm', name: 'Right Upper Arm', view: 'both', bilateral: true, side: 'Right', group: 'Upper Limbs' },
  { id: 'left_forearm', name: 'Left Forearm', view: 'both', bilateral: true, side: 'Left', group: 'Upper Limbs' },
  { id: 'right_forearm', name: 'Right Forearm', view: 'both', bilateral: true, side: 'Right', group: 'Upper Limbs' },
  { id: 'left_hand', name: 'Left Hand', view: 'both', bilateral: true, side: 'Left', group: 'Upper Limbs' },
  { id: 'right_hand', name: 'Right Hand', view: 'both', bilateral: true, side: 'Right', group: 'Upper Limbs' },
  { id: 'left_hip', name: 'Left Hip', view: 'both', bilateral: true, side: 'Left', group: 'Lower Limbs' },
  { id: 'right_hip', name: 'Right Hip', view: 'both', bilateral: true, side: 'Right', group: 'Lower Limbs' },
  { id: 'left_thigh', name: 'Left Thigh', view: 'both', bilateral: true, side: 'Left', group: 'Lower Limbs' },
  { id: 'right_thigh', name: 'Right Thigh', view: 'both', bilateral: true, side: 'Right', group: 'Lower Limbs' },
  { id: 'left_knee', name: 'Left Knee', view: 'both', bilateral: true, side: 'Left', group: 'Lower Limbs' },
  { id: 'right_knee', name: 'Right Knee', view: 'both', bilateral: true, side: 'Right', group: 'Lower Limbs' },
  { id: 'left_lower_leg', name: 'Left Lower Leg', view: 'both', bilateral: true, side: 'Left', group: 'Lower Limbs' },
  { id: 'right_lower_leg', name: 'Right Lower Leg', view: 'both', bilateral: true, side: 'Right', group: 'Lower Limbs' },
  { id: 'left_ankle', name: 'Left Ankle', view: 'both', bilateral: true, side: 'Left', group: 'Lower Limbs' },
  { id: 'right_ankle', name: 'Right Ankle', view: 'both', bilateral: true, side: 'Right', group: 'Lower Limbs' },
  { id: 'left_foot', name: 'Left Foot', view: 'both', bilateral: true, side: 'Left', group: 'Lower Limbs' },
  { id: 'right_foot', name: 'Right Foot', view: 'both', bilateral: true, side: 'Right', group: 'Lower Limbs' }
];

const PAIN_TYPES = [
  'Aching', 'Sharp', 'Burning', 'Throbbing', 'Pressure / Heavy', 
  'Stabbing', 'Cramping', 'Pins and Needles', 'Other / Unable to describe'
];

const ONSET_DURATIONS = [
  'Started today (Sudden)', '1 - 3 days', 'About a week', 
  '2 - 4 weeks', '1 - 6 months', 'Longer than 6 months (Chronic)', 'Unknown / Unsure'
];

export default function BodyPainMap({ selectedPainRegions = [], onChange }) {
  const [activeTab, setActiveTab] = useState('front'); // 'front' | 'back'
  const [editingRegion, setEditingRegion] = useState(null);
  const [accessibleSelectId, setAccessibleSelectId] = useState('');

  // Temporary state for the region modal
  const [regionForm, setRegionForm] = useState({
    id: '',
    name: '',
    side: 'Both', // Left, Right, Both, Central
    intensity: 5,
    onset: '1 - 3 days',
    painType: 'Aching',
    pattern: 'Constant', // Constant or Intermittent
    notes: '',
    discussWithDoctor: true,
    unableToDescribe: false
  });

  const getIntensityColor = (intensity) => {
    if (intensity <= 2) return '#10b981'; // Green (Mild)
    if (intensity <= 5) return '#f59e0b'; // Amber (Moderate)
    if (intensity <= 8) return '#f97316'; // Orange (Severe)
    return '#ef4444'; // Red (Very Severe)
  };

  const isSelected = (regionId) => {
    return selectedPainRegions.some(p => p.id === regionId);
  };

  const getRegionRecord = (regionId) => {
    return selectedPainRegions.find(p => p.id === regionId);
  };

  const openRegionEditor = (region) => {
    const existing = getRegionRecord(region.id);
    if (existing) {
      setRegionForm({ ...existing });
    } else {
      setRegionForm({
        id: region.id,
        name: region.name,
        side: region.side || (region.bilateral ? 'Right' : 'Central'),
        intensity: 5,
        onset: '1 - 3 days',
        painType: 'Aching',
        pattern: 'Constant',
        notes: '',
        discussWithDoctor: true,
        unableToDescribe: false
      });
    }
    setEditingRegion(region);
  };

  const saveRegionDetails = () => {
    if (!regionForm.id) return;
    const filtered = selectedPainRegions.filter(p => p.id !== regionForm.id);
    const updated = [...filtered, { ...regionForm }];
    onChange(updated);
    setEditingRegion(null);
  };

  const removeRegion = (regionId) => {
    const updated = selectedPainRegions.filter(p => p.id !== regionId);
    onChange(updated);
  };

  const handleAccessibleSelect = (e) => {
    const id = e.target.value;
    setAccessibleSelectId(id);
    if (!id) return;
    const region = ANATOMICAL_REGIONS.find(r => r.id === id);
    if (region) {
      openRegionEditor(region);
    }
  };

  return (
    <div className="pain-map-container" aria-label="Interactive Human Body Pain Map">
      {/* Header & View Switcher */}
      <div className="pain-map-header">
        <div>
          <h4 className="pain-map-title">Interactive Anatomy Pain Locator</h4>
          <p className="pain-map-subtitle">Click or tap any painful body area to record intensity, type, and duration.</p>
        </div>
        <div className="pain-view-toggle" role="group" aria-label="Body view switch">
          <button 
            type="button"
            className={`view-btn ${activeTab === 'front' ? 'active' : ''}`}
            onClick={() => setActiveTab('front')}
            aria-pressed={activeTab === 'front'}
          >
            Front View
          </button>
          <button 
            type="button"
            className={`view-btn ${activeTab === 'back' ? 'active' : ''}`}
            onClick={() => setActiveTab('back')}
            aria-pressed={activeTab === 'back'}
          >
            Back View
          </button>
        </div>
      </div>

      {/* Accessible Text Fallback Selector */}
      <div className="accessible-selector-box">
        <label htmlFor="body-region-select" className="accessible-label">
          <Info size={14} /> Screen Reader / Keyboard Alternative: Select body area
        </label>
        <div className="selector-row">
          <select 
            id="body-region-select"
            value={accessibleSelectId}
            onChange={handleAccessibleSelect}
            className="accessible-select"
          >
            <option value="">-- Choose a body region to report pain --</option>
            {ANATOMICAL_REGIONS.map(reg => (
              <option key={reg.id} value={reg.id}>
                {reg.name} {isSelected(reg.id) ? '✓ (Reported)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Grid: Anatomy Diagram + Selected Summary */}
      <div className="pain-map-grid">
        {/* SVG Diagram Stage */}
        <div className="body-silhouette-card">
          <div className="diagram-stage-badge">
            {activeTab === 'front' ? 'ANTERIOR (FRONT)' : 'POSTERIOR (BACK)'}
          </div>

          <svg 
            viewBox="0 0 320 540" 
            className="anatomy-svg" 
            role="region" 
            aria-label={`${activeTab === 'front' ? 'Front' : 'Back'} human body diagram`}
          >
            <defs>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0e766b" floodOpacity="0.4" />
              </filter>
            </defs>

            {/* Neutral Body Base Contour Silhouette */}
            <g className="base-silhouette" opacity="0.18" fill="#182b31">
              {/* Head */}
              <ellipse cx="160" cy="45" rx="32" ry="40" />
              {/* Neck */}
              <rect x="148" y="82" width="24" height="24" rx="4" />
              {/* Torso */}
              <path d="M 112 106 L 208 106 L 200 240 L 120 240 Z" />
              {/* Pelvis */}
              <path d="M 120 240 L 200 240 L 206 280 L 114 280 Z" />
              {/* Left Arm (viewer right for front, viewer left for back) */}
              <path d="M 108 108 L 84 122 L 68 210 L 88 214 L 102 140 Z" />
              <circle cx="60" cy="235" r="14" />
              {/* Right Arm */}
              <path d="M 212 108 L 236 122 L 252 210 L 232 214 L 218 140 Z" />
              <circle cx="260" cy="235" r="14" />
              {/* Left Leg */}
              <path d="M 122 280 L 154 280 L 148 400 L 122 400 Z" />
              <path d="M 124 402 L 146 402 L 142 505 L 122 505 Z" />
              <path d="M 114 505 L 144 505 L 146 525 L 108 525 Z" />
              {/* Right Leg */}
              <path d="M 166 280 L 198 280 L 198 400 L 172 400 Z" />
              <path d="M 174 402 L 196 402 L 198 505 L 178 505 Z" />
              <path d="M 176 505 L 206 505 L 212 525 L 174 525 Z" />
            </g>

            {/* Interactive Anatomical Regions */}
            {activeTab === 'front' ? (
              <g className="front-regions">
                {/* 1. Head & Face */}
                <ellipse 
                  cx="160" cy="45" rx="30" ry="38"
                  className={`region-node ${isSelected('head_face') ? 'selected' : ''}`}
                  fill={isSelected('head_face') ? getIntensityColor(getRegionRecord('head_face')?.intensity) : '#cbd5e1'}
                  tabIndex="0"
                  role="button"
                  aria-label="Head and Face"
                  aria-pressed={isSelected('head_face')}
                  onClick={() => openRegionEditor(ANATOMICAL_REGIONS.find(r => r.id === 'head_face'))}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openRegionEditor(ANATOMICAL_REGIONS.find(r => r.id === 'head_face'))}
                />
                <text x="160" y="49" textAnchor="middle" className="region-text">Head</text>

                {/* 2. Neck */}
                <rect 
                  x="148" y="84" width="24" height="22" rx="4"
                  className={`region-node ${isSelected('neck') ? 'selected' : ''}`}
                  fill={isSelected('neck') ? getIntensityColor(getRegionRecord('neck')?.intensity) : '#cbd5e1'}
                  tabIndex="0"
                  role="button"
                  aria-label="Neck"
                  aria-pressed={isSelected('neck')}
                  onClick={() => openRegionEditor(ANATOMICAL_REGIONS.find(r => r.id === 'neck'))}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openRegionEditor(ANATOMICAL_REGIONS.find(r => r.id === 'neck'))}
                />

                {/* 3. Left Shoulder (patient's left = viewer's right) */}
                <path 
                  d="M 198 108 L 228 116 L 224 140 L 196 130 Z"
                  className={`region-node ${isSelected('left_shoulder') ? 'selected' : ''}`}
                  fill={isSelected('left_shoulder') ? getIntensityColor(getRegionRecord('left_shoulder')?.intensity) : '#cbd5e1'}
                  tabIndex="0"
                  role="button"
                  aria-label="Left Shoulder"
                  aria-pressed={isSelected('left_shoulder')}
                  onClick={() => openRegionEditor(ANATOMICAL_REGIONS.find(r => r.id === 'left_shoulder'))}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openRegionEditor(ANATOMICAL_REGIONS.find(r => r.id === 'left_shoulder'))}
                />

                {/* 4. Right Shoulder (patient's right = viewer's left) */}
                <path 
                  d="M 122 108 L 92 116 L 96 140 L 124 130 Z"
                  className={`region-node ${isSelected('right_shoulder') ? 'selected' : ''}`}
                  fill={isSelected('right_shoulder') ? getIntensityColor(getRegionRecord('right_shoulder')?.intensity) : '#cbd5e1'}
                  tabIndex="0"
                  role="button"
                  aria-label="Right Shoulder"
                  aria-pressed={isSelected('right_shoulder')}
                  onClick={() => openRegionEditor(ANATOMICAL_REGIONS.find(r => r.id === 'right_shoulder'))}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openRegionEditor(ANATOMICAL_REGIONS.find(r => r.id === 'right_shoulder'))}
                />

                {/* 5. Chest */}
                <rect 
                  x="126" y="112" width="68" height="56" rx="6"
                  className={`region-node ${isSelected('chest') ? 'selected' : ''}`}
                  fill={isSelected('chest') ? getIntensityColor(getRegionRecord('chest')?.intensity) : '#cbd5e1'}
                  tabIndex="0"
                  role="button"
                  aria-label="Chest"
                  aria-pressed={isSelected('chest')}
                  onClick={() => openRegionEditor(ANATOMICAL_REGIONS.find(r => r.id === 'chest'))}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openRegionEditor(ANATOMICAL_REGIONS.find(r => r.id === 'chest'))}
                />
                <text x="160" y="144" textAnchor="middle" className="region-text">Chest</text>

                {/* 6. Abdomen */}
                <rect 
                  x="126" y="174" width="68" height="60" rx="6"
                  className={`region-node ${isSelected('abdomen') ? 'selected' : ''}`}
                  fill={isSelected('abdomen') ? getIntensityColor(getRegionRecord('abdomen')?.intensity) : '#cbd5e1'}
                  tabIndex="0"
                  role="button"
                  aria-label="Abdomen"
                  aria-pressed={isSelected('abdomen')}
                  onClick={() => openRegionEditor(ANATOMICAL_REGIONS.find(r => r.id === 'abdomen'))}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openRegionEditor(ANATOMICAL_REGIONS.find(r => r.id === 'abdomen'))}
                />
                <text x="160" y="208" textAnchor="middle" className="region-text">Abdomen</text>

                {/* 7. Pelvis */}
                <path 
                  d="M 124 238 L 196 238 L 202 276 L 118 276 Z"
                  className={`region-node ${isSelected('pelvis') ? 'selected' : ''}`}
                  fill={isSelected('pelvis') ? getIntensityColor(getRegionRecord('pelvis')?.intensity) : '#cbd5e1'}
                  tabIndex="0"
                  role="button"
                  aria-label="Pelvic Region"
                  aria-pressed={isSelected('pelvis')}
                  onClick={() => openRegionEditor(ANATOMICAL_REGIONS.find(r => r.id === 'pelvis'))}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && openRegionEditor(ANATOMICAL_REGIONS.find(r => r.id === 'pelvis'))}
                />
                <text x="160" y="260" textAnchor="middle" className="region-text">Pelvis</text>

                {/* 8. Upper Arms */}
                <rect 
                  x="78" y="142" width="22" height="48" rx="5" transform="rotate(8 89 166)"
                  className={`region-node ${isSelected('right_upper_arm') ? 'selected' : ''}`}
                  fill={isSelected('right_upper_arm') ? getIntensityColor(getRegionRecord('right_upper_arm')?.intensity) : '#cbd5e1'}
                  tabIndex="0"
                  role="button"
                  aria-label="Right Upper Arm"
                  onClick={() => openRegionEditor(ANATOMICAL_REGIONS.find(r => r.id === 'right_upper_arm'))}
                />
                <rect 
                  x="220" y="142" width="22" height="48" rx="5" transform="rotate(-8 231 166)"
                  className={`region-node ${isSelected('left_upper_arm') ? 'selected' : ''}`}
                  fill={isSelected('left_upper_arm') ? getIntensityColor(getRegionRecord('left_upper_arm')?.intensity) : '#cbd5e1'}
                  tabIndex="0"
                  role="button"
                  aria-label="Left Upper Arm"
                  onClick={() => openRegionEditor(ANATOMICAL_REGIONS.find(r => r.id === 'left_upper_arm'))}
                />

                {/* 9. Forearms */}
                <rect 
                  x="68" y="196" width="20" height="42" rx="4" transform="rotate(10 78 217)"
                  className={`region-node ${isSelected('right_forearm') ? 'selected' : ''}`}
                  fill={isSelected('right_forearm') ? getIntensityColor(getRegionRecord('right_forearm')?.intensity) : '#cbd5e1'}
                  tabIndex="0"
                  role="button"
                  aria-label="Right Forearm"
                  onClick={() => openRegionEditor(ANATOMICAL_REGIONS.find(r => r.id === 'right_forearm'))}
                />
                <rect 
                  x="232" y="196" width="20" height="42" rx="4" transform="rotate(-10 242 217)"
                  className={`region-node ${isSelected('left_forearm') ? 'selected' : ''}`}
                  fill={isSelected('left_forearm') ? getIntensityColor(getRegionRecord('left_forearm')?.intensity) : '#cbd5e1'}
                  tabIndex="0"
                  role="button"
                  aria-label="Left Forearm"
                  onClick={() => openRegionEditor(ANATOMICAL_REGIONS.find(r => r.id === 'left_forearm'))}
                />

                {/* 10. Hands */}
                <circle 
                  cx="58" cy="254" r="14"
                  className={`region-node ${isSelected('right_hand') ? 'selected' : ''}`}
                  fill={isSelected('right_hand') ? getIntensityColor(getRegionRecord('right_hand')?.intensity) : '#cbd5e1'}
                  tabIndex="0"
                  role="button"
                  aria-label="Right Hand"
                  onClick={() => openRegionEditor(ANATOMICAL_REGIONS.find(r => r.id === 'right_hand'))}
                />
                <circle 
                  cx="262" cy="254" r="14"
                  className={`region-node ${isSelected('left_hand') ? 'selected' : ''}`}
                  fill={isSelected('left_hand') ? getIntensityColor(getRegionRecord('left_hand')?.intensity) : '#cbd5e1'}
                  tabIndex="0"
                  role="button"
                  aria-label="Left Hand"
                  onClick={() => openRegionEditor(ANATOMICAL_REGIONS.find(r => r.id === 'left_hand'))}
                />

                {/* 11. Hips */}
                <ellipse 
                  cx="120" cy="292" rx="14" ry="12"
                  className={`region-node ${isSelected('right_hip') ? 'selected' : ''}`}
                  fill={isSelected('right_hip') ? getIntensityColor(getRegionRecord('right_hip')?.intensity) : '#cbd5e1'}
                  tabIndex="0"
                  role="button"
                  aria-label="Right Hip"
                  onClick={() => openRegionEditor(ANATOMICAL_REGIONS.find(r => r.id === 'right_hip'))}
                />
                <ellipse 
                  cx="200" cy="292" rx="14" ry="12"
                  className={`region-node ${isSelected('left_hip') ? 'selected' : ''}`}
                  fill={isSelected('left_hip') ? getIntensityColor(getRegionRecord('left_hip')?.intensity) : '#cbd5e1'}
                  tabIndex="0"
                  role="button"
                  aria-label="Left Hip"
                  onClick={() => openRegionEditor(ANATOMICAL_REGIONS.find(r => r.id === 'left_hip'))}
                />

                {/* 12. Thighs */}
                <rect 
                  x="124" y="312" width="28" height="68" rx="6"
                  className={`region-node ${isSelected('right_thigh') ? 'selected' : ''}`}
                  fill={isSelected('right_thigh') ? getIntensityColor(getRegionRecord('right_thigh')?.intensity) : '#cbd5e1'}
                  tabIndex="0"
                  role="button"
                  aria-label="Right Thigh"
                  onClick={() => openRegionEditor(ANATOMICAL_REGIONS.find(r => r.id === 'right_thigh'))}
                />
                <rect 
                  x="168" y="312" width="28" height="68" rx="6"
                  className={`region-node ${isSelected('left_thigh') ? 'selected' : ''}`}
                  fill={isSelected('left_thigh') ? getIntensityColor(getRegionRecord('left_thigh')?.intensity) : '#cbd5e1'}
                  tabIndex="0"
                  role="button"
                  aria-label="Left Thigh"
                  onClick={() => openRegionEditor(ANATOMICAL_REGIONS.find(r => r.id === 'left_thigh'))}
                />

                {/* 13. Knees */}
                <circle 
                  cx="138" cy="392" r="12"
                  className={`region-node ${isSelected('right_knee') ? 'selected' : ''}`}
                  fill={isSelected('right_knee') ? getIntensityColor(getRegionRecord('right_knee')?.intensity) : '#cbd5e1'}
                  tabIndex="0"
                  role="button"
                  aria-label="Right Knee"
                  onClick={() => openRegionEditor(ANATOMICAL_REGIONS.find(r => r.id === 'right_knee'))}
                />
                <circle 
                  cx="182" cy="392" r="12"
                  className={`region-node ${isSelected('left_knee') ? 'selected' : ''}`}
                  fill={isSelected('left_knee') ? getIntensityColor(getRegionRecord('left_knee')?.intensity) : '#cbd5e1'}
                  tabIndex="0"
                  role="button"
                  aria-label="Left Knee"
                  onClick={() => openRegionEditor(ANATOMICAL_REGIONS.find(r => r.id === 'left_knee'))}
                />

                {/* 14. Lower Legs */}
                <rect 
                  x="126" y="410" width="24" height="68" rx="5"
                  className={`region-node ${isSelected('right_lower_leg') ? 'selected' : ''}`}
                  fill={isSelected('right_lower_leg') ? getIntensityColor(getRegionRecord('right_lower_leg')?.intensity) : '#cbd5e1'}
                  tabIndex="0"
                  role="button"
                  aria-label="Right Lower Leg"
                  onClick={() => openRegionEditor(ANATOMICAL_REGIONS.find(r => r.id === 'right_lower_leg'))}
                />
                <rect 
                  x="170" y="410" width="24" height="68" rx="5"
                  className={`region-node ${isSelected('left_lower_leg') ? 'selected' : ''}`}
                  fill={isSelected('left_lower_leg') ? getIntensityColor(getRegionRecord('left_lower_leg')?.intensity) : '#cbd5e1'}
                  tabIndex="0"
                  role="button"
                  aria-label="Left Lower Leg"
                  onClick={() => openRegionEditor(ANATOMICAL_REGIONS.find(r => r.id === 'left_lower_leg'))}
                />

                {/* 15. Ankles */}
                <rect 
                  x="126" y="482" width="24" height="14" rx="3"
                  className={`region-node ${isSelected('right_ankle') ? 'selected' : ''}`}
                  fill={isSelected('right_ankle') ? getIntensityColor(getRegionRecord('right_ankle')?.intensity) : '#cbd5e1'}
                  tabIndex="0"
                  role="button"
                  aria-label="Right Ankle"
                  onClick={() => openRegionEditor(ANATOMICAL_REGIONS.find(r => r.id === 'right_ankle'))}
                />
                <rect 
                  x="170" y="482" width="24" height="14" rx="3"
                  className={`region-node ${isSelected('left_ankle') ? 'selected' : ''}`}
                  fill={isSelected('left_ankle') ? getIntensityColor(getRegionRecord('left_ankle')?.intensity) : '#cbd5e1'}
                  tabIndex="0"
                  role="button"
                  aria-label="Left Ankle"
                  onClick={() => openRegionEditor(ANATOMICAL_REGIONS.find(r => r.id === 'left_ankle'))}
                />

                {/* 16. Feet */}
                <path 
                  d="M 122 500 L 152 500 L 150 524 L 112 524 Z"
                  className={`region-node ${isSelected('right_foot') ? 'selected' : ''}`}
                  fill={isSelected('right_foot') ? getIntensityColor(getRegionRecord('right_foot')?.intensity) : '#cbd5e1'}
                  tabIndex="0"
                  role="button"
                  aria-label="Right Foot"
                  onClick={() => openRegionEditor(ANATOMICAL_REGIONS.find(r => r.id === 'right_foot'))}
                />
                <path 
                  d="M 168 500 L 198 500 L 208 524 L 170 524 Z"
                  className={`region-node ${isSelected('left_foot') ? 'selected' : ''}`}
                  fill={isSelected('left_foot') ? getIntensityColor(getRegionRecord('left_foot')?.intensity) : '#cbd5e1'}
                  tabIndex="0"
                  role="button"
                  aria-label="Left Foot"
                  onClick={() => openRegionEditor(ANATOMICAL_REGIONS.find(r => r.id === 'left_foot'))}
                />
              </g>
            ) : (
              /* Back View */
              <g className="back-regions">
                {/* Head (Back) */}
                <ellipse 
                  cx="160" cy="45" rx="30" ry="38"
                  className={`region-node ${isSelected('head_face') ? 'selected' : ''}`}
                  fill={isSelected('head_face') ? getIntensityColor(getRegionRecord('head_face')?.intensity) : '#cbd5e1'}
                  tabIndex="0"
                  role="button"
                  aria-label="Back of Head"
                  onClick={() => openRegionEditor(ANATOMICAL_REGIONS.find(r => r.id === 'head_face'))}
                />
                <text x="160" y="49" textAnchor="middle" className="region-text">Back Head</text>

                {/* Neck */}
                <rect 
                  x="148" y="84" width="24" height="22" rx="4"
                  className={`region-node ${isSelected('neck') ? 'selected' : ''}`}
                  fill={isSelected('neck') ? getIntensityColor(getRegionRecord('neck')?.intensity) : '#cbd5e1'}
                  tabIndex="0"
                  role="button"
                  aria-label="Neck"
                  onClick={() => openRegionEditor(ANATOMICAL_REGIONS.find(r => r.id === 'neck'))}
                />

                {/* Upper Back */}
                <rect 
                  x="124" y="112" width="72" height="64" rx="6"
                  className={`region-node ${isSelected('upper_back') ? 'selected' : ''}`}
                  fill={isSelected('upper_back') ? getIntensityColor(getRegionRecord('upper_back')?.intensity) : '#cbd5e1'}
                  tabIndex="0"
                  role="button"
                  aria-label="Upper Back"
                  onClick={() => openRegionEditor(ANATOMICAL_REGIONS.find(r => r.id === 'upper_back'))}
                />
                <text x="160" y="148" textAnchor="middle" className="region-text">Upper Back</text>

                {/* Lower Back */}
                <rect 
                  x="124" y="182" width="72" height="60" rx="6"
                  className={`region-node ${isSelected('lower_back') ? 'selected' : ''}`}
                  fill={isSelected('lower_back') ? getIntensityColor(getRegionRecord('lower_back')?.intensity) : '#cbd5e1'}
                  tabIndex="0"
                  role="button"
                  aria-label="Lower Back"
                  onClick={() => openRegionEditor(ANATOMICAL_REGIONS.find(r => r.id === 'lower_back'))}
                />
                <text x="160" y="216" textAnchor="middle" className="region-text">Lower Back</text>

                {/* Shoulders (Back) */}
                <path 
                  d="M 122 108 L 92 116 L 96 140 L 124 130 Z"
                  className={`region-node ${isSelected('left_shoulder') ? 'selected' : ''}`}
                  fill={isSelected('left_shoulder') ? getIntensityColor(getRegionRecord('left_shoulder')?.intensity) : '#cbd5e1'}
                  tabIndex="0"
                  role="button"
                  aria-label="Left Shoulder (Back)"
                  onClick={() => openRegionEditor(ANATOMICAL_REGIONS.find(r => r.id === 'left_shoulder'))}
                />
                <path 
                  d="M 198 108 L 228 116 L 224 140 L 196 130 Z"
                  className={`region-node ${isSelected('right_shoulder') ? 'selected' : ''}`}
                  fill={isSelected('right_shoulder') ? getIntensityColor(getRegionRecord('right_shoulder')?.intensity) : '#cbd5e1'}
                  tabIndex="0"
                  role="button"
                  aria-label="Right Shoulder (Back)"
                  onClick={() => openRegionEditor(ANATOMICAL_REGIONS.find(r => r.id === 'right_shoulder'))}
                />

                {/* Legs (Back) */}
                <rect 
                  x="124" y="312" width="28" height="68" rx="6"
                  className={`region-node ${isSelected('left_thigh') ? 'selected' : ''}`}
                  fill={isSelected('left_thigh') ? getIntensityColor(getRegionRecord('left_thigh')?.intensity) : '#cbd5e1'}
                  tabIndex="0"
                  role="button"
                  aria-label="Left Thigh (Back)"
                  onClick={() => openRegionEditor(ANATOMICAL_REGIONS.find(r => r.id === 'left_thigh'))}
                />
                <rect 
                  x="168" y="312" width="28" height="68" rx="6"
                  className={`region-node ${isSelected('right_thigh') ? 'selected' : ''}`}
                  fill={isSelected('right_thigh') ? getIntensityColor(getRegionRecord('right_thigh')?.intensity) : '#cbd5e1'}
                  tabIndex="0"
                  role="button"
                  aria-label="Right Thigh (Back)"
                  onClick={() => openRegionEditor(ANATOMICAL_REGIONS.find(r => r.id === 'right_thigh'))}
                />

                <rect 
                  x="126" y="410" width="24" height="68" rx="5"
                  className={`region-node ${isSelected('left_lower_leg') ? 'selected' : ''}`}
                  fill={isSelected('left_lower_leg') ? getIntensityColor(getRegionRecord('left_lower_leg')?.intensity) : '#cbd5e1'}
                  tabIndex="0"
                  role="button"
                  aria-label="Left Calf / Lower Leg"
                  onClick={() => openRegionEditor(ANATOMICAL_REGIONS.find(r => r.id === 'left_lower_leg'))}
                />
                <rect 
                  x="170" y="410" width="24" height="68" rx="5"
                  className={`region-node ${isSelected('right_lower_leg') ? 'selected' : ''}`}
                  fill={isSelected('right_lower_leg') ? getIntensityColor(getRegionRecord('right_lower_leg')?.intensity) : '#cbd5e1'}
                  tabIndex="0"
                  role="button"
                  aria-label="Right Calf / Lower Leg"
                  onClick={() => openRegionEditor(ANATOMICAL_REGIONS.find(r => r.id === 'right_lower_leg'))}
                />
              </g>
            )}
          </svg>

          {/* Pain Severity Scale Legend */}
          <div className="pain-scale-legend">
            <span className="legend-title">Pain Severity Scale:</span>
            <div className="legend-items">
              <span className="legend-tag" style={{ background: '#10b981' }}>0-2 Mild</span>
              <span className="legend-tag" style={{ background: '#f59e0b' }}>3-5 Moderate</span>
              <span className="legend-tag" style={{ background: '#f97316' }}>6-8 Severe</span>
              <span className="legend-tag" style={{ background: '#ef4444' }}>9-10 Very Severe</span>
            </div>
          </div>
        </div>

        {/* Selected Regions Summary & Card List */}
        <div className="pain-summary-panel">
          <div className="summary-header-row">
            <h5>Selected Pain Areas ({selectedPainRegions.length})</h5>
            {selectedPainRegions.length > 0 && (
              <button 
                type="button" 
                className="clear-all-btn"
                onClick={() => onChange([])}
              >
                Clear all
              </button>
            )}
          </div>

          {selectedPainRegions.length === 0 ? (
            <div className="no-pain-selected">
              <User size={32} className="muted-icon" />
              <p>No pain locations selected yet.</p>
              <small>Tap regions on the body diagram or select from the dropdown above.</small>
            </div>
          ) : (
            <div className="pain-region-cards">
              {selectedPainRegions.map((region) => (
                <div key={region.id} className="pain-region-card">
                  <div className="card-top">
                    <span 
                      className="intensity-pill" 
                      style={{ background: getIntensityColor(region.intensity) }}
                    >
                      {region.intensity} / 10
                    </span>
                    <b className="card-region-name">{region.name}</b>
                    {region.side && region.side !== 'Central' && (
                      <span className="side-badge">{region.side} Side</span>
                    )}
                    <div className="card-actions">
                      <button 
                        type="button" 
                        onClick={() => openRegionEditor(ANATOMICAL_REGIONS.find(r => r.id === region.id) || region)}
                        className="action-icon-btn"
                        title="Edit details"
                      >
                        <Edit3 size={15} />
                      </button>
                      <button 
                        type="button" 
                        onClick={() => removeRegion(region.id)}
                        className="action-icon-btn delete"
                        title="Remove"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  <div className="card-body-details">
                    <div className="detail-item">
                      <span>Type:</span> <b>{region.painType || 'Aching'}</b>
                    </div>
                    <div className="detail-item">
                      <span>Onset:</span> <b>{region.onset || 'Recent'}</b>
                    </div>
                    <div className="detail-item">
                      <span>Pattern:</span> <b>{region.pattern || 'Constant'}</b>
                    </div>
                    {region.notes && (
                      <div className="region-note-snippet">
                        <em>"{region.notes}"</em>
                      </div>
                    )}
                    {region.discussWithDoctor && (
                      <div className="discuss-tag">
                        <Check size={12} /> Discuss with doctor
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Clinical Non-Diagnosis Safety Notice */}
          <div className="pain-disclaimer-box">
            <AlertCircle size={15} className="warning-icon" />
            <div>
              <b>Medical Notice</b>
              <p>Pain location and ratings are recorded for patient-clinician communication only. This system does not diagnose medical conditions.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Pain Region Details Modal */}
      {editingRegion && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-region-title">
          <div className="pain-details-modal">
            <div className="modal-header">
              <h3 id="modal-region-title">Pain Details: {regionForm.name}</h3>
              <button 
                type="button" 
                onClick={() => setEditingRegion(null)} 
                className="close-modal-btn"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-scroll-body">
              {/* Bilateral / Side Selection */}
              {editingRegion.bilateral && (
                <div className="form-group">
                  <label className="input-label">Side of Body Affected:</label>
                  <div className="radio-pill-group">
                    {['Left', 'Right', 'Both'].map(side => (
                      <button
                        type="button"
                        key={side}
                        className={`radio-pill ${regionForm.side === side ? 'active' : ''}`}
                        onClick={() => setRegionForm({ ...regionForm, side })}
                      >
                        {side} Side
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Pain Intensity Slider 0 - 10 */}
              <div className="form-group">
                <div className="slider-label-row">
                  <label htmlFor="pain-slider" className="input-label">
                    Pain Intensity (0 to 10):
                  </label>
                  <span 
                    className="slider-value-badge"
                    style={{ background: getIntensityColor(regionForm.intensity) }}
                  >
                    {regionForm.intensity} - {
                      regionForm.intensity === 0 ? 'No Pain' :
                      regionForm.intensity <= 2 ? 'Mild' :
                      regionForm.intensity <= 5 ? 'Moderate' :
                      regionForm.intensity <= 8 ? 'Severe' : 'Very Severe'
                    }
                  </span>
                </div>
                <input 
                  id="pain-slider"
                  type="range"
                  min="0"
                  max="10"
                  step="1"
                  value={regionForm.intensity}
                  onChange={(e) => setRegionForm({ ...regionForm, intensity: parseInt(e.target.value, 10) })}
                  className="intensity-range-slider"
                />
                <div className="range-ticks">
                  <span>0 None</span>
                  <span>2 Mild</span>
                  <span>5 Moderate</span>
                  <span>8 Severe</span>
                  <span>10 Worst</span>
                </div>
              </div>

              {/* Pain Type */}
              <div className="form-group">
                <label className="input-label">Pain Character / Type:</label>
                <div className="chip-selector-grid">
                  {PAIN_TYPES.map(type => (
                    <button
                      type="button"
                      key={type}
                      className={`chip-btn ${regionForm.painType === type ? 'active' : ''}`}
                      onClick={() => setRegionForm({ ...regionForm, painType: type })}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Duration / Onset */}
              <div className="form-group">
                <label htmlFor="onset-select" className="input-label">How long has this pain been present?</label>
                <select 
                  id="onset-select"
                  value={regionForm.onset}
                  onChange={(e) => setRegionForm({ ...regionForm, onset: e.target.value })}
                  className="form-select"
                >
                  {ONSET_DURATIONS.map(dur => (
                    <option key={dur} value={dur}>{dur}</option>
                  ))}
                </select>
              </div>

              {/* Constant vs Intermittent */}
              <div className="form-group">
                <label className="input-label">Pattern:</label>
                <div className="radio-pill-group">
                  <button
                    type="button"
                    className={`radio-pill ${regionForm.pattern === 'Constant' ? 'active' : ''}`}
                    onClick={() => setRegionForm({ ...regionForm, pattern: 'Constant' })}
                  >
                    Constant (Always there)
                  </button>
                  <button
                    type="button"
                    className={`radio-pill ${regionForm.pattern === 'Intermittent' ? 'active' : ''}`}
                    onClick={() => setRegionForm({ ...regionForm, pattern: 'Intermittent' })}
                  >
                    Intermittent (Comes and goes)
                  </button>
                </div>
              </div>

              {/* Patient Notes */}
              <div className="form-group">
                <label htmlFor="region-notes" className="input-label">Additional notes about this pain (optional):</label>
                <textarea 
                  id="region-notes"
                  rows={2}
                  placeholder="e.g. hurts more when moving, worse in morning, tingling sensation..."
                  value={regionForm.notes}
                  onChange={(e) => setRegionForm({ ...regionForm, notes: e.target.value })}
                  className="form-textarea"
                />
              </div>

              {/* Discuss With Doctor Checkbox */}
              <div className="checkbox-row">
                <input 
                  type="checkbox"
                  id="discuss-check"
                  checked={regionForm.discussWithDoctor}
                  onChange={(e) => setRegionForm({ ...regionForm, discussWithDoctor: e.target.checked })}
                />
                <label htmlFor="discuss-check">Highlight this pain for consultation with doctor</label>
              </div>

              {/* Unable to describe toggle */}
              <div className="checkbox-row">
                <input 
                  type="checkbox"
                  id="unable-check"
                  checked={regionForm.unableToDescribe}
                  onChange={(e) => setRegionForm({ 
                    ...regionForm, 
                    unableToDescribe: e.target.checked,
                    painType: e.target.checked ? 'Other / Unable to describe' : regionForm.painType 
                  })}
                />
                <label htmlFor="unable-check">Unable to describe further / unsure of details</label>
              </div>
            </div>

            <div className="modal-footer">
              <button 
                type="button" 
                className="secondary-btn" 
                onClick={() => setEditingRegion(null)}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="primary-btn" 
                onClick={saveRegionDetails}
              >
                Save Pain Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

