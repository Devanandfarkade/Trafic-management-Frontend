import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  Camera,
  Video,
  Upload,
  User,
  Calendar,
  MapPin,
  FileText,
  AlertTriangle,
  Eye,
  Trash2,
  Edit,
  CheckCircle2,
  RefreshCw,
  Search,
  Filter,
  Users,
  Fingerprint,
  Radio,
  Image as ImageIcon,
  Sparkles,
  Maximize2,
  X,
  Plus
} from 'lucide-react';
import { FaSort, FaSortUp, FaSortDown } from 'react-icons/fa';
import { useTheme } from '../../ui/Settings/themeUtils';
import PageHeader from '../../ui/common/PageHeader';
import PaginatedTable from '../../ui/common/PaginatedTable';
import SearchBar from '../../ui/common/SearchBar';
import RightSideDialog from '../../ui/common/RightSideDialog';
import DateRangePicker from '../../ui/common/DateRangePicker';
import { useToast } from '../../ui/common/CustomToast';
import { getTodayStr, toLocalDateStr } from '../../utils/dateUtils';
import { API_BASE_URL, API_CONFIG } from '../../../config.js';

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

const SEVERITY_LEVELS = [
  { label: 'Critical', color: 'text-red-500', bg: 'bg-red-500/20', border: 'border-red-500/40' },
  { label: 'High', color: 'text-orange-500', bg: 'bg-orange-500/20', border: 'border-orange-500/40' },
  { label: 'Medium', color: 'text-yellow-500', bg: 'bg-yellow-500/20', border: 'border-yellow-500/40' },
  { label: 'Low', color: 'text-blue-500', bg: 'bg-blue-500/20', border: 'border-blue-500/40' }
];

const INITIAL_CRIMINALS = [
  {
    id: 'CR-8801',
    firstName: 'Vikram',
    lastName: 'Shinde',
    aliases: 'Vicky Don',
    gender: 'Male',
    age: '34',
    crimeCategory: 'Wanted Criminal',
    severity: 'Critical',
    firNumber: 'FIR-2026/089',
    location: 'Baramati MIDC',
    zone: 'South Zone',
    idMarks: 'Deep scar on left eyebrow, snake tattoo on right forearm',
    nationalId: 'XXXX-XXXX-9021',
    aadharNumber: '894230198421',
    joiningDate: '2026-09-15',
    status: 'ACTIVE WATCHLIST',
    photo: null,
    notes: 'Armed and dangerous. High priority target.'
  },
  {
    id: 'CR-8802',
    firstName: 'Ramesh',
    lastName: 'Gaikwad',
    aliases: 'Pappu',
    gender: 'Male',
    age: '29',
    crimeCategory: 'Robbery / Theft',
    severity: 'High',
    firNumber: 'FIR-2026/112',
    location: 'Tiranga Circle',
    zone: 'North Zone',
    idMarks: 'Mole under right eye',
    nationalId: 'XXXX-XXXX-4512',
    aadharNumber: '782349102834',
    joiningDate: '2026-09-28',
    status: 'ACTIVE WATCHLIST',
    photo: null,
    notes: 'Involved in multiple vehicle and shop theft incidents.'
  },
  {
    id: 'CR-8803',
    firstName: 'Anjali',
    lastName: 'Patil',
    aliases: 'Madam',
    gender: 'Female',
    age: '31',
    crimeCategory: 'Fraud / Cyber Crime',
    severity: 'Medium',
    firNumber: 'FIR-2026/145',
    location: 'City Main Road',
    zone: 'East Zone',
    idMarks: 'Burn mark on right wrist',
    nationalId: 'XXXX-XXXX-7721',
    aadharNumber: '912304891238',
    joiningDate: '2026-10-02',
    status: 'UNDER SURVEILLANCE',
    photo: null,
    notes: 'Financial phishing and identity forgery syndicate.'
  },
  {
    id: 'CR-8804',
    firstName: 'Suresh',
    lastName: 'Jadhav',
    aliases: 'Surya',
    gender: 'Male',
    age: '42',
    crimeCategory: 'Assault & Battery',
    severity: 'High',
    firNumber: 'FIR-2026/160',
    location: 'Bhigwan Chowk',
    zone: 'West Zone',
    idMarks: 'Tribal tattoo on neck',
    nationalId: 'XXXX-XXXX-3341',
    aadharNumber: '682390145892',
    joiningDate: '2026-10-05',
    status: 'ACTIVE WATCHLIST',
    photo: null,
    notes: 'Physical violence and extortion threats reported.'
  }
];

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

export const formatAadharDisplay = (rawAadhar) => {
  const clean = rawAadhar && typeof rawAadhar === 'string' ? rawAadhar.replace(/\D/g, '') : String(rawAadhar || '').replace(/\D/g, '');
  if (clean.length === 12) {
    return `${clean.slice(0, 4)} ${clean.slice(4, 8)} ${clean.slice(8, 12)}`;
  }
  return clean || 'N/A';
};

