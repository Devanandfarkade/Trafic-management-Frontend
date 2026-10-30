import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Fingerprint,
  ShieldAlert,
  Camera as CameraIcon,
  Video,
  MapPin,
  Clock,
  User,
  Users,
  AlertTriangle,
  CheckCircle2,
  Eye,
  RefreshCw,
  Search,
  Filter,
  Maximize,
  Minimize,
  Settings,
  Pencil,
  AlertOctagon,
  Bell,
  Sparkles,
  Radio,
  FileText,
  Sliders,
  Download,
  ExternalLink,
  ShieldCheck,
  Grid,
  MonitorPlay,
  ArrowRight,
  Play,
  Square,
  RotateCcw,
  Wifi,
  WifiOff,
  Database,
  Activity,
  Server
} from 'lucide-react';
import { useTheme } from '../../ui/Settings/themeUtils';
import { useToast } from '../../ui/common/CustomToast';
import BottomStatCard from '../../ui/common/BottomStatCard';
import ModuleLayout from '../../ui/layout/ModuleLayout';
import PaginatedTable from '../../ui/common/PaginatedTable';
import RightSideDialog from '../../ui/common/RightSideDialog';
import SearchBar from '../../ui/common/SearchBar';
import DateRangePicker from '../../ui/common/DateRangePicker';
import Pagination from '../../ui/common/Pagination';
import RecordsPerPage from '../../ui/common/RecordsPerPage';
import useCameraFilter from '../../hooks/useCameraFilter';
import CameraSettingsDrawer from '../../ui/common/CameraSettingsDrawer';
import LiveCameraCard from '../LiveMonitoring/LiveCameraCard';
import { resolveCameraDetails } from '../../utils/cameraUtils';
import { getTodayStr, toLocalDateStr } from '../../utils/dateUtils';
import { API_BASE_URL, API_CONFIG } from '../../../config.js';
import useCriminalDetectionStream from '../../hooks/useCriminalDetectionStream';

// Crime Categories matching CriminalRegistration
const CRIME_CATEGORIES = [
  'Wanted Criminal',
  'Robbery / Theft',
  'Assault & Battery',
  'Narcotics / Drug Trafficking',
  'Fraud / Cyber Crime',
  'Homicide / Severe Offense',
  'Traffic & Hit-and-Run',
  'Kidnapping',
  'Suspicious Activity',
  'Other Offense'
];

const SEVERITY_CONFIG = {
  Critical: { color: 'text-red-500', bg: 'bg-red-500/20', border: 'border-red-500/40', badgeBg: 'bg-red-500' },
  High: { color: 'text-orange-500', bg: 'bg-orange-500/20', border: 'border-orange-500/40', badgeBg: 'bg-orange-500' },
  Medium: { color: 'text-yellow-500', bg: 'bg-yellow-500/20', border: 'border-yellow-500/40', badgeBg: 'bg-yellow-500' },
  Low: { color: 'text-blue-500', bg: 'bg-blue-500/20', border: 'border-blue-500/40', badgeBg: 'bg-blue-500' }
};

const STATIC_AADHAR_LIST = [
  '894230198421',
  '782349102834',
  '912304891238',
  '682390145892',
  '541290384712',
  '439120984123',
  '781290348192',
  '901238471928',
  '673412908451',
  '341298457102'
];

export const formatAadharDisplay = (rawAadhar, index = 0) => {
  const clean = rawAadhar && typeof rawAadhar === 'string' ? rawAadhar.replace(/\D/g, '') : '';
  const aadhar = (clean.length === 12) ? clean : STATIC_AADHAR_LIST[index % STATIC_AADHAR_LIST.length];
  return `${aadhar.slice(0, 4)} ${aadhar.slice(4, 8)} ${aadhar.slice(8, 12)}`;
};



export const getMediaUrl = (mediaPath) => {
  if (!mediaPath) return null;
  if (mediaPath.startsWith('http://') || mediaPath.startsWith('https://') || mediaPath.startsWith('data:') || mediaPath.startsWith('blob:')) {
    return mediaPath;
  }
  const clean = mediaPath.startsWith('/') ? mediaPath.slice(1) : mediaPath;
  return `${API_BASE_URL}/${clean}`;
};

export const normalizeDetection = (d) => {
  if (!d) return null;
  // Parse detection timestamp accurately from detected_at, detection_time, or created_at
  const rawTimestamp = d.detected_at || d.detection_time || d.createdAt || d.created_at;
  const dTime = rawTimestamp ? new Date(rawTimestamp) : new Date();
  const isValidDate = !isNaN(dTime.getTime());

  const detTimeStr = isValidDate
    ? dTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
    : (d.time || '—');

  const detDateStr = isValidDate
    ? dTime.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

  const detIdNum = d.rawDetectionId || d.detection_id || d.id || 1;
  const detCode = d.detectionId || `DET-${String(detIdNum).padStart(4, '0')}`;

  let fName = d.firstName || d.first_name || '';
  let lName = d.lastName || d.last_name || '';
  if (!fName && (d.detectedName || d.detected_name)) {
    const parts = (d.detectedName || d.detected_name).trim().split(/\s+/);
    fName = parts[0] || 'Suspect';
    lName = parts.slice(1).join(' ');
  }
  if (!fName) fName = 'Suspect';

  // 1. Official Registration Photo
  const regPhoto = d.registered_photo || d.registered_photo_path || d.reg_photo_path || null;

  // 2. Surveillance Intercept (Cropped Face)
  const faceImg = d.face_image || d.mugshot || d.live_mugshot || d.mugshot_path || d.photo || null;

  // 3. Full Camera Scene Annotated Snapshot
  const snapImg = d.snapshot || d.snapshot_path || null;

  // 4. Recorded Detection Video (STRICTLY detection video, NEVER registration video)
  const detVid = d.video || d.video_path || null;

  return {
    id: d.rawDetectionId || d.detection_id || d.id || detIdNum,
    rawDetectionId: d.rawDetectionId || d.detection_id || d.id || detIdNum,
    clientDetectionId: d.clientDetectionId || null,
    detectionId: detCode,
    criminalId: d.criminalId || d.criminal_record_code || (d.criminal_id ? `CR-${String(d.criminal_id).padStart(4, '0')}` : 'UNMATCHED'),
    firstName: fName,
    lastName: lName,
    aliases: d.aliases || d.detected_alias || '',
    gender: d.gender || 'Unknown',
    age: d.age || '—',
    crimeCategory: d.crimeCategory || d.category_name || 'Wanted Criminal',
    crimeCategoryId: d.crimeCategoryId || d.crime_category_id,
    severity: d.severity || d.severity_name || 'Critical',
    severityId: d.severityId || d.severity_id,
    location: d.location || d.location_name || '',
    zone: d.zone || d.zone_name || '',
    camera: d.camera || d.camera_name || (d.cameraId || d.camera_id ? `CAM-${d.cameraId || d.camera_id}` : ''),
    cameraId: d.cameraId || d.camera_id || '',
    aadharNumber: d.aadhaarNumber || d.aadhaar_number || d.aadharNumber || '',
    nationalId: d.nationalId || d.national_id || 'XXXX-XXXX-9021',
    idMarks: d.idMarks || d.identification_marks || '',
    confidence: d.confidence !== undefined ? Number(d.confidence) : (d.match_confidence !== undefined ? Number(d.match_confidence) : 95.0),
    status: d.status ? d.status.toUpperCase() : (d.status_name ? d.status_name.toUpperCase() : (d.isMatched || d.is_matched ? 'ALERT TRIGGERED' : 'UNVERIFIED')),
    statusId: d.statusId || d.status_id || 1,
    detected_at: isValidDate ? dTime.toISOString() : new Date().toISOString(),
    detection_time: isValidDate ? dTime.toISOString() : new Date().toISOString(),
    time: detTimeStr,
    date: detDateStr,
    notes: d.notes || (d.isMatched || d.is_matched ? 'Real-time biometric face match confirmed against criminal database' : 'Unmatched suspicious suspect detected on live feed'),
    rawCriminalId: d.rawCriminalId || d.criminal_id || null,

    // Media fields
    face_image: getMediaUrl(faceImg),
    mugshot: getMediaUrl(faceImg),
    photo: getMediaUrl(faceImg || snapImg || regPhoto),
    snapshot: getMediaUrl(snapImg || faceImg),
    snapshot_path: d.snapshot_path || null,
    registered_photo: getMediaUrl(regPhoto),
    registered_photo_path: regPhoto,
    reg_photo_path: regPhoto,
    video: getMediaUrl(detVid),
    video_path: detVid,
    registered_video: getMediaUrl(d.registered_video || d.reg_video_path || null),
    reg_video_path: d.registered_video || d.reg_video_path || null,
    awaiting_clip: Boolean(d.awaiting_clip),
    is_matched: d.isMatched ?? d.is_matched ?? true
  };
};