export default function CriminalDetection() {
  const { theme, themeUtils } = useTheme();
  const toast = useToast();
  const isDark = theme.mode === 'Dark';

  // Card theme tokens
  const cardBg = themeUtils.getBgColor('card');
  const borderColor = themeUtils.getBorderColor();
  const textPrimary = themeUtils.getTextColor(true);
  const textSecondary = themeUtils.getTextColor(false);
  const inputBg = themeUtils.getBgColor('input');
  const themeColor = theme.headerBg || '#3b82f6';

  // Form State
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    code: '',
    joiningDate: getTodayStr(),
    gender: 'Male',
    age: '',
    crimeCategory: 'Wanted Criminal',
    crimeCategoryId: null,
    severity: 'High',
    severityId: null,
    firNumber: '',
    location: 'Tiranga Circle',
    zone: 'North Zone',
    idMarks: '',
    nationalId: '',
    aadharNumber: '',
    aliases: ''
  });

  // Media Capture / Upload State
  const [mediaTab, setMediaTab] = useState('photo'); // 'photo' | 'video'
  const [capturedImage, setCapturedImage] = useState(null);
  const [uploadedPhotoFile, setUploadedPhotoFile] = useState(null);
  const [uploadedVideoFile, setUploadedVideoFile] = useState(null);
  const [uploadedVideoName, setUploadedVideoName] = useState('');
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dbCategories, setDbCategories] = useState([]);
  const [dbSeverities, setDbSeverities] = useState([]);

  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [autoGeneratedCode, setAutoGeneratedCode] = useState('');

  const formSectionRef = useRef(null);
  const videoRef = useRef(null);
  const uploadedVideoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);

  // Helper to format media URL from backend
  const getMediaUrl = (mediaPath) => {
    if (!mediaPath) return null;
    if (mediaPath.startsWith('http://') || mediaPath.startsWith('https://') || mediaPath.startsWith('data:') || mediaPath.startsWith('blob:')) {
      return mediaPath;
    }
    const clean = mediaPath.startsWith('/') ? mediaPath.slice(1) : mediaPath;
    return `${API_BASE_URL}/${clean}`;
  };

  // Records Table State - Real database records from backend API
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch real criminal records from backend
  const fetchRecords = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/criminal-registration`);
      const data = await res.json();
      if (data.success && Array.isArray(data.records)) {
        setRecords(data.records);
      }
    } catch (err) {
      console.error('Backend fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchNextCode = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/criminal-registration/next-code`);
      const data = await res.json();
      if (data.success && data.nextCode) {
        setAutoGeneratedCode(data.nextCode);
        return data.nextCode;
      }
    } catch (err) {
      console.warn('Next code fetch failed:', err.message);
    }
    return '';
  };

  const fetchMeta = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/criminal-registration/meta`);
      const data = await res.json();
      if (data.success) {
        if (Array.isArray(data.categories) && data.categories.length > 0) {
          setDbCategories(data.categories);
        }
        if (Array.isArray(data.severities) && data.severities.length > 0) {
          setDbSeverities(data.severities);
        }
        if (data.nextCode) {
          setAutoGeneratedCode(data.nextCode);
          setFormData(prev => ({
            ...prev,
            code: prev.code ? prev.code : data.nextCode,
          }));
        }
      }
    } catch (err) {
      console.warn('Meta fetch failed:', err.message);
    }
  };

  useEffect(() => {
    localStorage.removeItem('criminal_records_db');
    fetchMeta();
    fetchRecords();
  }, []);

  // Compute available categories and severities for dropdowns
  const availableCategories = useMemo(() => {
    if (dbCategories && dbCategories.length > 0) {
      return dbCategories.map(c => c.name);
    }
    return CRIME_CATEGORIES;
  }, [dbCategories]);

  const availableSeverities = useMemo(() => {
    if (dbSeverities && dbSeverities.length > 0) {
      return dbSeverities.map(s => s.name);
    }
    return SEVERITY_LEVELS.map(s => s.label);
  }, [dbSeverities]);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [severityFilter, setSeverityFilter] = useState('All');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // View Details Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);

  // Delete Confirmation Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Handle Live Camera Stream
  const startCamera = async () => {
    try {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraActive(true);
      setCaptureMode('webcam');
      toast.info('Camera Started', 'Live face capture stream is ready');
    } catch (err) {
      console.error('Camera access error:', err);
      toast.error('Camera Error', 'Could not access webcam. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Take Snapshot from Video
  const takeSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(dataUrl);
    stopCamera();
    toast.success('Snapshot Captured', 'Face photo extracted successfully');
  };

  // Handle Photo File Upload
  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setCapturedImage(event.target.result);
      toast.success('Photo Uploaded', `${file.name} loaded successfully`);
    };
    reader.readAsDataURL(file);
  };

  // Handle Video File Upload
  const handleVideoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedVideoFile(file);
    setUploadedVideoName(file.name);
    const videoUrl = URL.createObjectURL(file);
    setUploadedVideoUrl(videoUrl);

    // Create temporary object URL to extract initial frame
    const tempVideo = document.createElement('video');
    tempVideo.src = videoUrl;
    tempVideo.currentTime = 0.5;
    tempVideo.onloadeddata = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = tempVideo.videoWidth || 640;
        canvas.height = tempVideo.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
        const thumb = canvas.toDataURL('image/jpeg', 0.85);
        if (!capturedImage) {
          setCapturedImage(thumb);
        }
      } catch (err) {
        console.error('Frame extraction error', err);
      }
      toast.success('Video Loaded', `${file.name} uploaded successfully`);
    };
  };

  // Extract current video frame as photo
  const extractCurrentVideoFrame = () => {
    if (!uploadedVideoRef.current) return;
    const v = uploadedVideoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth || 640;
    canvas.height = v.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    const frameData = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(frameData);
    setUploadedPhotoFile(null); // Clear manual file since frame was extracted
    toast.success('Face Frame Captured', 'Extracted current video frame as criminal profile photo');
  };

  // Reset Capture
  const handleResetCapture = () => {
    stopCamera();
    setCapturedImage(null);
    setUploadedPhotoFile(null);
    setUploadedVideoFile(null);
    setUploadedVideoName('');
    setUploadedVideoUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  // Form input handler
  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Edit Record Handler
  const handleEditRecord = (record) => {
    setEditingId(record.criminal_id || record.id);
    setFormData({
      firstName: record.firstName || '',
      lastName: record.lastName || '',
      code: record.code || record.id || '',
      joiningDate: record.joiningDate || getTodayStr(),
      gender: record.gender || 'Male',
      age: record.age !== 'Unknown' ? (record.age || '') : '',
      crimeCategory: record.crimeCategory || (dbCategories[0]?.name || 'Wanted Criminal'),
      crimeCategoryId: record.crime_category_id || null,
      severity: record.severity || (dbSeverities[0]?.name || 'High'),
      severityId: record.severity_id || null,
      firNumber: record.firNumber !== 'N/A' ? (record.firNumber || '') : '',
      location: record.location !== 'N/A' ? (record.location || '') : 'Tiranga Circle',
      zone: record.zone || 'North Zone',
      idMarks: record.idMarks !== 'None reported' ? (record.idMarks || '') : '',
      nationalId: record.nationalId !== 'N/A' ? (record.nationalId || '') : '',
      aadharNumber: record.aadharNumber !== 'N/A' && record.aadharNumber ? record.aadharNumber : '',
      aliases: record.aliases !== 'N/A' ? (record.aliases || '') : ''
    });
    setCapturedImage(getMediaUrl(record.photo) || null);
    setUploadedPhotoFile(null);
    setUploadedVideoFile(null);
    if (record.video) {
      setUploadedVideoUrl(getMediaUrl(record.video));
      setUploadedVideoName('Saved surveillance video');
    } else {
      setUploadedVideoUrl(null);
      setUploadedVideoName('');
    }
    formSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast.info('Edit Mode', `Editing criminal record ${record.id}`);
  };

  const handleCancelEdit = async () => {
    setEditingId(null);
    let freshNextCode = await fetchNextCode();
    setFormData({
      firstName: '',
      lastName: '',
      code: freshNextCode || autoGeneratedCode || '',
      joiningDate: getTodayStr(),
      gender: 'Male',
      age: '',
      crimeCategory: dbCategories[0]?.name || 'Wanted Criminal',
      crimeCategoryId: dbCategories[0]?.id || null,
      severity: dbSeverities[0]?.name || 'High',
      severityId: dbSeverities[0]?.id || null,
      firNumber: '',
      location: 'Tiranga Circle',
      zone: 'North Zone',
      idMarks: '',
      nationalId: '',
      aadharNumber: '',
      aliases: ''
    });
    handleResetCapture();
  };

  // Handle Add New Crime Category via Popup Modal
  const handleCreateCategory = async (e) => {
    e.preventDefault();
    const cleanName = newCategoryName.trim();
    if (!cleanName) {
      toast.warning('Category Required', 'Please enter a category name');
      return;
    }

    if (/\d/.test(cleanName)) {
      toast.warning('Invalid Category', 'Category name cannot contain numbers. Only letters and text are allowed.');
      return;
    }

    setIsAddingCategory(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/criminal-registration/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cleanName }),
      });
      const data = await res.json();
      if (data.success && data.category) {
        toast.success('Category Added', `Crime Category "${data.category.name}" created successfully.`);
        // Refresh categories from database
        await fetchMeta();
        // Select newly added category in the form
        setFormData(prev => ({
          ...prev,
          crimeCategory: data.category.name,
          crimeCategoryId: data.category.id,
        }));
        setIsAddCategoryModalOpen(false);
        setNewCategoryName('');
      } else {
        toast.error('Failed to Add', data.message || 'Could not create category');
      }
    } catch (err) {
      console.error('Error adding category:', err);
      toast.error('Network Error', err.message || 'Could not connect to backend');
    } finally {
      setIsAddingCategory(false);
    }
  };

  // Register or Update Criminal Record
  const handleRegisterCriminal = async (e) => {
    e.preventDefault();

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      toast.warning('Missing Fields', 'Please enter First Name and Last Name.');
      return;
    }

    const nameRegex = /\d/;
    if (nameRegex.test(formData.firstName) || nameRegex.test(formData.lastName)) {
      toast.warning('Invalid Name', 'First Name and Last Name cannot contain numbers.');
      return;
    }

    const aadharValue = (formData.aadharNumber || '').replace(/\D/g, '');
    if (!aadharValue || aadharValue.trim() === '' || aadharValue === 'N/A') {
      toast.warning('Aadhar Required', 'Aadhar Card Number is compulsory. Please enter 12 digits.');
      return;
    }
    if (aadharValue.length !== 12) {
      toast.warning('Invalid Aadhar', 'Aadhar Card Number must be exactly 12 digits.');
      return;
    }

    const todayStr = getTodayStr();
    if (formData.joiningDate && formData.joiningDate > todayStr) {
      toast.warning('Invalid Date', 'Registration Date cannot be a future date.');
      return;
    }

    const finalCode = formData.code.trim() || autoGeneratedCode || `CR-001`;

    // Mandatory Photo check
    if (!capturedImage && !uploadedPhotoFile) {
      toast.warning('Photo Required', 'Criminal profile photo is mandatory. Please capture a live photo or upload an image.');
      setMediaTab('photo');
      return;
    }

    // Mandatory Video check
    if (!uploadedVideoFile && !uploadedVideoUrl) {
      toast.warning('Video Required', 'Surveillance video footage is mandatory. Please upload a video file.');
      setMediaTab('video');
      return;
    }

    setIsSubmitting(true);
    try {
      const postData = new FormData();
      postData.append('firstName', formData.firstName.trim());
      postData.append('lastName', formData.lastName.trim());
      postData.append('criminal_record_code', finalCode);
      postData.append('code', finalCode);
      postData.append('registration_date', formData.joiningDate || getTodayStr());
      postData.append('joiningDate', formData.joiningDate || getTodayStr());
      postData.append('gender', formData.gender);
      postData.append('age', formData.age || '');
      postData.append('crimeCategory', formData.crimeCategory);
      if (formData.crimeCategoryId) postData.append('crime_category_id', formData.crimeCategoryId);
      postData.append('severity', formData.severity);
      if (formData.severityId) postData.append('severity_id', formData.severityId);
      postData.append('fir_number', formData.firNumber.trim());
      postData.append('firNumber', formData.firNumber.trim());
      postData.append('known_area_location', formData.location.trim());
      postData.append('location', formData.location.trim());
      postData.append('aliases', formData.aliases.trim() || 'N/A');
      postData.append('identification_marks', formData.idMarks.trim() || 'None reported');
      postData.append('idMarks', formData.idMarks.trim() || 'None reported');
      postData.append('aadhaar_number', aadharValue);
      postData.append('aadharNumber', aadharValue);

      // Media attachments (saved as name-adharcard number on backend)
      if (uploadedPhotoFile) {
        postData.append('photo', uploadedPhotoFile);
      } else if (capturedImage) {
        postData.append('capturedImage', capturedImage);
      }

      if (uploadedVideoFile) {
        postData.append('video', uploadedVideoFile);
      }

      const url = editingId
        ? `${API_BASE_URL}/api/criminal-registration/${editingId}`
        : `${API_BASE_URL}/api/criminal-registration`;
      const method = editingId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        body: postData,
      });

      const resData = await response.json();

      if (resData.success) {
        toast.success(
          editingId ? 'Record Updated' : 'Criminal Registered Successfully',
          `${formData.firstName} ${formData.lastName} (${formData.code}) registered in database.`
        );
        fetchRecords();
        handleCancelEdit();
        stopCamera();

        // Automatically trigger Python AI Face Index Reload (POST /faces/reload)
        try {
          const reloadUrl = `${(API_CONFIG.CRIMINAL_DETECTION_API_URL || 'http://110.227.253.23:8090').replace(/\/+$/, '')}/faces/reload`;
          fetch(reloadUrl, { method: 'POST' })
            .then(r => r.json())
            .then(data => {
              if (data && data.status === 'success') {
                toast.info(
                  'Face AI Database Reloaded',
                  `Successfully indexed ${data.num_faces} faces in ${data.duration}`
                );
              }
            })
            .catch(e => console.warn('[CriminalRegistration] Auto-reload /faces/reload warning:', e));
        } catch (e) {
          // ignore
        }
      } else {
        toast.error('Registration Failed', resData.message || 'Error saving criminal record');
      }
    } catch (err) {
      console.error('Error submitting criminal record:', err);
      toast.error('Submission Error', err.message || 'Could not communicate with backend');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Record Prompt and Confirmation
  const handlePromptDelete = (record) => {
    setRecordToDelete(record);
    setDeleteModalOpen(true);
  };

  const handleCancelDelete = () => {
    if (isDeleting) return;
    setDeleteModalOpen(false);
    setRecordToDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (!recordToDelete) return;
    const targetId = recordToDelete.criminal_id || recordToDelete.id;
    setIsDeleting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/criminal-registration/${targetId}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (data.success) {
        toast.success(
          'Record Deleted',
          `Criminal record ${recordToDelete.code || recordToDelete.criminal_record_code || recordToDelete.id} removed successfully.`
        );
        setDeleteModalOpen(false);
        setRecordToDelete(null);
        fetchRecords();
      } else {
        toast.error('Delete Failed', data.message || 'Could not delete record');
      }
    } catch (err) {
      toast.error('Delete Error', err.message || 'Failed to delete record');
    } finally {
      setIsDeleting(false);
    }
  };

  // Open View Modal
  const handleOpenViewModal = (record) => {
    setSelectedRecord(record);
    setIsModalOpen(true);
  };

  // Filtered Dataset
  const filteredRecords = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return records.filter(r => {
      const matchesSearch = !q ||
        r.id.toLowerCase().includes(q) ||
        r.firstName.toLowerCase().includes(q) ||
        r.lastName.toLowerCase().includes(q) ||
        (r.aliases && r.aliases.toLowerCase().includes(q)) ||
        (r.firNumber && r.firNumber.toLowerCase().includes(q)) ||
        (r.location && r.location.toLowerCase().includes(q)) ||
        (r.crimeCategory && r.crimeCategory.toLowerCase().includes(q)) ||
        (r.aadharNumber && r.aadharNumber.toLowerCase().includes(q));

      const matchesCat = categoryFilter === 'All' || r.crimeCategory === categoryFilter;
      const matchesSev = severityFilter === 'All' || r.severity === severityFilter;

      let matchesDate = true;
      const recDate = toLocalDateStr(r.joiningDate);
      if (fromDate && recDate && recDate < fromDate) matchesDate = false;
      if (toDate && recDate && recDate > toDate) matchesDate = false;

      return matchesSearch && matchesCat && matchesSev && matchesDate;
    });
  }, [records, searchQuery, categoryFilter, severityFilter, fromDate, toDate]);

  // Table Data with consistent SR.NO
  const tableData = useMemo(() => {
    return filteredRecords.map((r, i) => ({
      ...r,
      srNo: i + 1,
    }));
  }, [filteredRecords]);

  // Standard PaginatedTable Columns
  const tableColumns = useMemo(() => [
    {
      header: "SR.NO",
      accessor: "srNo",
      render: (row) => <span className="font-bold text-xs text-blue-500 bg-blue-500/10 px-2 py-1 rounded w-max">{row.srNo}</span>
    },
    {
      header: "PHOTO",
      accessor: "photo",
      sortable: false,
      render: (row) => {
        const photoUrl = getMediaUrl(row.photo);
        return (
          <div className="w-10 h-10 mx-auto rounded-lg bg-black/20 border overflow-hidden flex items-center justify-center relative shrink-0" style={{ borderColor }}>
            {photoUrl ? (
              <img src={photoUrl} alt={row.firstName} className="w-full h-full object-cover" />
            ) : (
              <User size={16} className="opacity-40" />
            )}
          </div>
        );
      }
    },
    {
      header: "RECORD ID",
      accessor: "id",
      render: (row) => (
        <div className="font-mono font-semibold text-xs text-white">
          <div>{row.id}</div>
          {row.firNumber && (
            <div className="text-xs text-gray-300 font-normal font-sans">{row.firNumber}</div>
          )}
        </div>
      )
    },
    {
      header: "FULL NAME",
      accessor: "firstName",
      render: (row) => (
        <div className="text-xs">
          <div className="font-semibold text-white">{row.firstName} {row.lastName}</div>
          {row.aliases && row.aliases !== 'N/A' && (
            <div className="text-xs text-gray-300">Alias: {row.aliases}</div>
          )}
        </div>
      )
    },
    {
      header: "AADHAR NUMBER",
      accessor: "aadharNumber",
      render: (row, idx) => (
        <span className="font-mono text-xs font-semibold tracking-wider text-white whitespace-nowrap">
          {formatAadharDisplay(row.aadharNumber, row.srNo ? row.srNo - 1 : idx)}
        </span>
      )
    },
    {
      header: "CRIME CATEGORY",
      accessor: "crimeCategory",
      render: (row) => (
        <span className="text-xs font-medium text-white">
          {row.crimeCategory}
        </span>
      )
    },
    {
      header: "THREAT LEVEL",
      accessor: "severity",
      render: (row) => (
        <span className="text-xs font-semibold uppercase text-white">
          {row.severity}
        </span>
      )
    },
    {
      header: "LOCATION",
      accessor: "location",
      render: (row) => (
        <div className="flex items-center gap-1 text-xs text-white opacity-90">
          <MapPin className="w-3.5 h-3.5 text-gray-300 shrink-0" />
          <span>{row.location}</span>
        </div>
      )
    },
    {
      header: "REGISTRATION DATE",
      accessor: "joiningDate",
      render: (row) => (
        <div className="flex items-center gap-1 text-xs font-mono text-white">
          <Calendar className="w-3.5 h-3.5 text-gray-300 shrink-0" />
          <span>{row.joiningDate}</span>
        </div>
      )
    },
    {
      header: "ACTIONS",
      accessor: "actions",
      sortable: false,
      render: (row) => (
        <div className="flex items-center justify-center gap-1.5">
          <button
            type="button"
            onClick={() => handleOpenViewModal(row)}
            className="p-1.5 rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 transition-colors cursor-pointer"
            title="View Details"
          >
            <Eye size={14} />
          </button>
          <button
            type="button"
            onClick={() => handleEditRecord(row)}
            className="p-1.5 rounded-lg bg-yellow-500/15 text-yellow-400 hover:bg-yellow-500/30 border border-yellow-500/30 transition-colors cursor-pointer"
            title="Edit Record"
          >
            <Edit size={14} />
          </button>
          <button
            type="button"
            onClick={() => handlePromptDelete(row)}
            className="p-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/30 border border-red-500/30 transition-colors cursor-pointer"
            title="Delete Record"
          >
            <Trash2 size={14} />
          </button>
        </div>
      )
    }
  ], [borderColor]);

  // Metrics
  const stats = useMemo(() => {
    const total = records.length;
    const critical = records.filter(r => r.severity === 'Critical').length;
    const high = records.filter(r => r.severity === 'High').length;
    const today = getTodayStr();
    const registeredToday = records.filter(r => toLocalDateStr(r.joiningDate) === today).length;
    return { total, critical, high, registeredToday };
  }, [records]);

  return (
    <div className="flex flex-col gap-2 w-full h-full text-gray-900 dark:text-white font-sans">
      {/* Top Header */}
      <div
        className="p-2 rounded-2xl border shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0"
        style={{ backgroundColor: cardBg, borderColor }}
      >
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-600 flex items-center justify-center text-white shadow-md shadow-amber-500/20 shrink-0">
            <Fingerprint size={22} />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold tracking-wide flex items-center gap-2">
              Criminal Registration

            </h1>
            <p className="text-xs opacity-70" style={{ color: textSecondary }}>
              Register criminal profiles, suspect face photos and personal records.
            </p>
          </div>
        </div>

        {/* Quick Summary Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold bg-black/5 dark:bg-white/5" style={{ borderColor }}>
            <Users size={13} className="text-blue-500" />
            <span>Total Registered: <strong className="text-blue-500">{stats.total}</strong></span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold bg-emerald-500/10 border-emerald-500/30 text-emerald-500">
            <CheckCircle2 size={13} />
            <span>Registered Today: <strong>{stats.registeredToday}</strong></span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold bg-red-500/10 border-red-500/30 text-red-500">
            <ShieldAlert size={13} />
            <span>Critical Threat: <strong>{stats.critical}</strong></span>
          </div>
        </div>
      </div>

      {/* Main 2-Column Enrollment Form Section (Matches User Reference Image) */}
      <div ref={formSectionRef} className="grid grid-cols-1 lg:grid-cols-12 gap-4 shrink-0">

        {/* Left Column: Video / Live Photo Capture Card with 2 Tabs */}
        <div
          className="lg:col-span-5 rounded-2xl border shadow-md flex flex-col overflow-hidden relative"
          style={{ backgroundColor: cardBg, borderColor }}
        >
          {/* Card Header with 2 Tabs */}
          <div
            className="p-2 border-b flex items-center justify-between backdrop-blur-sm gap-2"
            style={{ borderColor, backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)' }}
          >
            {/* Tabs */}
            <div
              className="flex items-center gap-1.5 p-1 rounded-xl border"
              style={{ borderColor, backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.04)' }}
            >
              <button
                type="button"
                onClick={() => {
                  setMediaTab('photo');
                  if (isCameraActive) stopCamera();
                }}
                style={mediaTab === 'photo' ? { backgroundColor: themeColor, color: '#ffffff' } : { color: textSecondary }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${mediaTab === 'photo'
                  ? 'shadow-md shadow-blue-500/25'
                  : 'hover:opacity-80'
                  }`}
              >
                <Camera size={14} />
                <span>Photo</span>
                <span className="text-red-400 font-extrabold">*</span>
                {capturedImage && <span className="text-[10px] text-emerald-400 font-mono">✓</span>}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMediaTab('video');
                  if (isCameraActive) stopCamera();
                }}
                style={mediaTab === 'video' ? { backgroundColor: themeColor, color: '#ffffff' } : { color: textSecondary }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${mediaTab === 'video'
                  ? 'shadow-md shadow-blue-500/25'
                  : 'hover:opacity-80'
                  }`}
              >
                <Video size={14} />
                <span>Video</span>
                <span className="text-red-400 font-extrabold">*</span>
                {uploadedVideoUrl && <span className="text-[10px] text-emerald-400 font-mono">✓</span>}
              </button>
            </div>

            {/* Status Badge */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold tracking-wider shrink-0"
              style={{ borderColor, backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.04)', color: textPrimary }}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${mediaTab === 'photo'
                ? (isCameraActive ? 'bg-green-500 animate-pulse' : capturedImage ? 'bg-emerald-400' : 'bg-red-400 animate-pulse')
                : (uploadedVideoUrl ? 'bg-emerald-400' : 'bg-red-400 animate-pulse')
                }`} />
              <span>
                {mediaTab === 'photo'
                  ? (isCameraActive ? '● LIVE WEBCAM' : capturedImage ? '✓ PHOTO READY' : '• PHOTO REQUIRED *')
                  : (uploadedVideoUrl ? '✓ VIDEO READY' : '• VIDEO REQUIRED *')
                }
              </span>
            </div>
          </div>

          {/* Capture Box with Futuristic Grid & Cyberpunk Borders */}
          <div className="p-2 flex-1 flex flex-col justify-between">
            <div
              className="relative w-full aspect-[4/3] rounded-xl overflow-hidden border flex flex-col items-center justify-center p-2 shadow-inner group transition-colors"
              style={{ borderColor, backgroundColor: isDark ? '#070d18' : '#f8fafc' }}
            >

              {/* Corner accents */}
              <div className="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 pointer-events-none" style={{ borderColor: themeColor }} />
              <div className="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 pointer-events-none" style={{ borderColor: themeColor }} />
              <div className="absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 pointer-events-none" style={{ borderColor: themeColor }} />
              <div className="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 pointer-events-none" style={{ borderColor: themeColor }} />

              {/* Background Grid Pattern */}
              <div
                className="absolute inset-0 opacity-15 pointer-events-none"
                style={{
                  backgroundImage: `radial-gradient(${themeColor} 1px, transparent 1px)`,
                  backgroundSize: '16px 16px'
                }}
              />

              {/* TAB 1: PHOTO CONTENT */}
              {mediaTab === 'photo' && (
                <>
                  {capturedImage ? (
                    <div className="relative w-full h-full flex items-center justify-center rounded-lg overflow-hidden">
                      <img
                        src={capturedImage}
                        alt="Captured Criminal Face"
                        className="w-full h-full object-contain rounded-lg"
                      />


                      <button
                        onClick={handleResetCapture}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-600/80 hover:bg-red-600 text-white text-xs transition-all shadow-md cursor-pointer"
                        title="Remove Photo"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : isCameraActive ? (
                    <div className="relative w-full h-full flex items-center justify-center">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover rounded-lg"
                      />
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-44 h-44 border border-dashed border-blue-400/70 rounded-full animate-pulse flex items-center justify-center">
                          <div className="w-36 h-36 border border-blue-500/40 rounded-full" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-3 text-center p-4 z-10">
                      <div
                        className="w-14 h-14 rounded-full border flex items-center justify-center shadow-lg"
                        style={{
                          borderColor,
                          backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.08)',
                          color: themeColor
                        }}
                      >
                        <Camera size={28} className="animate-pulse" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold mb-0.5" style={{ color: textPrimary }}>
                          Live Photo / Camera Snapshot
                        </h3>
                        <p className="text-xs max-w-xs" style={{ color: textSecondary }}>
                          Capture live face photo via camera or browse an image file from device.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* TAB 2: VIDEO CONTENT */}
              {mediaTab === 'video' && (
                <>
                  {uploadedVideoUrl ? (
                    <div className="relative w-full h-full flex flex-col items-center justify-center rounded-lg overflow-hidden bg-black">
                      <video
                        ref={uploadedVideoRef}
                        src={uploadedVideoUrl}
                        controls
                        className="w-full h-full object-contain rounded-lg"
                      />
                      <button
                        onClick={() => {
                          setUploadedVideoUrl(null);
                          setUploadedVideoName('');
                        }}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-red-600/80 hover:bg-red-600 text-white text-xs transition-all shadow-md cursor-pointer"
                        title="Remove Video"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-3 text-center p-4 z-10">
                      <div
                        className="w-14 h-14 rounded-full border flex items-center justify-center shadow-lg"
                        style={{
                          borderColor,
                          backgroundColor: isDark ? 'rgba(99, 102, 241, 0.1)' : 'rgba(99, 102, 241, 0.08)',
                          color: themeColor
                        }}
                      >
                        <Video size={28} className="animate-pulse" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold mb-0.5" style={{ color: textPrimary }}>
                          Upload CCTV / Surveillance Video
                        </h3>
                        <p className="text-xs max-w-xs" style={{ color: textSecondary }}>
                          Upload video clip (MP4, WebM, AVI) to extract facial frames and attach footage to registry.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Hidden Inputs */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
            />
            <input
              type="file"
              ref={videoInputRef}
              accept="video/*"
              className="hidden"
              onChange={handleVideoUpload}
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Bottom Actions Toolbar */}
            <div className="mt-4 flex flex-col sm:flex-row items-center gap-2.5">
              {/* TAB 1 ACTIONS */}
              {mediaTab === 'photo' && (
                <>
                  {!isCameraActive && !capturedImage && (
                    <>
                      {/* <button
                        type="button"
                        onClick={startCamera}
                        style={{ backgroundColor: themeColor, color: '#ffffff' }}
                        className="flex-1 w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer hover:opacity-90"
                      >
                        <Camera size={15} />
                        <span>Open Live Camera</span>
                      </button> */}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        style={{ borderColor, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', color: textPrimary }}
                        className="flex-1 w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer hover:opacity-80"
                      >
                        <Upload size={15} />
                        <span>Browse Photo</span>
                      </button>
                    </>
                  )}

                  {isCameraActive && (
                    <>
                      <button
                        type="button"
                        onClick={takeSnapshot}
                        className="flex-1 w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-extrabold text-black bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
                      >
                        <Sparkles size={16} />
                        <span>CAPTURE FACE PHOTO</span>
                      </button>
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="py-2.5 px-4 rounded-xl text-xs font-bold text-gray-300 bg-gray-800 hover:bg-gray-700 transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                    </>
                  )}

                  {capturedImage && (
                    <div className="w-full flex items-center justify-between text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 p-2.5 rounded-xl">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={16} />
                        <span className="font-semibold">Photo Attached & Verified</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleResetCapture}
                        className="text-xs font-bold text-red-400 hover:underline cursor-pointer"
                      >
                        Retake / Change
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* TAB 2 ACTIONS */}
              {mediaTab === 'video' && (
                <>
                  {uploadedVideoUrl ? (
                    <div className="w-full flex flex-col sm:flex-row items-center gap-2">
                      <button
                        type="button"
                        onClick={extractCurrentVideoFrame}
                        className="flex-1 w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold text-black bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 shadow-md shadow-amber-500/20 transition-all cursor-pointer"
                      >
                        <Sparkles size={15} />
                        <span>Extract Frame as Photo</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => videoInputRef.current?.click()}
                        style={{ borderColor, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', color: textPrimary }}
                        className="w-full sm:w-auto flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer hover:opacity-80"
                      >
                        <Upload size={14} />
                        <span>Change Video</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => videoInputRef.current?.click()}
                      style={{ backgroundColor: themeColor, color: '#ffffff' }}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer hover:opacity-90"
                    >
                      <Video size={16} />
                      <span>Upload Video File * (MP4, AVI, WebM)</span>
                    </button>
                  )}
                </>
              )}

              {/* Media Checklist Status Footer */}
              <div
                className="mt-2 p-2 rounded-xl border flex items-center justify-between text-[11px] font-semibold"
                style={{ borderColor, backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.02)' }}
              >
                <div className="flex items-center gap-1.5">
                  <span className={capturedImage ? "text-emerald-400" : "text-amber-400 font-bold"}>
                    {capturedImage ? "✓ Photo Attached" : "⚠ Photo Required *"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={uploadedVideoUrl ? "text-emerald-400" : "text-amber-400 font-bold"}>
                    {uploadedVideoUrl ? "✓ Video Attached" : "⚠ Video Required *"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Criminal Details Form (Matches User Reference Image) */}
        <div
          className="lg:col-span-7 rounded-2xl border shadow-md flex flex-col overflow-hidden"
          style={{ backgroundColor: cardBg, borderColor }}
        >
          {/* Card Header */}
          <div
            className="p-2.5 border-b flex items-center justify-between backdrop-blur-sm"
            style={{ borderColor, backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)' }}
          >
            <div className="flex items-center gap-2" style={{ color: textPrimary }}>
              <User size={16} style={{ color: themeColor }} />
              <span className="text-xs font-bold tracking-wider uppercase">
                {editingId ? 'Edit Criminal Details' : 'Criminal Details'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {editingId && (
                <span className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-500 dark:text-amber-400 text-[10px] font-bold">
                  EDITING MODE
                </span>
              )}
              <span className="text-[10px] font-mono" style={{ color: textSecondary }}>
                RECORD ID: <strong style={{ color: themeColor }}>{formData.code || (editingId ? editingId : 'Auto / Custom')}</strong>
              </span>
            </div>
          </div>

          {/* Edit Mode Notice Banner */}
          {editingId && (
            <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-amber-500 dark:text-amber-400">
                <Edit size={13} />
                <span>You are editing record <strong className="font-mono">{editingId}</strong>. Modify details and save.</span>
              </div>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="text-[11px] font-bold text-gray-400 hover:text-white flex items-center gap-1 cursor-pointer bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded"
              >
                <X size={12} />
                Cancel Edit
              </button>
            </div>
          )}

          {/* Form Fields Grid */}
          <form onSubmit={handleRegisterCriminal} className="p-3 flex-1 flex flex-col justify-between gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">

              {/* First Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold flex items-center gap-1" style={{ color: textPrimary }}>
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter first name"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value.replace(/[0-9]/g, ''))}
                  style={{ borderColor, backgroundColor: inputBg, color: textPrimary }}
                  className="w-full px-3 py-2 rounded-xl border text-xs outline-none focus:ring-1 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500"
                />
              </div>

              {/* Last Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold flex items-center gap-1" style={{ color: textPrimary }}>
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter last name"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value.replace(/[0-9]/g, ''))}
                  style={{ borderColor, backgroundColor: inputBg, color: textPrimary }}
                  className="w-full px-3 py-2 rounded-xl border text-xs outline-none focus:ring-1 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500"
                />
              </div>

              {/* Criminal Code */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold flex items-center gap-1" style={{ color: textPrimary }}>
                    Criminal Record Code
                  </label>
                  <span className="text-[10px] text-blue-400 font-mono font-semibold">
                    Auto-generated: {autoGeneratedCode || 'CR-001'}
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder={`e.g. ${autoGeneratedCode || 'CR-001'}`}
                    value={formData.code}
                    onChange={(e) => handleInputChange('code', e.target.value)}
                    style={{ borderColor, backgroundColor: inputBg, color: textPrimary }}
                    className="w-full px-3 py-2 rounded-xl border font-mono text-xs outline-none focus:ring-1 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500"
                  />
                  {!editingId && autoGeneratedCode && formData.code !== autoGeneratedCode && (
                    <button
                      type="button"
                      onClick={() => handleInputChange('code', autoGeneratedCode)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-blue-400 hover:text-blue-300 font-bold cursor-pointer bg-blue-500/10 hover:bg-blue-500/20 px-2 py-0.5 rounded"
                      title="Reset to next sequential code"
                    >
                      Reset to {autoGeneratedCode}
                    </button>
                  )}
                </div>
              </div>

              {/* Enrollment / Registration Date */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold flex items-center gap-1" style={{ color: textPrimary }}>
                  Registration Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  max={getTodayStr()}
                  value={formData.joiningDate}
                  onChange={(e) => {
                    const selected = e.target.value;
                    const today = getTodayStr();
                    if (selected && selected > today) {
                      toast.warning('Invalid Date', 'Registration Date cannot be a future date.');
                      handleInputChange('joiningDate', today);
                      return;
                    }
                    handleInputChange('joiningDate', selected);
                  }}
                  style={{ borderColor, backgroundColor: inputBg, color: textPrimary }}
                  className={`w-full px-3 py-2 rounded-xl border text-xs outline-none focus:ring-1 transition-all ${isDark ? '[color-scheme:dark]' : '[color-scheme:light]'}`}
                />
              </div>

              {/* Crime Category */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold flex items-center gap-1" style={{ color: textPrimary }}>
                    Crime Category <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setNewCategoryName('');
                      setIsAddCategoryModalOpen(true);
                    }}
                    className="text-[11px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer transition-colors"
                    title="Add a new crime category"
                  >
                    <Plus size={12} />
                    <span>Add New Category</span>
                  </button>
                </div>
                <select
                  value={formData.crimeCategory}
                  onChange={(e) => {
                    const selectedName = e.target.value;
                    if (selectedName === '__ADD_NEW__') {
                      setNewCategoryName('');
                      setIsAddCategoryModalOpen(true);
                      return;
                    }
                    const catObj = dbCategories.find(c => c.name === selectedName);
                    setFormData(prev => ({
                      ...prev,
                      crimeCategory: selectedName,
                      crimeCategoryId: catObj ? catObj.id : null,
                    }));
                  }}
                  style={{ borderColor, backgroundColor: inputBg, color: textPrimary }}
                  className="w-full px-3 py-2 rounded-xl border text-xs outline-none focus:ring-1 transition-all cursor-pointer"
                >
                  {availableCategories.map(cat => (
                    <option key={cat} value={cat} style={{ backgroundColor: cardBg, color: textPrimary }}>{cat}</option>
                  ))}
                  <option value="__ADD_NEW__" style={{ backgroundColor: cardBg, color: '#38bdf8', fontWeight: 'bold' }}>
                    + Add New Category...
                  </option>
                </select>
              </div>

              {/* Threat / Severity Level */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold flex items-center gap-1" style={{ color: textPrimary }}>
                  Threat / Severity Level <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.severity}
                  onChange={(e) => {
                    const selectedName = e.target.value;
                    const sevObj = dbSeverities.find(s => s.name === selectedName);
                    setFormData(prev => ({
                      ...prev,
                      severity: selectedName,
                      severityId: sevObj ? sevObj.id : null,
                    }));
                  }}
                  style={{ borderColor, backgroundColor: inputBg, color: textPrimary }}
                  className="w-full px-3 py-2 rounded-xl border text-xs outline-none focus:ring-1 transition-all cursor-pointer"
                >
                  {availableSeverities.map(sev => (
                    <option key={sev} value={sev} style={{ backgroundColor: cardBg, color: textPrimary }}>
                      {sev} Threat Level
                    </option>
                  ))}
                </select>
              </div>

              {/* FIR Number */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold flex items-center gap-1" style={{ color: textPrimary }}>
                  FIR Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. FIR-2026/089"
                  value={formData.firNumber}
                  onChange={(e) => handleInputChange('firNumber', e.target.value)}
                  style={{ borderColor, backgroundColor: inputBg, color: textPrimary }}
                  className="w-full px-3 py-2 rounded-xl border text-xs outline-none focus:ring-1 transition-all font-mono placeholder:text-gray-400 dark:placeholder:text-gray-500"
                />
              </div>

              {/* Known Location / Last Seen Area */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold flex items-center gap-1" style={{ color: textPrimary }}>
                  Known Area / Location
                </label>
                <input
                  type="text"
                  placeholder="e.g. Tiranga Circle, Baramati MIDC"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  style={{ borderColor, backgroundColor: inputBg, color: textPrimary }}
                  className="w-full px-3 py-2 rounded-xl border text-xs outline-none focus:ring-1 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500"
                />
              </div>

              {/* Aliases / Nicknames */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold flex items-center gap-1" style={{ color: textPrimary }}>
                  Aliases / Known Nicknames
                </label>
                <input
                  type="text"
                  placeholder="e.g. Vicky, Pappu, Surya"
                  value={formData.aliases}
                  onChange={(e) => handleInputChange('aliases', e.target.value)}
                  style={{ borderColor, backgroundColor: inputBg, color: textPrimary }}
                  className="w-full px-3 py-2 rounded-xl border text-xs outline-none focus:ring-1 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500"
                />
              </div>

              {/* Identification Marks */}
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-xs font-bold flex items-center gap-1" style={{ color: textPrimary }}>
                  Identification Marks / Scars / Tattoos
                </label>
                <input
                  type="text"
                  placeholder="e.g. Scar on left eyebrow, tattoo on right wrist"
                  value={formData.idMarks}
                  onChange={(e) => handleInputChange('idMarks', e.target.value)}
                  style={{ borderColor, backgroundColor: inputBg, color: textPrimary }}
                  className="w-full px-3 py-2 rounded-xl border text-xs outline-none focus:ring-1 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500"
                />
              </div>

              {/* Aadhar Card Number (Compulsory) */}
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold flex items-center gap-1" style={{ color: textPrimary }}>
                    Aadhar Card Number <span className="text-red-400 font-extrabold">*</span>
                  </label>
                  <span className="text-[10px] font-mono" style={{ color: themeColor }}>
                    {formData.aadharNumber ? `${formData.aadharNumber.length}/12 digits` : '12 digits required'}
                  </span>
                </div>
                <input
                  type="text"
                  required
                  maxLength="12"
                  placeholder="Enter 12-digit Aadhar number (e.g. 123456789012)"
                  value={formData.aadharNumber}
                  onChange={(e) => handleInputChange('aadharNumber', e.target.value.replace(/\D/g, '').slice(0, 12))}
                  style={{ borderColor, backgroundColor: inputBg, color: textPrimary }}
                  className="w-full px-3 py-2 rounded-xl border text-xs outline-none focus:ring-1 transition-all font-mono tracking-widest placeholder:text-gray-400 dark:placeholder:text-gray-500"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2 flex flex-wrap items-center justify-end gap-2.5">
              {editingId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  style={{ borderColor, color: textSecondary }}
                  className="py-3 px-5 rounded-xl border text-xs font-bold transition-all cursor-pointer uppercase tracking-wider hover:opacity-80"
                >
                  CANCEL
                </button>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full sm:w-auto min-w-[200px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-extrabold text-sm text-white shadow-lg transition-all transform active:scale-98 cursor-pointer uppercase tracking-wider ${isSubmitting ? 'opacity-70 cursor-not-allowed' : 'hover:opacity-90'}`}
                style={{
                  backgroundColor: themeColor,
                  boxShadow: `0 8px 20px -4px ${theme.headerBg ? theme.headerBg + '40' : 'rgba(37,99,235,0.3)'}`
                }}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    <span>SAVING...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={18} />
                    <span>{editingId ? 'UPDATE CRIMINAL RECORD' : 'REGISTER CRIMINAL RECORD'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

      </div>

      {/* Watchlist Database / Registered Criminals Table */}
      <div className="w-full">
        <PaginatedTable
          title="REGISTERED CRIMINALS"
          columns={tableColumns}
          data={tableData}
          itemsPerPage={10}
          headerContent={
            <div className="flex items-center gap-2 flex-wrap">
              <div className="w-48 sm:w-56">
                <SearchBar
                  searchValue={searchQuery}
                  onSearchChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, ID, Aadhar..."
                />
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-2.5 py-1 h-8 text-xs font-medium rounded-lg border outline-none cursor-pointer max-w-[150px] truncate"
                style={{ borderColor, backgroundColor: themeUtils.getBgColor('input'), color: textPrimary }}
                title="Filter by crime category"
              >
                <option value="All">All Categories</option>
                {availableCategories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="px-2.5 py-1 h-8 text-xs font-medium rounded-lg border outline-none cursor-pointer max-w-[130px] truncate"
                style={{ borderColor, backgroundColor: themeUtils.getBgColor('input'), color: textPrimary }}
                title="Filter by threat level"
              >
                <option value="All">All Threats</option>
                {availableSeverities.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <DateRangePicker
                fromDate={fromDate}
                toDate={toDate}
                onFromChange={setFromDate}
                onToChange={setToDate}
              />
              <button
                type="button"
                onClick={fetchRecords}
                disabled={isLoading}
                className="px-2.5 py-1 h-8 rounded-lg border flex items-center gap-1.5 text-xs font-semibold hover:opacity-80 transition-all cursor-pointer shrink-0"
                style={{ borderColor, backgroundColor: themeUtils.getBgColor('input'), color: textPrimary }}
                title="Refresh from Database"
              >
                <RefreshCw size={13} className={isLoading ? "animate-spin text-blue-400" : ""} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
            </div>
          }
        />
      </div>

      {/* Modal: Add New Crime Category Popup */}
      {isAddCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div
            className="w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden flex flex-col"
            style={{ backgroundColor: cardBg, borderColor }}
          >
            {/* Modal Header */}
            <div
              className="px-5 py-4 border-b flex items-center justify-between"
              style={{ borderColor, backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.02)' }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)', color: '#38bdf8' }}
                >
                  <Plus size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold" style={{ color: textPrimary }}>Add New Crime Category</h3>
                  <p className="text-[11px]" style={{ color: textSecondary }}>Save a new category to the criminal database</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddCategoryModalOpen(false);
                  setNewCategoryName('');
                }}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleCreateCategory} className="p-5 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold flex items-center gap-1" style={{ color: textPrimary }}>
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  autoFocus
                  required
                  placeholder="e.g. Cyber Extortion, Smuggling, Gang Violence..."
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value.replace(/[0-9]/g, ''))}
                  style={{ borderColor, backgroundColor: inputBg, color: textPrimary }}
                  className="w-full px-3.5 py-2.5 rounded-xl border text-xs outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500"
                />
                <span className="text-[10px] opacity-60" style={{ color: textSecondary }}>
                  Only letters and text allowed (numbers 0-9 are disallowed)
                </span>
              </div>

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddCategoryModalOpen(false);
                    setNewCategoryName('');
                  }}
                  disabled={isAddingCategory}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer hover:opacity-80"
                  style={{ borderColor, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', color: textPrimary }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingCategory || !newCategoryName.trim()}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  {isAddingCategory ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Plus size={14} />
                      <span>Save Category</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Right Side Drawer / Modal: View Full Details */}
      <RightSideDialog
        visible={isModalOpen}
        onHide={() => setIsModalOpen(false)}
        header="Criminal Record"
      >
        {selectedRecord && (
          <div className="flex flex-col gap-5 pt-2">
            {/* Snapshot Photo Card */}
            <div className="w-full rounded-xl overflow-hidden border bg-slate-900 flex items-center justify-center min-h-[200px]" style={{ borderColor }}>
              {selectedRecord.photo ? (
                <img src={getMediaUrl(selectedRecord.photo)} alt={selectedRecord.firstName} className="w-full max-h-72 object-contain" />
              ) : (
                <div className="flex flex-col items-center gap-2 p-6 text-gray-400">
                  <User size={36} />
                  <span className="text-xs">No facial photo available</span>
                </div>
              )}
            </div>

            {/* Video Footage Card */}
            {(() => {
              const regVideoUrl = getMediaUrl(selectedRecord.video || selectedRecord.video_path);
              if (!regVideoUrl) return null;
              return (
                <div className="p-3.5 rounded-xl border" style={{ borderColor, backgroundColor: cardBg }}>
                  <p className="text-[10px] font-bold uppercase opacity-70 mb-2 flex items-center justify-between" style={{ color: textSecondary }}>
                    <span className="flex items-center gap-1.5">
                      <Video size={13} className="text-blue-400" /> Surveillance Video Footage
                    </span>
                    <span className="text-[9px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-bold border border-blue-500/30">
                      REGISTERED EVIDENCE
                    </span>
                  </p>
                  <div className="w-full rounded-lg overflow-hidden bg-black aspect-video max-h-64 border" style={{ borderColor }}>
                    <video
                      key={regVideoUrl}
                      controls
                      playsInline
                      preload="auto"
                      className="w-full h-full object-contain"
                    >
                      <source src={regVideoUrl} type="video/mp4" />
                      Your browser does not support HTML5 video playback.
                    </video>
                  </div>
                </div>
              );
            })()}

            {/* 2-Column Detail Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl border" style={{ borderColor, backgroundColor: cardBg }}>
                <p className="text-[10px] font-bold uppercase opacity-60 mb-1" style={{ color: textSecondary }}>Criminal Record ID</p>
                <p className="font-mono font-bold text-sm text-amber-500">{selectedRecord.id}</p>
              </div>

              <div className="p-3 rounded-xl border" style={{ borderColor, backgroundColor: cardBg }}>
                <p className="text-[10px] font-bold uppercase opacity-60 mb-1" style={{ color: textSecondary }}>Threat Level</p>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md inline-block ${selectedRecord.severity === 'Critical' ? 'bg-red-500/20 text-red-500' :
                  selectedRecord.severity === 'High' ? 'bg-orange-500/20 text-orange-500' : 'bg-yellow-500/20 text-yellow-600'
                  }`}>
                  {selectedRecord.severity}
                </span>
              </div>

              <div className="p-3 rounded-xl border" style={{ borderColor, backgroundColor: cardBg }}>
                <p className="text-[10px] font-bold uppercase opacity-60 mb-1" style={{ color: textSecondary }}>Full Name</p>
                <p className="font-bold text-xs" style={{ color: textPrimary }}>{selectedRecord.firstName} {selectedRecord.lastName}</p>
              </div>

              <div className="p-3 rounded-xl border" style={{ borderColor, backgroundColor: cardBg }}>
                <p className="text-[10px] font-bold uppercase opacity-60 mb-1" style={{ color: textSecondary }}>Aliases</p>
                <p className="font-semibold text-xs" style={{ color: textPrimary }}>{selectedRecord.aliases || 'None'}</p>
              </div>

              <div className="p-3 rounded-xl border" style={{ borderColor, backgroundColor: cardBg }}>
                <p className="text-[10px] font-bold uppercase opacity-60 mb-1" style={{ color: textSecondary }}>Crime Category</p>
                <p className="font-bold text-xs text-blue-500">{selectedRecord.crimeCategory}</p>
              </div>

              <div className="p-3 rounded-xl border" style={{ borderColor, backgroundColor: cardBg }}>
                <p className="text-[10px] font-bold uppercase opacity-60 mb-1" style={{ color: textSecondary }}>FIR / Case No</p>
                <p className="font-mono text-xs font-semibold" style={{ color: textPrimary }}>{selectedRecord.firNumber}</p>
              </div>

              <div className="p-3 rounded-xl border" style={{ borderColor, backgroundColor: cardBg }}>
                <p className="text-[10px] font-bold uppercase opacity-60 mb-1" style={{ color: textSecondary }}>Location / Zone</p>
                <p className="font-semibold text-xs" style={{ color: textPrimary }}>{selectedRecord.location} ({selectedRecord.zone})</p>
              </div>

              <div className="p-3 rounded-xl border" style={{ borderColor, backgroundColor: cardBg }}>
                <p className="text-[10px] font-bold uppercase opacity-60 mb-1" style={{ color: textSecondary }}>Enrolled Date</p>
                <p className="font-mono text-xs font-semibold" style={{ color: textPrimary }}>{selectedRecord.joiningDate}</p>
              </div>

              <div className="p-3 rounded-xl border col-span-2" style={{ borderColor, backgroundColor: cardBg }}>
                <p className="text-[10px] font-bold uppercase opacity-60 mb-1" style={{ color: textSecondary }}>Aadhar Card Number</p>
                <p className="font-mono font-bold text-xs text-amber-500 tracking-wider">
                  {formatAadharDisplay(selectedRecord.aadharNumber, 0)}
                </p>
              </div>

              <div className="p-3 rounded-xl border col-span-2" style={{ borderColor, backgroundColor: cardBg }}>
                <p className="text-[10px] font-bold uppercase opacity-60 mb-1" style={{ color: textSecondary }}>Identification Marks</p>
                <p className="font-semibold text-xs" style={{ color: textPrimary }}>{selectedRecord.idMarks}</p>
              </div>
            </div>
          </div>
        )}
      </RightSideDialog>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && recordToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-200"
          onClick={handleCancelDelete}
        >
          <div
            className="w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden transform transition-all duration-200 scale-100"
            style={{
              borderColor,
              backgroundColor: cardBg,
              color: textPrimary
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Red Accent Top Banner */}
            <div className="h-1.5 w-full bg-gradient-to-r from-red-600 via-rose-500 to-red-600" />

            <div className="p-6">
              {/* Header with Icon and Close Button */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-500 shrink-0 shadow-[0_0_15px_rgba(239,68,68,0.25)]">
                    <Trash2 className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">
                      Confirm Criminal Deletion
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Remove criminal profile from the active watchlist
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCancelDelete}
                  disabled={isDeleting}
                  className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Record Summary Card */}
              <div
                className="p-3.5 rounded-xl border bg-black/5 dark:bg-white/5 mb-4 flex items-center gap-3.5"
                style={{ borderColor }}
              >
                <div className="w-14 h-14 rounded-lg bg-black/30 border overflow-hidden flex items-center justify-center shrink-0" style={{ borderColor }}>
                  {recordToDelete.photo ? (
                    <img
                      src={getMediaUrl(recordToDelete.photo)}
                      alt={recordToDelete.firstName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-7 h-7 text-gray-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                      {recordToDelete.code || recordToDelete.criminal_record_code || recordToDelete.id}
                    </span>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${recordToDelete.severity === 'Critical' ? 'bg-red-500/20 text-red-500 border border-red-500/40' :
                        recordToDelete.severity === 'High' ? 'bg-orange-500/20 text-orange-500 border border-orange-500/40' :
                          'bg-yellow-500/20 text-yellow-500 border border-yellow-500/40'
                      }`}>
                      {recordToDelete.severity || 'Threat'}
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-gray-900 dark:text-white truncate">
                    {recordToDelete.firstName} {recordToDelete.lastName}
                  </h4>
                  <p className="text-xs text-blue-400 truncate">
                    {recordToDelete.crimeCategory || 'Registered Offense'}
                  </p>
                  {recordToDelete.aadharNumber && (
                    <p className="text-[11px] font-mono text-gray-400 mt-0.5">
                      Aadhaar: {formatAadharDisplay(recordToDelete.aadharNumber, 0)}
                    </p>
                  )}
                </div>
              </div>

              {/* Warning Alert Banner */}
              <div className="p-3 rounded-xl border bg-red-500/10 border-red-500/30 text-red-400 text-xs flex items-start gap-2.5 mb-6">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">
                  Are you sure you want to delete this criminal record? Biometric face recognition alerts and facial embeddings for this person will be deactivated immediately.
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={handleCancelDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 rounded-xl border font-semibold text-xs transition-colors hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer disabled:opacity-50"
                  style={{ borderColor, color: textPrimary }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-lg shadow-red-600/30 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isDeleting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={14} />
                      <span>Delete Record</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