export default function CriminalDetection() {
  const { theme, themeUtils } = useTheme();
  const toast = useToast();
  const isDark = theme.mode === 'Dark';

  const textPrimary = themeUtils.getTextColor(true);
  const textSecondary = themeUtils.getTextColor(false);
  const borderColor = themeUtils.getBorderColor();
  const cardBg = themeUtils.getBgColor('card');
  const activeBg = isDark ? `${theme.headerBg}35` : `${theme.headerBg}18`;
  const themeColor = theme.headerBg || '#3b82f6';

  // Camera Filter Hook - Fetch zones, locations, and cameras mapped to criminal detection
  const cameraFilter = useCameraFilter('criminal_detection');
  const camerasList = cameraFilter?.availableOptions?.cameras || [];
  const selectedCamera = cameraFilter?.selectedCamera;

  // View Mode: 'grid' (Multi-Camera Live AI Surveillance Grid) or 'focused' (Single Live AI Stream + Threat Feed)
  const [viewMode, setViewMode] = useState('grid');
  const [isMaximized, setIsMaximized] = useState(false);
  const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState(false);

  // Close fullscreen on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isMaximized) {
        setIsMaximized(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMaximized]);

  // Time & Date format for bottom KPI cards
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formattedTime = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
  const formattedDate = currentTime.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  // Watchlist Records loaded from Criminal Registration backend API
  const [registeredCriminals, setRegisteredCriminals] = useState([]);
  const [dbMeta, setDbMeta] = useState({ categories: [], severities: [], statuses: [] });
  const [isLoading, setIsLoading] = useState(false);

  // Detection Events State - backed by PostgreSQL database
  const [detections, setDetections] = useState([]);

  // Fetch all detections from PostgreSQL
  const fetchDetections = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/criminal-detection`);
      const data = await res.json();
      if (data.success && Array.isArray(data.detections)) {
        const normalized = data.detections.map(normalizeDetection);
        setDetections(normalized);
      }
    } catch (e) {
      console.error('[Criminal Detection] Error fetching detections:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch metadata and registered criminals
  useEffect(() => {
    const fetchAuxData = async () => {
      try {
        const [metaRes, regRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/criminal-detection/meta`),
          fetch(`${API_BASE_URL}/api/criminal-registration`)
        ]);
        const metaData = await metaRes.json();
        if (metaData.success) {
          setDbMeta({
            categories: metaData.categories || [],
            severities: metaData.severities || [],
            statuses: metaData.statuses || []
          });
        }
        const regData = await regRes.json();
        if (regData.success && Array.isArray(regData.records)) {
          setRegisteredCriminals(regData.records);
        }
      } catch (e) {
        console.error('[Criminal Detection] Error fetching aux data:', e);
      }
    };

    fetchDetections();
    fetchAuxData();
  }, []);

  // -------------------------------------------------------------
  // Python AI Face Recognizer & Live Stream
  // -------------------------------------------------------------
  // Active RTSP URL derived from selected camera or configuration
  const activeRtspUrl = useMemo(() => {
    return selectedCamera?.url || selectedCamera?.rtsp_url || API_CONFIG.RTSP_CRIMINAL_CAM || 'rtsp://admin:Admin%40123@192.168.1.21:554';
  }, [selectedCamera]);

  const [activeLiveThreat, setActiveLiveThreat] = useState(null);

  // Temporary drawer configuration states
  const [customRtspInput, setCustomRtspInput] = useState('');
  const [customApiInput, setCustomApiInput] = useState('');
  const [customWsInput, setCustomWsInput] = useState('');

  const pendingClipsMapRef = useRef(new Map());

  // Python Detection Event Handler (Type 2: detection — instant alert)
  const handlePythonDetection = useCallback(async (detectionData) => {
    // detectionData: { type: "detection", detection_id, emp_id, match_percentage, face_image, snapshot, clip_incoming, clip_eta_seconds }
    const empId = detectionData.emp_id;
    const matchScore = detectionData.match_percentage;
    const clientDetId = detectionData.detection_id || `DET-${Date.now()}`;

    // Match against registered criminals watchlist
    const matched = registeredCriminals.find(c => {
      const eStr = String(empId || '').toLowerCase().trim();
      const code = String(c.criminal_record_code || c.code || '').toLowerCase().trim();
      const idStr = String(c.id || '').toLowerCase().trim();
      const aadhaar = String(c.aadhaar_number || c.aadharNumber || '').replace(/\D/g, '');
      const first = String(c.first_name || c.firstName || '').toLowerCase().trim();
      const last = String(c.last_name || c.lastName || '').toLowerCase().trim();
      const full = `${first} ${last}`.trim();
      const empField = String(c.emp_id || '').toLowerCase().trim();

      return (code && (eStr === code || eStr.includes(code))) ||
        (idStr && (eStr === idStr || eStr.includes(idStr))) ||
        (empField && (eStr === empField || eStr.includes(empField))) ||
        (aadhaar && (eStr === aadhaar || eStr.includes(aadhaar))) ||
        (first && (eStr === first || eStr.includes(first))) ||
        (full && (eStr === full || eStr.includes(full)));
    });

    const dTime = new Date();
    const timeStr = dTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const detIdNum = Date.now();
    const detCode = `DET-${String(detIdNum).slice(-4)}`;

    const dynamicCamName = selectedCamera?.label || selectedCamera?.name || (selectedCamera?.camera_id ? `CAM-${selectedCamera.camera_id}` : '');
    const dynamicLocName = selectedCamera?.location || '';
    const dynamicZoneName = selectedCamera?.zone_name || selectedCamera?.zone || '';
    const dynamicCamId = selectedCamera?.camera_id || selectedCamera?.id || null;
    const dynamicLocId = selectedCamera?.location_id || null;
    const dynamicZoneId = selectedCamera?.zone_id || null;

    const newDet = {
      id: detIdNum,
      rawDetectionId: detIdNum,
      clientDetectionId: clientDetId,
      detectionId: detCode,
      criminalId: matched?.criminal_record_code || matched?.code || (matched?.id ? `CR-${matched.id}` : empId),
      firstName: matched?.first_name || matched?.firstName || empId,
      lastName: matched?.last_name || matched?.lastName || '',
      aliases: matched?.aliases || '',
      gender: matched?.gender || 'Unknown',
      age: matched?.age || '—',
      crimeCategory: matched?.crimeCategory || matched?.category_name || 'Wanted Criminal',
      crimeCategoryId: matched?.crime_category_id || 1,
      severity: matched?.severity || matched?.severity_name || 'Critical',
      severityId: matched?.severity_id || 1,
      firNumber: matched?.fir_number || matched?.firNumber || 'FIR-2026/089',
      location: dynamicLocName,
      zone: dynamicZoneName,
      camera: dynamicCamName || (dynamicCamId ? `CAM-${dynamicCamId}` : ''),
      cameraId: dynamicCamId ? `CAM-${dynamicCamId}` : '',
      aadharNumber: matched?.aadhaar_number || matched?.aadharNumber || '',
      nationalId: matched?.national_id || matched?.nationalId || 'XXXX-XXXX-9021',
      idMarks: matched?.identification_marks || matched?.idMarks || '',
      confidence: Number(Number(matchScore).toFixed(1)),
      status: 'ALERT TRIGGERED',
      statusId: 1,
      detected_at: dTime.toISOString(),
      time: timeStr,
      notes: `Python AI biometric match (${Number(matchScore).toFixed(1)}%) confirmed on live camera stream.`,
      face_image: detectionData.face_image || null,
      snapshot: detectionData.snapshot || null,
      photo: detectionData.face_image || detectionData.snapshot || getMediaUrl(matched?.photo_path || matched?.photo || null),
      mugshot: detectionData.face_image || detectionData.snapshot || null,
      registered_photo: getMediaUrl(matched?.photo_path || matched?.photo || null),
      registered_photo_path: matched?.photo_path || matched?.photo || null,
      video: null,
      awaiting_clip: Boolean(detectionData.clip_incoming ?? true),
      clip_eta: detectionData.clip_eta_seconds || 4.0,
      is_matched: true
    };

    setDetections(prev => [newDet, ...prev.filter(d => d.id !== newDet.id)]);
    setActiveLiveThreat(newDet);

    toast.error(
      "WANTED CRIMINAL DETECTED!",
      `${newDet.firstName} ${newDet.lastName} (${newDet.confidence}% Match) at ${dynamicLocName || dynamicCamName || 'Live Camera'}. Video clip incoming (~4s)...`
    );

    // Save initial record + image to PostgreSQL backend
    try {
      const cleanAadhaar = String(newDet.aadharNumber || '').replace(/\D/g, '');
      const validAadhaar = /^[0-9]{12}$/.test(cleanAadhaar)
        ? cleanAadhaar
        : (matched?.aadhaar_number ? String(matched.aadhaar_number).replace(/\D/g, '') : null);

      const formData = new FormData();
      if (matched?.criminal_id || matched?.id) {
        formData.append('criminal_id', String(matched.criminal_id || matched.id));
      }
      formData.append('emp_id', String(empId || ''));
      formData.append('client_detection_id', String(clientDetId));
      formData.append('detected_name', `${newDet.firstName} ${newDet.lastName}`.trim());
      if (newDet.aliases) formData.append('detected_alias', newDet.aliases);
      if (validAadhaar) formData.append('aadhaar_number', validAadhaar);
      if (dynamicCamId) formData.append('camera_id', String(dynamicCamId));
      if (dynamicZoneId) formData.append('zone_id', String(dynamicZoneId));
      if (dynamicLocId) formData.append('location_id', String(dynamicLocId));
      formData.append('match_confidence', String(newDet.confidence));
      if (detectionData.match_percentage) {
        formData.append('match_percentage', String(detectionData.match_percentage));
      }
      formData.append('crime_category_id', String(newDet.crimeCategoryId || 1));
      formData.append('severity_id', String(newDet.severityId || 1));
      if (newDet.firNumber) formData.append('fir_number', newDet.firNumber);
      formData.append('status_id', '1');
      formData.append('detection_time', newDet.detected_at || new Date().toISOString());

      // 1. Cropped Face Image (Surveillance Intercept)
      const faceSrc = detectionData.face_image || detectionData.snapshot;
      if (faceSrc) {
        formData.append('mugshot_base64', faceSrc);
        if (faceSrc.startsWith('data:image')) {
          try {
            const parts = faceSrc.split(',');
            const mimeMatch = parts[0].match(/:(.*?);/);
            const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
            const bstr = atob(parts[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) u8arr[n] = bstr.charCodeAt(n);
            const photoBlob = new Blob([u8arr], { type: mime });
            formData.append('face_image', photoBlob, 'face_image.jpg');
            formData.append('photo', photoBlob, 'evidence_image.jpg');
          } catch (blobErr) {
            console.warn('[CriminalDetection] Could not convert face base64 to blob:', blobErr);
          }
        }
      }

      // 2. Full Camera Scene Annotated Snapshot
      const snapSrc = detectionData.snapshot;
      if (snapSrc) {
        formData.append('snapshot_base64', snapSrc);
        if (snapSrc.startsWith('data:image')) {
          try {
            const parts = snapSrc.split(',');
            const mimeMatch = parts[0].match(/:(.*?);/);
            const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
            const bstr = atob(parts[1]);
            let n = bstr.length;
            const u8arr = new Uint8Array(n);
            while (n--) u8arr[n] = bstr.charCodeAt(n);
            const snapBlob = new Blob([u8arr], { type: mime });
            formData.append('snapshot', snapBlob, 'snapshot.jpg');
          } catch (blobErr) {
            console.warn('[CriminalDetection] Could not convert snapshot base64 to blob:', blobErr);
          }
        }
      }

      console.log(`[CriminalDetection] 🚀 Logging detection to DB: ${newDet.firstName} ${newDet.lastName} (emp_id: ${empId})`);
      const res = await fetch(`${API_BASE_URL}/api/criminal-detection`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      console.log('[CriminalDetection] 📥 DB response:', res.status, data);

      if (data.success && data.detection) {
        const normalized = normalizeDetection(data.detection);
        const backendId = normalized.rawDetectionId || normalized.id;
        pendingClipsMapRef.current.set(clientDetId, backendId);
        if (empId) pendingClipsMapRef.current.set(String(empId), backendId);

        setDetections(prev => prev.map(d => {
          if (d.id === newDet.id || d.clientDetectionId === clientDetId) {
            return {
              ...d,
              ...normalized,
              face_image: normalized.face_image || d.face_image,
              snapshot: normalized.snapshot || d.snapshot,
              clientDetectionId: clientDetId,
              awaiting_clip: d.awaiting_clip,
              video: d.video || normalized.video
            };
          }
          return d;
        }));

        setActiveLiveThreat(prev => prev && (prev.id === newDet.id || prev.clientDetectionId === clientDetId) ? { ...prev, ...normalized, clientDetectionId: clientDetId } : prev);

        toast.success("Threat Saved to Database", `${normalized.detectedName || normalized.firstName} saved as record ${normalized.detectionId || '#' + backendId}`);
      } else {
        console.error('[CriminalDetection] ❌ Failed to save detection:', data);
        toast.error("Database Save Failed", data.message || "Could not log detection record to database");
      }
    } catch (e) {
      console.error('[CriminalDetection] Sync detection error:', e);
      toast.error("Network / Save Error", e.message || "Failed to communicate with detection backend");
    }
  }, [registeredCriminals, selectedCamera, toast]);

  // Python Clip Event Handler (Type 3: detection_clip arriving ~4s later)
  const handlePythonDetectionClip = useCallback(async (clipData) => {
    // clipData: { detection_id, emp_id, match_percentage, clip_duration_seconds, clip_mime, clip_blob, clip_url, clip_base64 }
    const clientDetId = clipData.detection_id;
    const empId = clipData.emp_id;
    console.log(`[CriminalDetection] 🎬 Securing clip for detection_id: ${clientDetId} (emp_id: ${empId})`);

    // Update UI state immediately with local object URL
    setDetections(prev => prev.map(d => {
      if (d.clientDetectionId === clientDetId || String(d.id) === String(clientDetId) || d.detectionId === clientDetId) {
        return {
          ...d,
          video: clipData.clip_url || d.video,
          video_path: clipData.clip_url || d.video_path,
          awaiting_clip: false,
          clip_incoming: false,
          clip_duration_seconds: clipData.clip_duration_seconds
        };
      }
      return d;
    }));

    setSelectedRecord(prev => {
      if (prev && (prev.clientDetectionId === clientDetId || String(prev.id) === String(clientDetId) || prev.detectionId === clientDetId)) {
        return {
          ...prev,
          video: clipData.clip_url || prev.video,
          video_path: clipData.clip_url || prev.video_path,
          awaiting_clip: false,
          clip_incoming: false,
          clip_duration_seconds: clipData.clip_duration_seconds
        };
      }
      return prev;
    });

    setActiveLiveThreat(prev => {
      if (prev && (prev.clientDetectionId === clientDetId || String(prev.id) === String(clientDetId) || prev.detectionId === clientDetId)) {
        return {
          ...prev,
          video: clipData.clip_url || prev.video,
          video_path: clipData.clip_url || prev.video_path,
          awaiting_clip: false,
          clip_incoming: false,
          clip_duration_seconds: clipData.clip_duration_seconds
        };
      }
      return prev;
    });

    toast.success("Clip Secured", `~${clipData.clip_duration_seconds}s video intercept attached to alert`);

    // Upload clip to backend to store in uploads/criminalDetection directly
    let backendId = pendingClipsMapRef.current.get(clientDetId) || (empId ? pendingClipsMapRef.current.get(String(empId)) : null);
    if (!backendId) {
      // If backendId is still in-flight, retry briefly
      for (let i = 0; i < 6; i++) {
        await new Promise(r => setTimeout(r, 500));
        backendId = pendingClipsMapRef.current.get(clientDetId) || (empId ? pendingClipsMapRef.current.get(String(empId)) : null);
        if (backendId) break;
      }
    }

    if (API_BASE_URL) {
      try {
        const formData = new FormData();
        if (clipData.clip_blob) {
          formData.append('clip', clipData.clip_blob, 'evidence_video.mp4');
          formData.append('video', clipData.clip_blob, 'evidence_video.mp4');
        } else if (clipData.clip_base64) {
          formData.append('clip_base64', clipData.clip_base64);
          formData.append('video_base64', clipData.clip_base64);
        }
        if (empId) formData.append('emp_id', String(empId));
        if (clientDetId) formData.append('detection_id', String(clientDetId));
        if (backendId) formData.append('rawDetectionId', String(backendId));

        const targetUrl = backendId 
          ? `${API_BASE_URL}/api/criminal-detection/${backendId}/clip`
          : `${API_BASE_URL}/api/criminal-detection/clip`;

        console.log(`[CriminalDetection] 📤 Uploading video evidence to backend: ${targetUrl}`);
        const res = await fetch(targetUrl, {
          method: 'POST',
          body: formData
        });
        const resData = await res.json();
        console.log('[CriminalDetection] 📥 Clip save response:', res.status, resData);

        if (resData.success && resData.video_path) {
          const finalVideoUrl = getMediaUrl(resData.video_path);
          setDetections(prev => prev.map(d => {
            if (d.id === backendId || d.rawDetectionId === backendId || d.clientDetectionId === clientDetId) {
              return { ...d, video: finalVideoUrl, video_path: resData.video_path, awaiting_clip: false };
            }
            return d;
          }));
          setSelectedRecord(prev => {
            if (prev && (prev.id === backendId || prev.rawDetectionId === backendId || prev.clientDetectionId === clientDetId)) {
              return { ...prev, video: finalVideoUrl, video_path: resData.video_path, awaiting_clip: false };
            }
            return prev;
          });
        }
      } catch (err) {
        console.warn('[CriminalDetection] Upload clip error:', err);
      }
    }
  }, [toast]);

  // Hook for live stream & API endpoints
  const {
    isConnected: isStreamConnected,
    isConnecting: isStreamConnecting,
    streamError,
    liveFrame,
    lastDetection: pythonLastDetection,
    fps: streamFps,
    rtspUrl: streamRtspUrl,
    setRtspUrl: setStreamRtspUrl,
    apiUrl: pythonApiUrl,
    setApiUrl: setPythonApiUrl,
    wsBaseUrl: pythonWsUrl,
    setWsBaseUrl: setPythonWsUrl,
    health: serverHealth,
    isCheckingHealth,
    checkHealth,
    isReloadingDb,
    reloadResult,
    reloadFaceDatabase,
    connect: connectStream,
    disconnect: disconnectStream,
    reconnect: reconnectStream,
    capture5sVideo
  } = useCriminalDetectionStream({
    rtspUrl: activeRtspUrl,
    autoConnect: true,
    onDetection: handlePythonDetection,
    onDetectionClip: handlePythonDetectionClip
  });

  // Keep custom input states in sync with active stream settings
  useEffect(() => {
    setCustomRtspInput(streamRtspUrl);
    setCustomApiInput(pythonApiUrl);
    setCustomWsInput(pythonWsUrl);
  }, [streamRtspUrl, pythonApiUrl, pythonWsUrl]);

  // Face Database Reload: POST /faces/reload
  const handleReloadFaceDatabase = async () => {
    toast.info("Reloading Face Database...", "Indexing face embeddings on Python server...");
    const res = await reloadFaceDatabase();
    if (res && res.status === 'success') {
      toast.success(
        "Face Database Reloaded!",
        `Successfully indexed ${res.num_faces || 0} faces in ${res.duration || '0s'}.`
      );
    } else if (res && res.status === 'error') {
      toast.warn(
        "Face Database Alert",
        res.message || "No known faces to index."
      );
    } else {
      toast.error("Reload Failed", "Could not reach Python AI server.");
    }
  };

  // Health Check: GET /health
  const handleCheckHealth = async () => {
    const res = await checkHealth();
    if (res && res.status === 'ok') {
      toast.success(
        "Python AI Server Online",
        `Active streams: ${res.active_recognizers} | Latency: ${res.latency}ms`
      );
    } else {
      toast.error(
        "Python Server Offline",
        res.error || "Cannot reach Python AI server /health"
      );
    }
  };

  // Real-time Server-Sent Events (SSE) Stream
  useEffect(() => {
    let eventSource = null;
    try {
      eventSource = new EventSource(`${API_BASE_URL}/api/criminal-detection/stream`);

      eventSource.onopen = () => {
        console.log('[Criminal Detection] SSE stream connected successfully');
      };

      eventSource.addEventListener('detection', (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload && payload.detection) {
            const newDet = normalizeDetection(payload.detection);
            setDetections(prev => [newDet, ...prev.filter(d => d.id !== newDet.id)]);
            toast.error(
              "CRITICAL THREAT DETECTED!",
              `${newDet.firstName} ${newDet.lastName} (${newDet.confidence}% Match) at ${newDet.location}`
            );
          }
        } catch (err) {
          console.error('[Criminal Detection] SSE event parse error:', err);
        }
      });

      eventSource.addEventListener('status_update', (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload && payload.detection) {
            const updated = normalizeDetection(payload.detection);
            setDetections(prev =>
              prev.map(d => d.id === updated.id ? updated : d)
            );
          }
        } catch (err) {
          console.error('[Criminal Detection] SSE status update parse error:', err);
        }
      });

      eventSource.onerror = (err) => {
        console.warn('[Criminal Detection] SSE connection warn:', err);
      };
    } catch (err) {
      console.error('[Criminal Detection] SSE setup error:', err);
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, [toast]);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Right Side Drawer State
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Official Mugshot uploaded during registration (resolved from selectedRecord or registeredCriminals)
  const officialRegistrationPhoto = useMemo(() => {
    if (!selectedRecord) return null;
    if (selectedRecord.registered_photo) return selectedRecord.registered_photo;
    if (selectedRecord.registered_photo_path) return getMediaUrl(selectedRecord.registered_photo_path);
    if (selectedRecord.reg_photo_path) return getMediaUrl(selectedRecord.reg_photo_path);

    // Dynamic match in registeredCriminals
    if (Array.isArray(registeredCriminals) && registeredCriminals.length > 0) {
      const targetAadhaar = String(selectedRecord.aadharNumber || selectedRecord.aadhaar_number || '').replace(/\D/g, '');
      const targetCriminalId = String(selectedRecord.rawCriminalId || selectedRecord.criminal_id || '');
      const targetCode = String(selectedRecord.criminalId || '').toLowerCase().trim();
      const targetFirst = String(selectedRecord.firstName || '').toLowerCase().trim();

      const matched = registeredCriminals.find(c => {
        const cAadhaar = String(c.aadhaar_number || c.aadharNumber || '').replace(/\D/g, '');
        if (targetAadhaar && cAadhaar && targetAadhaar === cAadhaar) return true;

        const cId = String(c.criminal_id || c.id || '');
        if (targetCriminalId && cId && targetCriminalId === cId) return true;

        const cCode = String(c.criminal_record_code || c.code || '').toLowerCase().trim();
        if (targetCode && cCode && (targetCode === cCode || targetCode.includes(cCode))) return true;

        const cFirst = String(c.first_name || c.firstName || '').toLowerCase().trim();
        if (targetFirst && cFirst && targetFirst === cFirst) return true;

        return false;
      });

      if (matched && (matched.photo_path || matched.photo)) {
        return getMediaUrl(matched.photo_path || matched.photo);
      }
    }

    return null;
  }, [selectedRecord, registeredCriminals]);

  // Multi-Camera Grid Pagination
  const [gridItemsPerPage, setGridItemsPerPage] = useState(12);
  const [gridCurrentPage, setGridCurrentPage] = useState(1);

  const paginatedCameras = useMemo(() => {
    if (!camerasList.length) return [];
    if (gridItemsPerPage === null || gridItemsPerPage === Infinity) return camerasList;
    const start = (gridCurrentPage - 1) * gridItemsPerPage;
    return camerasList.slice(start, start + gridItemsPerPage);
  }, [camerasList, gridCurrentPage, gridItemsPerPage]);

  // Acknowledge Detection (Status 2 = Verified)
  const handleAcknowledgeDetection = async (id) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/criminal-detection/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status_id: 2 })
      });
      const data = await res.json();
      if (data.success) {
        setDetections(prev =>
          prev.map(d => (d.id === id || d.detectionId === id) ? { ...d, status: 'VERIFIED', statusId: 2 } : d)
        );
        toast.success("Detection Verified", `Alert ${id} confirmed by operator`);
      }
    } catch (err) {
      console.error('Error updating status:', err);
      // Fallback local update
      setDetections(prev =>
        prev.map(d => (d.id === id || d.detectionId === id) ? { ...d, status: 'VERIFIED', statusId: 2 } : d)
      );
    }
  };

  // Dispatch Action (Status 3 = Dispatched)
  const handleDispatchDetection = async (id) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/criminal-detection/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status_id: 3 })
      });
      const data = await res.json();
      if (data.success) {
        setDetections(prev =>
          prev.map(d => (d.id === id || d.detectionId === id) ? { ...d, status: 'DISPATCHED', statusId: 3 } : d)
        );
        toast.success("Threat Dispatched", `Police patrol dispatched for alert ${id}`);
      }
    } catch (err) {
      console.error('Error dispatching:', err);
    }
  };

  // Delete / Dismiss False Alert (Soft Delete in DB)
  const handleDeleteDetection = async (id) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/criminal-detection/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setDetections(prev => prev.filter(d => d.id !== id && d.detectionId !== id));
        toast.info("Alert Dismissed", "Marked as false positive in database");
        setIsModalOpen(false);
      }
    } catch (err) {
      console.error('Error deleting detection:', err);
    }
  };

  // Simulate Live Match Trigger (Stores into PostgreSQL and broadcasts via SSE)
  const simulateLiveDetection = async () => {
    try {
      const pool = registeredCriminals.length > 0 ? registeredCriminals : [];
      const target = pool.length > 0
        ? pool[Math.floor(Math.random() * pool.length)]
        : {
          first_name: 'Vikram',
          last_name: 'Shinde',
          criminal_record_code: 'CR-002',
          aliases: 'Vicky Don',
          aadhaar_number: '894230198421',
          crime_category_id: 1,
          severity_id: 1,
          fir_number: 'FIR-2026/089'
        };

      const activeCam = selectedCamera || (camerasList.length > 0 ? camerasList[Math.floor(Math.random() * camerasList.length)] : null);

      const cleanAadhaar = target.aadhaar_number || target.aadharNumber;
      const validAadhaar = /^[0-9]{12}$/.test(String(cleanAadhaar || '').replace(/\D/g, ''))
        ? String(cleanAadhaar).replace(/\D/g, '')
        : '894230198421';

      toast.info("Simulating Detection...", "Capturing 5s surveillance video clip evidence...");

      let videoBlob = null;
      if (capture5sVideo) {
        try {
          videoBlob = await capture5sVideo(3000);
        } catch {
          videoBlob = null;
        }
      }

      const formData = new FormData();
      formData.append('detected_name', `${target.first_name || target.firstName || 'Vikram'} ${target.last_name || target.lastName || 'Shinde'}`.trim());
      formData.append('detected_alias', target.aliases || 'Vicky');
      formData.append('aadhaar_number', validAadhaar);
      formData.append('crime_category_id', String(target.crime_category_id || target.crimeCategoryId || 1));
      formData.append('severity_id', String(target.severity_id || target.severityId || 1));
      formData.append('status_id', '1');
      formData.append('match_confidence', String(Number((94.5 + Math.random() * 5).toFixed(1))));
      formData.append('fir_number', target.fir_number || target.firNumber || 'FIR-2026/089');
      if (activeCam?.camera_id || activeCam?.id) {
        formData.append('camera_id', String(activeCam.camera_id || activeCam.id));
      }
      if (activeCam?.zone_id) formData.append('zone_id', String(activeCam.zone_id));
      if (activeCam?.location_id) formData.append('location_id', String(activeCam.location_id));

      if (target.photo || target.mugshot_path) {
        formData.append('mugshot_base64', target.photo || target.mugshot_path);
        formData.append('face_image', target.photo || target.mugshot_path);
      } else if (liveFrame) {
        formData.append('mugshot_base64', liveFrame);
        formData.append('face_image', liveFrame);
      }

      if (liveFrame) {
        formData.append('snapshot_base64', liveFrame);
      }

      if (videoBlob && videoBlob.size > 0) {
        const ext = videoBlob.type && videoBlob.type.includes('mp4') ? 'mp4' : 'webm';
        formData.append('video', videoBlob, `evidence_video.${ext}`);
      }

      const res = await fetch(`${API_BASE_URL}/api/criminal-detection`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success && data.detection) {
        const normalized = normalizeDetection(data.detection);
        setDetections(prev => [normalized, ...prev.filter(d => d.detectionId !== normalized.detectionId)]);
        setActiveLiveThreat(normalized);
        toast.success("Live Detection Generated", "Detection & 5s video evidence recorded in uploads/criminalDetection and database");
      }
    } catch (err) {
      console.error('Simulation error:', err);
      toast.error("Simulation Error", err.message);
    }
  };

  // Filtered Detections
  const filteredDetections = useMemo(() => {
    return detections.filter(d => {
      // Search
      const search = searchQuery.toLowerCase();
      const fullName = `${d.firstName || ''} ${d.lastName || ''}`.toLowerCase();
      const matchesSearch = !searchQuery ||
        fullName.includes(search) ||
        String(d.aliases || '').toLowerCase().includes(search) ||
        String(d.criminalId || '').toLowerCase().includes(search) ||
        String(d.detectionId || '').toLowerCase().includes(search) ||
        String(d.firNumber || '').toLowerCase().includes(search) ||
        String(d.aadharNumber || '').toLowerCase().includes(search) ||
        String(d.location || '').toLowerCase().includes(search) ||
        String(d.camera || '').toLowerCase().includes(search);

      // Severity
      const matchesSeverity = !severityFilter || (d.severity || '').toLowerCase().trim() === severityFilter.toLowerCase().trim();

      // Category
      const matchesCategory = !categoryFilter || (d.crimeCategory || '').toLowerCase().trim() === categoryFilter.toLowerCase().trim();

      // Status
      const matchesStatus = !statusFilter || (d.status || '').toUpperCase().trim() === statusFilter.toUpperCase().trim();

      // Date
      let matchesDate = true;
      const itemDate = toLocalDateStr(d.detected_at);
      if (fromDate && itemDate && itemDate < fromDate) matchesDate = false;
      if (toDate && itemDate && itemDate > toDate) matchesDate = false;

      // Zone filter from backend header selection
      let matchesZone = true;
      if (cameraFilter?.filters?.zone) {
        const selectedZoneObj = cameraFilter.availableOptions?.zones?.find(z => String(z.id) === String(cameraFilter.filters.zone));
        const zoneName = selectedZoneObj?.name || cameraFilter.filters.zone;
        matchesZone = String(d.zone_id || d.zoneId || '') === String(cameraFilter.filters.zone) ||
          String(d.zone || '').toLowerCase() === String(zoneName).toLowerCase();
      }

      // Location filter from backend header selection
      let matchesLocation = true;
      if (cameraFilter?.filters?.location) {
        const selectedLocObj = cameraFilter.availableOptions?.locations?.find(l => String(l.id) === String(cameraFilter.filters.location));
        const locName = selectedLocObj?.name || selectedLocObj?.location || cameraFilter.filters.location;
        matchesLocation = String(d.location_id || d.locationId || '') === String(cameraFilter.filters.location) ||
          String(d.location || '').toLowerCase() === String(locName).toLowerCase();
      }

      // Camera filter from backend header selection (when a specific camera is chosen)
      let matchesCamera = true;
      if (cameraFilter?.filters?.cameraId) {
        const camObj = camerasList.find(c => String(c.value) === String(cameraFilter.filters.cameraId) || String(c.id) === String(cameraFilter.filters.cameraId));
        matchesCamera = String(d.cameraId) === String(cameraFilter.filters.cameraId) ||
          String(d.camera_id) === String(cameraFilter.filters.cameraId) ||
          (camObj && (
            String(d.camera || '').toLowerCase().includes(String(camObj.label || '').toLowerCase()) ||
            String(d.camera || '').toLowerCase().includes(String(camObj.value || '').toLowerCase())
          ));
      }

      return matchesSearch && matchesSeverity && matchesCategory && matchesStatus && matchesDate && matchesZone && matchesLocation && matchesCamera;
    }).map((d, index) => {
      const resolved = resolveCameraDetails(d, camerasList, selectedCamera);
      return {
        ...d,
        srNo: index + 1,
        zone: resolved.zone && resolved.zone !== 'Unknown' ? resolved.zone : (d.zone || 'Unknown'),
        location: resolved.location && resolved.location !== 'Unknown' ? resolved.location : (d.location || 'Unknown'),
        camera: resolved.camera && resolved.camera !== 'Unknown' ? resolved.camera : (d.camera || 'Unknown')
      };
    });
  }, [detections, searchQuery, severityFilter, categoryFilter, statusFilter, fromDate, toDate, cameraFilter?.filters, camerasList, selectedCamera]);

  // Dynamic Stats Cards: TOTAL DETECTED + Each Severity Type (Critical, High, Medium, Low)
  const criminalStats = useMemo(() => {
    const totalCount = detections.length;

    const severityConfigs = [
      { name: 'Critical', color: '#ef4444' },
      { name: 'High', color: '#f97316' },
      { name: 'Medium', color: '#eab308' },
      { name: 'Low', color: '#3b82f6' }
    ];

    const backendSeverities = Array.isArray(dbMeta.severities) && dbMeta.severities.length > 0
      ? dbMeta.severities
      : severityConfigs;

    const cards = [
      {
        id: 'total',
        title: 'TOTAL DETECTED',
        count: totalCount,
        color: '#2563eb'
      }
    ];

    backendSeverities.forEach((sev) => {
      const sName = (sev.name || sev.severity_name || '').trim();
      const sLower = sName.toLowerCase();
      const count = detections.filter((d) => {
        const dSev = (d.severity || '').toLowerCase().trim();
        const dSevId = String(d.severityId || d.severity_id || '');
        return dSev === sLower || (sev.id && dSevId === String(sev.id));
      }).length;

      const matchedConfig = severityConfigs.find((c) => c.name.toLowerCase() === sLower);
      const color = matchedConfig ? matchedConfig.color : '#8b5cf6';

      cards.push({
        id: `sev_${sev.id || sName}`,
        title: `${sName.toUpperCase()} SEVERITY`,
        count,
        color
      });
    });

    return cards;
  }, [detections, dbMeta.severities]);

  // Dynamic Crime Categories computed from backend metadata and actual records
  const dynamicCategories = useMemo(() => {
    const set = new Set();
    if (Array.isArray(dbMeta.categories) && dbMeta.categories.length > 0) {
      dbMeta.categories.forEach(c => {
        const name = (c.name || c.category_name || '').trim();
        if (name) set.add(name);
      });
    }
    detections.forEach(d => {
      const name = (d.crimeCategory || '').trim();
      if (name) set.add(name);
    });
    registeredCriminals.forEach(c => {
      const name = (c.crimeCategory || c.category_name || '').trim();
      if (name) set.add(name);
    });
    if (set.size === 0) {
      CRIME_CATEGORIES.forEach(c => set.add(c));
    }
    return Array.from(set).sort();
  }, [dbMeta.categories, detections, registeredCriminals]);

  const handleViewDetails = (record) => {
    setSelectedRecord(record);
    setIsModalOpen(true);
  };

  const activeThreat = activeLiveThreat || detections.find(d => d.status === 'ALERT TRIGGERED') || detections[0] || null;

  // -------------------------------------------------------------
  // Video Component: AI Facial Recognition Stream & Right Feed
  // -------------------------------------------------------------
  const focusedStreamComponent = (
    <>
      <div className="relative w-full h-full min-h-[280px] rounded-xl overflow-hidden bg-black border shadow-md flex flex-col justify-between" style={{ borderColor }}>
        {/* Top Overlay Bar - Clean Minimal Controls */}
        <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/80 via-black/30 to-transparent flex items-center justify-between z-20 pointer-events-auto">
          <div className="flex items-center gap-2">
            <div className="px-2.5 py-1 rounded-md text-[10px] font-extrabold flex items-center gap-1.5 bg-red-600/90 text-white shadow-lg border border-red-400/40 backdrop-blur-md">
              <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
              LIVE AI SURVEILLANCE
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Switch to Grid View */}
            <button
              onClick={() => setViewMode('grid')}
              className="px-2.5 py-1 rounded-md bg-black/60 hover:bg-black/80 text-blue-400 hover:text-blue-300 border border-blue-500/30 text-xs font-semibold backdrop-blur-md flex items-center gap-1.5 transition-all cursor-pointer"
              title="View Multi-Camera Surveillance Grid"
            >
              <Grid size={13} />
              <span className="hidden sm:inline">Camera Grid</span>
            </button>

            {/* Camera Settings Button */}
            <button
              onClick={() => setIsSettingsDrawerOpen(true)}
              className="p-1.5 rounded-md bg-black/60 hover:bg-black/80 text-blue-400 hover:text-blue-300 border border-blue-500/30 backdrop-blur-md transition-all cursor-pointer"
              title="Camera & Python AI Server Configuration"
            >
              <Settings size={15} className="hover:rotate-90 transition-transform duration-300" />
            </button>
          </div>
        </div>

        {/* Main Video View Area: Pure Live Stream */}
        <div className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden bg-black">
          {liveFrame ? (
            <img
              src={liveFrame}
              alt="Live Surveillance Stream"
              className="w-full h-full object-contain select-none pointer-events-none"
            />
          ) : (
            /* Standby / Connecting HUD */
            <div className="absolute inset-0 bg-gradient-to-br from-[#070b14] via-[#0d1527] to-[#050811] flex flex-col items-center justify-center p-4">
              <div className="relative z-10 flex flex-col items-center max-w-sm text-center">
                <div className="w-14 h-14 rounded-2xl border border-blue-500/30 bg-blue-950/30 flex items-center justify-center mb-2 shadow-[0_0_20px_rgba(59,130,246,0.2)]">
                  {isStreamConnecting ? (
                    <RefreshCw className="w-7 h-7 text-blue-400 animate-spin" />
                  ) : streamError ? (
                    <WifiOff className="w-7 h-7 text-red-400" />
                  ) : (
                    <Fingerprint className="w-7 h-7 text-blue-400 animate-pulse" />
                  )}
                </div>

                <p className="text-xs font-bold text-gray-200 uppercase tracking-wide">
                  {isStreamConnecting ? 'Connecting Live Stream...' : streamError ? 'Stream Disconnected' : 'Live Camera Standby'}
                </p>
                {streamError && (
                  <p className="text-[10px] text-red-400 mt-1 max-w-[260px] truncate">{streamError}</p>
                )}
                {!isStreamConnected && (
                  <button
                    onClick={() => connectStream()}
                    className="mt-3 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Play size={12} /> Reconnect Stream
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Bottom Bar Info on Video */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between z-20 pointer-events-auto">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/75 border border-white/10 text-white text-xs backdrop-blur-md">
              <MapPin size={13} className="text-blue-400" />
              <span className="font-semibold">{selectedCamera?.location || "Baramati MIDC - North Entry Gate"}</span>
              <span className="opacity-40">|</span>
              <span className="text-gray-300 text-[11px] font-mono">{selectedCamera?.label || "Live Camera"}</span>
            </div>

            <button
              onClick={() => setIsMaximized(true)}
              className="bg-black/60 hover:bg-black/80 text-white p-2 rounded-lg transition-colors cursor-pointer backdrop-blur-sm border border-white/10"
              title="Maximize to Fullscreen"
            >
              <Maximize size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Fullscreen Portal Overlay */}
      {isMaximized && createPortal(
        <div className="fixed inset-0 z-[99999] bg-black/95 backdrop-blur-md flex flex-col p-3 md:p-6 text-white font-sans">
          <div className="relative w-full h-full rounded-2xl overflow-hidden bg-black border border-white/20 shadow-2xl flex flex-col justify-between">
            {/* Fullscreen Top Bar */}
            <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/90 via-black/40 to-transparent flex items-center justify-between z-30 pointer-events-auto">
              <div className="flex items-center gap-3">
                <div className="px-3 py-1 rounded-md text-xs font-extrabold flex items-center gap-2 bg-red-600 text-white shadow-lg border border-red-400/40">
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
                  LIVE AI SURVEILLANCE
                </div>
                <span className="text-sm font-semibold text-gray-200 hidden sm:inline">
                  {selectedCamera?.location || "Baramati MIDC"} ({selectedCamera?.label || "Live Camera"})
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsMaximized(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer"
                  title="Minimize (Esc)"
                >
                  <Minimize size={16} />
                  <span>Minimize</span>
                </button>
              </div>
            </div>

            {/* Fullscreen Stream View - Pure Clean Live Feed */}
            <div className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden bg-black">
              {liveFrame ? (
                <img
                  src={liveFrame}
                  alt="Live Fullscreen Feed"
                  className="w-full h-full object-contain select-none pointer-events-none"
                />
              ) : (
                <div className="relative flex-1 w-full h-full flex flex-col items-center justify-center p-6 bg-gradient-to-br from-[#070b14] via-[#0d1527] to-[#050811]">
                  <Fingerprint className="w-16 h-16 text-blue-400 animate-pulse mb-3" />
                  <span className="text-sm text-blue-300 font-bold uppercase tracking-wider text-center">
                    Connecting Live Camera Stream...
                  </span>
                </div>
              )}
            </div>

            {/* Fullscreen Bottom Bar */}
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between z-30 pointer-events-auto">
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-black/80 border border-white/10 text-white text-xs backdrop-blur-md">
                <MapPin size={14} className="text-blue-400" />
                <span className="font-semibold">{selectedCamera?.location || "Baramati MIDC - North Entry Gate"}</span>
                <span className="opacity-40">|</span>
                <span className="text-gray-300 text-xs font-mono">{selectedCamera?.label || "Live Camera"}</span>
              </div>

              <button
                onClick={() => setIsMaximized(false)}
                className="bg-black/80 hover:bg-black text-white px-3.5 py-2 rounded-lg transition-colors cursor-pointer backdrop-blur-sm border border-white/20 flex items-center gap-1.5 text-xs font-bold"
                title="Exit Fullscreen (Esc)"
              >
                <Minimize size={15} />
                <span>Exit Fullscreen</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );

  // -------------------------------------------------------------
  // Right Panel: Active Enforcement & Real-Time Matches
  // -------------------------------------------------------------
  const rightPanelComponent = (
    <div
      className="border rounded-xl p-0 shadow-md relative overflow-hidden flex flex-col h-full"
      style={{
        backgroundColor: isDark ? "#110000" : "#fff5f5",
        borderColor: isDark ? "#4a0000" : "#fecaca"
      }}
    >
      {/* Card Header */}
      <div className="px-3 py-2 bg-red-600 text-white flex justify-between items-center shrink-0 shadow-sm">
        <h3 className="text-xs font-bold uppercase flex items-center gap-1.5 tracking-wide">
          <ShieldAlert size={14} /> Active Threat Enforcement
        </h3>
        <span className="text-[9px] font-bold px-2 py-0.5 bg-black/30 rounded-full animate-pulse uppercase border border-white/20">
          Live Matches
        </span>
      </div>

      {/* Matches List */}
      <div className="flex-1 overflow-y-auto hide-scrollbar flex flex-col divide-y divide-red-500/10 p-1">
        {filteredDetections.slice(0, 5).map((d) => (
          <div
            key={d.detectionId}
            onClick={() => handleViewDetails(d)}
            className="flex items-center gap-2.5 p-2 hover:bg-red-500/10 transition-all rounded-lg cursor-pointer group"
          >
            {/* Mugshot / Face Snapshot */}
            <div className="w-11 h-11 bg-black/50 rounded-lg flex-shrink-0 overflow-hidden relative border border-red-500/40 shadow-inner flex items-center justify-center group-hover:border-red-500 transition-colors">
              {d.photo ? (
                <img src={d.photo} alt="Mugshot" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
              ) : (
                <Fingerprint className="w-6 h-6 text-red-400 group-hover:scale-110 transition-transform" />
              )}
              <div className="absolute bottom-0 inset-x-0 bg-red-600 text-white text-[7px] font-extrabold text-center py-0.2">
                {d.confidence}%
              </div>
            </div>

            {/* Offender Info */}
            <div className="flex-1 flex flex-col min-w-0">
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <p className="font-extrabold text-xs text-red-500 truncate leading-tight group-hover:text-red-400">
                  {d.firstName} {d.lastName}
                </p>
                <span className={`text-[8px] font-extrabold px-1.5 py-0.2 rounded uppercase ${d.severity === 'Critical' ? 'bg-red-500/20 text-red-500 border border-red-500/40' : 'bg-orange-500/20 text-orange-500 border border-orange-500/40'
                  }`}>
                  {d.severity}
                </span>
              </div>

              <p className="text-[10px] text-gray-400 font-medium truncate mb-0.5">
                {d.crimeCategory} • <span className="text-gray-300 font-semibold">{d.aliases || d.criminalId}</span>
              </p>

              <div className="flex items-center justify-between text-[9px] text-gray-400">
                <span className="flex items-center gap-1 truncate">
                  <MapPin size={9} className="text-red-400" /> {d.location}
                </span>
                <span className="flex items-center gap-1 font-mono">
                  <Clock size={9} /> {d.time}
                </span>
              </div>
            </div>
          </div>
        ))}

        {filteredDetections.length === 0 && (
          <div className="p-6 text-center opacity-60 m-auto flex flex-col items-center">
            <ShieldCheck className="w-8 h-8 mb-1.5 text-emerald-500 opacity-60" />
            <p className="text-[11px] font-bold uppercase tracking-wider">No Active Threat Alerts</p>
            <p className="text-[10px] text-gray-400 mt-0.5">All monitored surveillance zones clear</p>
          </div>
        )}
      </div>

      {/* Quick Acknowledge Bottom Bar */}
      <div className="px-3 py-1.5 bg-black/10 border-t border-red-500/20 flex items-center justify-between shrink-0">
        <span className="text-[9px] text-gray-400 font-medium">
          Showing top {Math.min(filteredDetections.length, 5)} active alerts
        </span>
        <button
          onClick={simulateLiveDetection}
          className="text-[9px] font-bold text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer transition-colors"
        >
          <Sparkles size={10} /> Simulate Alert
        </button>
      </div>
    </div>
  );

  // -------------------------------------------------------------
  // Video Component: Multi-Camera Surveillance Grid
  // -------------------------------------------------------------
  const getUnacknowledgedForCam = (cam) => {
    if (!cam) return [];
    return detections.filter(d => {
      if (d.status === 'VERIFIED' || d.status === 'DISPATCHED') return false;
      const camIdStr = String(cam.id || cam.value || cam.camera_id || '');
      return String(d.cameraId) === camIdStr || String(d.camera || '').includes(cam.label || '') || String(d.camera || '').includes(cam.value || '');
    });
  };

  const cameraGridComponent = (
    <div
      className="flex flex-col gap-3 p-4 rounded-xl border w-full"
      style={{ backgroundColor: cardBg, borderColor }}
    >
      <div className="flex flex-wrap items-center justify-between border-b pb-3 gap-3" style={{ borderColor }}>
        <div className="flex items-center gap-2">
          <CameraIcon size={18} className="text-blue-500" />
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: textPrimary }}>
            Criminal Detection Live AI Surveillance ({camerasList.length} Cameras)
          </span>
        </div>

        <div className="flex items-center gap-3">
          <RecordsPerPage
            value={gridItemsPerPage}
            onChange={(val) => { setGridItemsPerPage(val); setGridCurrentPage(1); }}
            options={[4, 8, 12, 16]}
            label="Cameras per page"
          />
        </div>
      </div>

      {camerasList.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[220px] gap-2 opacity-60">
          <CameraIcon size={36} />
          <p className="text-xs font-medium" style={{ color: textSecondary }}>
            No cameras mapped for Criminal Detection.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {paginatedCameras.map((cam) => (
            <div
              key={cam.id || cam.value}
              className="h-48 sm:h-56 md:h-60 lg:h-64 xl:h-72 2xl:h-80 rounded-lg overflow-hidden border relative group"
              style={{ borderColor }}
            >
              <LiveCameraCard
                camera={cam}
                showDetectionDot={true}
                unacknowledgedItems={getUnacknowledgedForCam(cam)}
                onAcknowledgeItem={(det) => handleAcknowledgeDetection(det.detectionId || det.id)}
              />
            </div>
          ))}
        </div>
      )}

      {camerasList.length > gridItemsPerPage && (
        <div className="pt-2">
          <Pagination
            currentPage={gridCurrentPage}
            totalItems={camerasList.length}
            itemsPerPage={gridItemsPerPage === null || gridItemsPerPage === Infinity ? camerasList.length || 1 : gridItemsPerPage}
            onPageChange={(page) => setGridCurrentPage(page)}
          />
        </div>
      )}
    </div>
  );

  // -------------------------------------------------------------
  // Full-Width Stats Cards: Total Detected + Severities (Dynamic)
  // -------------------------------------------------------------
  const fullScreenStatsCards = (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 w-full">
      {criminalStats.map((stat, i) => (
        <div
          key={stat.id || i}
          className="px-4 py-3 rounded-xl border flex items-center justify-between shadow-sm transition-all hover:shadow-md gap-2 min-h-[68px]"
          style={{ backgroundColor: cardBg, borderColor }}
        >
          <span
            className="text-[11px] font-extrabold uppercase tracking-wider leading-snug"
            style={{ color: textSecondary }}
          >
            {stat.title}
          </span>
          <span
            className="text-2xl sm:text-3xl font-black shrink-0"
            style={{ color: stat.color }}
          >
            {stat.count}
          </span>
        </div>
      ))}
    </div>
  );

  // Upper Section: Multi-Camera Live AI Surveillance Grid + Full-Width Stats
  const upperSection = (
    <div className="flex flex-col gap-3 w-full">
      {cameraGridComponent}
      {fullScreenStatsCards}
    </div>
  );

  // -------------------------------------------------------------
  // Table Columns
  // -------------------------------------------------------------
  const tableColumns = [
    {
      header: "SR.NO",
      accessor: "srNo",
      render: (row) => (
        <span className="font-bold text-xs text-blue-500 bg-blue-500/10 px-2 py-1 rounded w-max">
          {row.srNo}
        </span>
      )
    },
    {
      header: "CRIMINAL ID",
      accessor: "criminalId",
      render: (row) => (
        <div className="flex items-center gap-1.5 font-semibold text-xs" style={{ color: textPrimary }}>
          <span>{row.criminalId}</span>
        </div>
      )
    },
    {
      header: "PHOTO",
      accessor: "photo",
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-lg border overflow-hidden bg-black/40 flex items-center justify-center shrink-0" style={{ borderColor }}>
            {row.photo ? (
              <img src={row.photo} alt="Mugshot" className="w-full h-full object-cover" />
            ) : (
              <Fingerprint className="w-5 h-5" style={{ color: textSecondary }} />
            )}
          </div>
        </div>
      )
    },
    {
      header: "CRIMINAL NAME",
      accessor: "firstName",
      render: (row) => (
        <div className="flex flex-col min-w-0">
          <span className="font-semibold text-xs truncate" style={{ color: textPrimary }}>
            {row.firstName} {row.lastName}
          </span>
          {row.aliases && (
            <span className="text-xs italic truncate" style={{ color: textSecondary }}>
              alias "{row.aliases}"
            </span>
          )}
        </div>
      )
    },
    {
      header: "AADHAR NUMBER",
      accessor: "aadharNumber",
      render: (row, idx) => (
        <span className="font-mono text-xs font-semibold tracking-wider" style={{ color: textPrimary }}>
          {formatAadharDisplay(row.aadharNumber, idx)}
        </span>
      )
    },
    {
      header: "CRIME CATEGORY",
      accessor: "crimeCategory",
      render: (row) => (
        <span className="text-xs font-medium truncate" style={{ color: textPrimary }}>
          {row.crimeCategory}
        </span>
      )
    },
    {
      header: "SEVERITY",
      accessor: "severity",
      render: (row) => {
        const sevLower = (row.severity || '').toLowerCase();
        const sevColor = sevLower === 'critical' ? '#ef4444' : sevLower === 'high' ? '#f97316' : sevLower === 'medium' ? '#eab308' : '#3b82f6';
        return (
          <span
            className="text-xs font-bold uppercase px-2 py-0.5 rounded"
            style={{ color: sevColor, backgroundColor: `${sevColor}18` }}
          >
            {row.severity}
          </span>
        );
      }
    },
    {
      header: "FIR NUMBER",
      accessor: "firNumber",
      render: (row) => (
        <span className="font-mono text-xs" style={{ color: textPrimary }}>
          {row.firNumber || '—'}
        </span>
      )
    },
    {
      header: "CAMERA & LOCATION",
      accessor: "location",
      render: (row) => {
        const cam = row.camera || (row.cameraId ? `CAM-${row.cameraId}` : '');
        const loc = row.location || '';
        const zn = row.zone || '';
        const locZone = [loc, zn].filter(Boolean).join(" • ");
        return (
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-xs truncate" style={{ color: textPrimary }}>
              {cam || loc || '—'}
            </span>
            <span className="text-xs truncate" style={{ color: textSecondary }}>
              {locZone || (cam ? 'Live Surveillance' : '—')}
            </span>
          </div>
        );
      }
    },
    {
      header: "DETECTION TIME",
      accessor: "detected_at",
      render: (row) => {
        const raw = row.detected_at || row.detection_time || row.createdAt || row.created_at;
        const d = raw ? new Date(raw) : null;
        const isValid = d && !isNaN(d.getTime());
        const timeStr = isValid
          ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
          : (row.time || '—');
        const dateStr = isValid
          ? d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
          : (row.date || '—');
        return (
          <div className="flex flex-col text-xs">
            <span className="font-semibold" style={{ color: textPrimary }}>{timeStr}</span>
            <span className="text-xs" style={{ color: textSecondary }}>{dateStr}</span>
          </div>
        );
      }
    },
    {
      header: "STATUS",
      accessor: "status",
      render: (row) => {
        const st = (row.status || '').toUpperCase();
        const isTriggered = st.includes('TRIGGERED') || st.includes('ALERT');
        const isVerified = st.includes('VERIFIED');
        const isDispatched = st.includes('DISPATCHED');
        const badgeColor = isTriggered ? '#ef4444' : isVerified ? '#3b82f6' : isDispatched ? '#8b5cf6' : '#10b981';
        return (
          <span
            className="text-xs font-bold uppercase px-2 py-0.5 rounded"
            style={{ color: badgeColor, backgroundColor: `${badgeColor}18` }}
          >
            {row.status}
          </span>
        );
      }
    },
    {
      header: "ACTION",
      accessor: "action",
      render: (row) => (
        <button
          onClick={() => handleViewDetails(row)}
          className="p-1.5 rounded bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-colors cursor-pointer"
          title="View Forensic Details & Criminal Dossier"
        >
          <Eye size={14} />
        </button>
      )
    }
  ];

  return (
    <ModuleLayout
      title="Criminal Detection"
      hideLiveSystem={true}
      hideCameraInHeader={false}
      videoComponent={upperSection}
      rightPanelComponent={null}
      bottomMetricsComponent={null}
      bottomTableComponent={
        <>
          <PaginatedTable
            title="RECENT CRIMINAL DETECTIONS"
            columns={tableColumns}
            data={filteredDetections}
            itemsPerPage={10}
            headerContent={
              <div className="flex items-center gap-2 flex-wrap">
                {/* Search Bar */}
                <div className="w-56">
                  <SearchBar
                    searchValue={searchQuery}
                    onSearchChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search name, alias, ID, FIR, Aadhar..."
                  />
                </div>

                {/* Severity Filter */}
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value)}
                  className="px-2.5 py-1 h-8 text-xs border rounded-lg outline-none cursor-pointer font-medium transition-colors"
                  style={{
                    borderColor,
                    backgroundColor: isDark ? '#1e293b' : '#ffffff',
                    color: textPrimary
                  }}
                >
                  <option value="" style={{ backgroundColor: isDark ? '#1e293b' : '#ffffff', color: isDark ? '#f8fafc' : '#0f172a' }}>All Severities</option>
                  {(dbMeta.severities && dbMeta.severities.length > 0 ? dbMeta.severities.map(s => s.name || s.severity_name) : ['Critical', 'High', 'Medium', 'Low']).map(sev => (
                    <option key={sev} value={sev} style={{ backgroundColor: isDark ? '#1e293b' : '#ffffff', color: isDark ? '#f8fafc' : '#0f172a' }}>{sev}</option>
                  ))}
                </select>

                {/* Category Filter */}
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-2.5 py-1 h-8 text-xs border rounded-lg outline-none cursor-pointer font-medium max-w-[170px] transition-colors"
                  style={{
                    borderColor,
                    backgroundColor: isDark ? '#1e293b' : '#ffffff',
                    color: textPrimary
                  }}
                >
                  <option value="" style={{ backgroundColor: isDark ? '#1e293b' : '#ffffff', color: isDark ? '#f8fafc' : '#0f172a' }}>All Categories</option>
                  {dynamicCategories.map(cat => (
                    <option key={cat} value={cat} style={{ backgroundColor: isDark ? '#1e293b' : '#ffffff', color: isDark ? '#f8fafc' : '#0f172a' }}>{cat}</option>
                  ))}
                </select>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-2.5 py-1 h-8 text-xs border rounded-lg outline-none cursor-pointer font-medium transition-colors"
                  style={{
                    borderColor,
                    backgroundColor: isDark ? '#1e293b' : '#ffffff',
                    color: textPrimary
                  }}
                >
                  <option value="" style={{ backgroundColor: isDark ? '#1e293b' : '#ffffff', color: isDark ? '#f8fafc' : '#0f172a' }}>All Statuses</option>
                  {(dbMeta.statuses && dbMeta.statuses.length > 0 ? dbMeta.statuses.map(st => st.status_name) : ['Alert Triggered', 'Verified', 'Dispatched', 'Resolved']).map(st => (
                    <option key={st} value={st.toUpperCase()} style={{ backgroundColor: isDark ? '#1e293b' : '#ffffff', color: isDark ? '#f8fafc' : '#0f172a' }}>{st}</option>
                  ))}
                </select>

                {/* Date Range Picker */}
                <DateRangePicker
                  fromDate={fromDate}
                  toDate={toDate}
                  onFromChange={setFromDate}
                  onToChange={setToDate}
                />
              </div>
            }
          />

          {/* Forensic Criminal Dossier Modal */}
          <RightSideDialog
            visible={isModalOpen}
            onHide={() => setIsModalOpen(false)}
            header="Criminal Detection"
            width="w-full md:w-[36rem] lg:w-[44rem]"
          >
            {selectedRecord && (
              <div className="flex flex-col gap-6 pt-2 pb-12">
                {/* Top Alert Banner */}
                <div className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${selectedRecord.severity === 'Critical' ? 'bg-red-500/10 border-red-500/40 text-red-500' : 'bg-orange-500/10 border-orange-500/40 text-orange-500'
                  }`}>
                  <div className="flex items-center gap-3">
                    <ShieldAlert size={28} className="shrink-0 animate-pulse" />
                    <div>
                      <p className="text-xs font-extrabold uppercase tracking-wide">
                        {selectedRecord.severity} Threat Alert • {selectedRecord.status}
                      </p>
                      <p className="text-sm font-bold text-gray-900 dark:text-white">
                        {selectedRecord.firstName} {selectedRecord.lastName} ({selectedRecord.criminalId})
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black">{selectedRecord.confidence}%</span>
                    <p className="text-[10px] font-bold opacity-80 uppercase">Match Score</p>
                  </div>
                </div>

                {/* Mugshot vs Live Capture Comparison */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col items-center p-3 rounded-xl border bg-black/5 dark:bg-white/5" style={{ borderColor }}>
                    <div className="w-full h-44 rounded-lg bg-black/40 border overflow-hidden flex items-center justify-center relative mb-2" style={{ borderColor }}>
                      {officialRegistrationPhoto ? (
                        <img src={officialRegistrationPhoto} alt="Official Registration Mugshot" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-center p-2">
                          <Fingerprint className="w-12 h-12 text-blue-400 mb-1" />
                          <span className="text-[10px] text-gray-400">No Registration Photo</span>
                        </div>
                      )}
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-blue-600 text-white text-[9px] font-bold uppercase shadow">
                        Registered Photo
                      </span>
                    </div>
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Official Register Image</span>
                    <span className="text-[10px] text-gray-500">Database Record</span>
                  </div>

                  <div className="flex flex-col items-center p-3 rounded-xl border bg-red-950/10 border-red-500/30">
                    <div className="w-full h-44 rounded-lg bg-black/50 border-2 border-red-500/50 overflow-hidden flex items-center justify-center relative mb-2 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                      {selectedRecord.face_image || selectedRecord.mugshot || selectedRecord.photo ? (
                        <img src={selectedRecord.face_image || selectedRecord.mugshot || selectedRecord.photo} alt="Live Intercept" className="w-full h-full object-cover" />
                      ) : (
                        <div className="relative flex flex-col items-center">
                          <Fingerprint className="w-16 h-16 text-red-500 animate-pulse" />
                          <span className="text-[10px] font-mono text-red-400 font-bold mt-1">FACIAL_ID_{selectedRecord.id || '9872'}</span>
                        </div>
                      )}
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-red-600 text-white text-[9px] font-bold uppercase shadow">
                        Live AI Snapshot
                      </span>
                      <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-emerald-400 text-[9px] font-bold border border-emerald-500/40">
                        {selectedRecord.confidence}% Match
                      </span>
                    </div>
                    <span className="text-xs font-bold text-red-500">Surveillance Intercept</span>
                    <span className="text-[10px] text-gray-500">{selectedRecord.camera}</span>
                  </div>
                </div>

                {/* Full Frame Annotated Detection Snapshot (from Python Backend) */}
                {(selectedRecord.snapshot || selectedRecord.snapshot_path) && (
                  <div className="p-3.5 rounded-xl border bg-black/5 dark:bg-white/5" style={{ borderColor }}>
                    <p className="text-[10px] font-bold uppercase opacity-70 mb-2 flex items-center gap-1.5" style={{ color: textSecondary }}>
                      <CameraIcon size={13} className="text-red-500" /> Full Camera Scene Annotated Snapshot
                    </p>
                    <div className="w-full rounded-lg overflow-hidden bg-black max-h-56 border" style={{ borderColor }}>
                      <img src={selectedRecord.snapshot || selectedRecord.snapshot_path} alt="Detection Full Frame" className="w-full h-full object-contain" />
                    </div>
                  </div>
                )}

                {/* Recorded Detection Video Intercept */}
                {(() => {
                  const resolvedVideo = getMediaUrl(
                    selectedRecord.video ||
                    selectedRecord.video_path
                  );
                  if (resolvedVideo) {
                    return (
                      <div className="p-3.5 rounded-xl border bg-black/5 dark:bg-white/5" style={{ borderColor }}>
                        <p className="text-[10px] font-bold uppercase opacity-70 mb-2 flex items-center justify-between" style={{ color: textSecondary }}>
                          <span className="flex items-center gap-1.5">
                            <Video size={13} className="text-red-500" /> Recorded Detection Video Intercept
                          </span>
                          <span className="text-[9px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                            EVIDENCE SECURED
                          </span>
                        </p>
                        <div className="w-full rounded-lg overflow-hidden bg-black aspect-video max-h-56">
                          <video
                            key={resolvedVideo}
                            controls
                            playsInline
                            preload="auto"
                            className="w-full h-full object-contain"
                          >
                            <source src={resolvedVideo} type="video/mp4" />
                            Your browser does not support HTML5 video playback.
                          </video>
                        </div>
                      </div>
                    );
                  }
                  if (selectedRecord.awaiting_clip) {
                    return (
                      <div className="p-3.5 rounded-xl border border-blue-500/30 bg-blue-500/10 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <RefreshCw size={14} className="animate-spin text-blue-500" />
                          <div>
                            <p className="text-xs font-bold text-blue-500">Securing ~7s video evidence clip...</p>
                            <p className="text-[10px] text-gray-400">Pre/post buffer video encoding in progress on server</p>
                          </div>
                        </div>
                        <span className="text-[10px] px-2 py-1 rounded bg-blue-500/20 text-blue-400 font-mono font-bold">
                          Arrives in ~4s
                        </span>
                      </div>
                    );
                  }
                  return (
                    <div className="p-3.5 rounded-xl border border-dashed flex items-center justify-between opacity-70" style={{ borderColor }}>
                      <div className="flex items-center gap-2">
                        <Video size={14} className="text-gray-400" />
                        <span className="text-xs text-gray-400">Recorded Detection Video Intercept</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-gray-500/20 text-gray-400 font-mono">
                        Snapshot Only
                      </span>
                    </div>
                  );
                })()}

                {/* Personal Information Grid */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-1.5">
                    <User size={13} className="text-blue-500" /> Personal Identity
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-xl border" style={{ borderColor, backgroundColor: cardBg }}>
                      <p className="text-[10px] font-bold uppercase opacity-70 mb-1" style={{ color: textSecondary }}>Full Name</p>
                      <p className="font-semibold text-sm truncate">{selectedRecord.firstName} {selectedRecord.lastName}</p>
                    </div>
                    <div className="p-3 rounded-xl border" style={{ borderColor, backgroundColor: cardBg }}>
                      <p className="text-[10px] font-bold uppercase opacity-70 mb-1" style={{ color: textSecondary }}>Nickname</p>
                      <p className="font-semibold text-sm truncate">{selectedRecord.aliases || 'None'}</p>
                    </div>
                    <div className="p-3 rounded-xl border" style={{ borderColor, backgroundColor: cardBg }}>
                      <p className="text-[10px] font-bold uppercase opacity-70 mb-1" style={{ color: textSecondary }}>Aadhar Card</p>
                      <p className="font-semibold text-sm font-mono text-blue-500 truncate">{formatAadharDisplay(selectedRecord.aadharNumber)}</p>
                    </div>
                    <div className="p-3 rounded-xl border" style={{ borderColor, backgroundColor: cardBg }}>
                      <p className="text-[10px] font-bold uppercase opacity-70 mb-1" style={{ color: textSecondary }}>Criminal Code</p>
                      <p className="font-semibold text-sm text-blue-500 font-mono truncate">{selectedRecord.criminalId}</p>
                    </div>
                  </div>
                </div>

                {/* Legal & Crime Profile */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-1.5">
                    <AlertTriangle size={13} className="text-orange-500" /> Offense & Legal Details
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl border" style={{ borderColor, backgroundColor: cardBg }}>
                      <p className="text-[10px] font-bold uppercase opacity-70 mb-1" style={{ color: textSecondary }}>Crime Category</p>
                      <p className="font-semibold text-sm text-red-500">{selectedRecord.crimeCategory}</p>
                    </div>
                    <div className="p-3 rounded-xl border" style={{ borderColor, backgroundColor: cardBg }}>
                      <p className="text-[10px] font-bold uppercase opacity-70 mb-1" style={{ color: textSecondary }}>FIR Reference</p>
                      <p className="font-semibold text-sm font-mono">{selectedRecord.firNumber}</p>
                    </div>
                  </div>
                </div>

                {/* Surveillance Metadata */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-1.5">
                    <CameraIcon size={13} className="text-purple-500" /> Detection Incident Metadata
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl border" style={{ borderColor, backgroundColor: cardBg }}>
                      <p className="text-[10px] font-bold uppercase opacity-70 mb-1" style={{ color: textSecondary }}>Surveillance Camera</p>
                      <p className="font-semibold text-sm truncate">{selectedRecord.camera}</p>
                    </div>
                    <div className="p-3 rounded-xl border" style={{ borderColor, backgroundColor: cardBg }}>
                      <p className="text-[10px] font-bold uppercase opacity-70 mb-1" style={{ color: textSecondary }}>Location & Zone</p>
                      <p className="font-semibold text-sm truncate">{selectedRecord.location} ({selectedRecord.zone})</p>
                    </div>
                    <div className="p-3 rounded-xl border" style={{ borderColor, backgroundColor: cardBg }}>
                      <p className="text-[10px] font-bold uppercase opacity-70 mb-1" style={{ color: textSecondary }}>Detection Timestamp</p>
                      <p className="font-semibold text-sm truncate">
                        {new Date(selectedRecord.detected_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Enforcement Actions Toolbar */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t" style={{ borderColor }}>
                  <button
                    onClick={() => {
                      handleDispatchDetection(selectedRecord.id || selectedRecord.detectionId);
                      setIsModalOpen(false);
                    }}
                    className="flex-1 min-w-[160px] py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <CheckCircle2 size={16} /> Confirm & Dispatch
                  </button>
                  <button
                    onClick={() => {
                      handleAcknowledgeDetection(selectedRecord.id || selectedRecord.detectionId);
                      setIsModalOpen(false);
                    }}
                    className="py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    Verify Alert
                  </button>
                  <button
                    onClick={() => {
                      handleDeleteDetection(selectedRecord.id || selectedRecord.detectionId);
                    }}
                    className="py-2.5 px-4 rounded-xl border border-red-500/40 text-red-500 hover:bg-red-500/10 font-bold text-xs transition-all cursor-pointer"
                  >
                    Dismiss False Alert
                  </button>
                </div>
              </div>
            )}
          </RightSideDialog>

          {/* Python AI & Camera Stream Configuration Drawer */}
          <RightSideDialog
            visible={isSettingsDrawerOpen}
            onHide={() => setIsSettingsDrawerOpen(false)}
            header="Python AI Face Recognizer & Stream Configuration"
            width="w-full md:w-[32rem] lg:w-[38rem]"
          >
            <div className="flex flex-col gap-5 pt-2 pb-10">
              {/* Server Status Header Card */}
              <div className={`p-4 rounded-xl border flex items-center justify-between ${serverHealth.status === 'ok'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
                }`}>
                <div className="flex items-center gap-3">
                  <Server size={24} className="shrink-0" />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide">
                      Python Face Recognizer Server
                    </p>
                    <p className="text-sm font-semibold text-gray-200">
                      Status: {serverHealth.status === 'ok' ? 'HEALTHY & RUNNING' : (serverHealth.status === 'offline' ? 'OFFLINE / UNREACHABLE' : 'READY')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-lg font-mono font-black">{serverHealth.active_recognizers}</span>
                  <p className="text-[10px] font-bold opacity-80 uppercase">Active Streams</p>
                </div>
              </div>

              {/* Live Connection Diagnostics */}
              <div className="p-3.5 rounded-xl border flex items-center justify-between" style={{ borderColor, backgroundColor: cardBg }}>
                <div className="flex items-center gap-2.5">
                  <div className={`w-3 h-3 rounded-full ${isStreamConnected ? 'bg-emerald-500 animate-ping' : 'bg-red-500'}`} />
                  <div>
                    <p className="text-xs font-bold text-gray-200">Live WebSocket Connection</p>
                    <p className="text-[11px] text-gray-400">
                      {isStreamConnected ? `Streaming frames at ~${streamFps || 15} FPS` : (isStreamConnecting ? 'Connecting to socket...' : 'Socket disconnected')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCheckHealth}
                    disabled={isCheckingHealth}
                    className="px-2.5 py-1.5 rounded-lg bg-blue-600/80 hover:bg-blue-600 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Activity size={13} className={isCheckingHealth ? "animate-spin" : ""} />
                    <span>Ping Health</span>
                  </button>
                  <button
                    onClick={() => {
                      if (isStreamConnected) disconnectStream();
                      else connectStream();
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${isStreamConnected ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      }`}
                  >
                    {isStreamConnected ? <Square size={13} /> : <Play size={13} />}
                    <span>{isStreamConnected ? 'Stop' : 'Start'}</span>
                  </button>
                </div>
              </div>

              {/* Face Database Reload Tool Card */}
              <div className="p-4 rounded-xl border flex flex-col gap-3" style={{ borderColor, backgroundColor: cardBg }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database size={16} className="text-yellow-500" />
                    <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wide">Face Database Indexing</h4>
                  </div>
                  <button
                    onClick={handleReloadFaceDatabase}
                    disabled={isReloadingDb}
                    className="px-3 py-1.5 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow cursor-pointer disabled:opacity-50"
                  >
                    <RotateCcw size={13} className={isReloadingDb ? "animate-spin" : ""} />
                    <span>{isReloadingDb ? 'Rebuilding Index...' : 'POST /faces/reload'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Call this after registering or uploading new person video clips on the server, so newly registered suspects become recognizable in real-time without restarting Python.
                </p>
                {reloadResult && (
                  <div className={`p-2.5 rounded-lg text-xs border font-mono ${reloadResult.status === 'success'
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                    : 'bg-red-950/40 border-red-500/40 text-red-300'
                    }`}>
                    {reloadResult.status === 'success' ? (
                      <div>
                        ✓ Successfully indexed <span className="font-bold text-white">{reloadResult.num_faces}</span> faces in <span className="font-bold text-white">{reloadResult.duration}</span> (changed: {String(reloadResult.changed)})
                      </div>
                    ) : (
                      <div>⚠ {reloadResult.message || 'Face reload error.'}</div>
                    )}
                  </div>
                )}
              </div>

              {/* Camera RTSP Stream URL Configuration */}
              <div className="p-4 rounded-xl border flex flex-col gap-3" style={{ borderColor, backgroundColor: cardBg }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CameraIcon size={16} className="text-blue-500" />
                    <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wide">Camera RTSP Stream URL</h4>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-mono font-bold">Required for WS</span>
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Full RTSP URL of the IP camera. Must include credentials if camera is protected.
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customRtspInput}
                    onChange={(e) => setCustomRtspInput(e.target.value)}
                    placeholder="rtsp://admin:pass@192.168.1.50:554/stream1"
                    className="flex-1 px-3 py-2 text-xs border rounded-lg font-mono outline-none"
                    style={{
                      borderColor,
                      backgroundColor: themeUtils.getBgColor('input'),
                      color: textPrimary
                    }}
                  />
                  <button
                    onClick={() => {
                      if (!customRtspInput) {
                        toast.error("RTSP URL Missing", "Please enter a valid RTSP stream URL.");
                        return;
                      }
                      setStreamRtspUrl(customRtspInput);
                      reconnectStream(customRtspInput);
                      toast.success("RTSP Applied", "Connecting stream with updated camera URL...");
                    }}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all shadow cursor-pointer shrink-0"
                  >
                    Apply & Stream
                  </button>
                </div>
                <div className="p-2 rounded bg-black/40 border border-white/10 text-[10px] font-mono text-gray-400 break-all">
                  <span className="text-blue-400 font-bold">Encoded Query:</span> {pythonWsUrl}/face/ws?rtsp_url={encodeURIComponent(customRtspInput || activeRtspUrl)}
                </div>
              </div>

              {/* Server Host Config */}
              <div className="p-4 rounded-xl border flex flex-col gap-3" style={{ borderColor, backgroundColor: cardBg }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server size={16} className="text-purple-500" />
                    <h4 className="text-xs font-bold text-gray-200 uppercase tracking-wide">Python Server Endpoints</h4>
                  </div>
                  {/* Preset Buttons */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        const localApi = "http://localhost:8090";
                        const localWs = "ws://localhost:8090";
                        setCustomApiInput(localApi);
                        setCustomWsInput(localWs);
                        setPythonApiUrl(localApi);
                        setPythonWsUrl(localWs);
                        toast.info("Host Updated", "Set to localhost");
                      }}
                      className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white/10 hover:bg-white/20 text-gray-300 cursor-pointer"
                    >
                      Localhost
                    </button>
                    <button
                      onClick={() => {
                        const prodApi = "http://110.227.253.23:8090";
                        const prodWs = "ws://110.227.253.23:8090";
                        setCustomApiInput(prodApi);
                        setCustomWsInput(prodWs);
                        setPythonApiUrl(prodApi);
                        setPythonWsUrl(prodWs);
                        toast.info("Host Updated", "Set to production server");
                      }}
                      className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white/10 hover:bg-white/20 text-gray-300 cursor-pointer"
                    >
                      Production
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">API HTTP Endpoint</label>
                    <input
                      type="text"
                      value={customApiInput}
                      onChange={(e) => setCustomApiInput(e.target.value)}
                      placeholder="http://110.227.253.23"
                      className="w-full px-3 py-2 text-xs border rounded-lg font-mono outline-none"
                      style={{
                        borderColor,
                        backgroundColor: themeUtils.getBgColor('input'),
                        color: textPrimary
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">WebSocket Endpoint</label>
                    <input
                      type="text"
                      value={customWsInput}
                      onChange={(e) => setCustomWsInput(e.target.value)}
                      placeholder="ws://110.227.253.23"
                      className="w-full px-3 py-2 text-xs border rounded-lg font-mono outline-none"
                      style={{
                        borderColor,
                        backgroundColor: themeUtils.getBgColor('input'),
                        color: textPrimary
                      }}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => {
                      setPythonApiUrl(customApiInput);
                      setPythonWsUrl(customWsInput);
                      reconnectStream();
                      toast.success("Endpoints Saved", "Python server settings updated and stream reconnected.");
                      setIsSettingsDrawerOpen(false);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow cursor-pointer"
                  >
                    Save & Reconnect
                  </button>
                </div>
              </div>
            </div>
          </RightSideDialog>
        </>
      }
      cameraFilter={cameraFilter}
      headerActions={
        <div className="flex items-center gap-2">





          {/* Refresh Button */}
          <button
            onClick={() => {
              fetchDetections();
              toast.info("Refreshed", "Criminal detection feeds updated from database");
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded-lg text-xs font-bold transition-all border border-blue-500/30 shadow-sm shrink-0 cursor-pointer"
          >
            <RefreshCw size={14} /> Refresh
          </button>

          {/* Export Button */}
          <button
            onClick={() => {
              import('../../utils/exportUtils').then(({ exportToCSV }) => {
                exportToCSV(filteredDetections, 'criminal_detections_report');
              });
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-500 rounded-lg text-xs font-bold transition-all border border-green-500/30 shadow-sm shrink-0 cursor-pointer"
          >
            <Download size={14} /> Export
          </button>
        </div>
      }
    />
  );
}
