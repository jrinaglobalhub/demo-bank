"use client";

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Search, 
  CheckCircle, 
  Clock, 
  FileText, 
  UploadCloud, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft,
  UserCheck,
  ShieldAlert,
  Loader2,
  Eye,
  X,
  Camera,
  Image,
  Mail,
  Phone,
  Lock,
  Pencil,
  Trash2,
  ShieldCheck,
  Smartphone,
  Fingerprint,
  CreditCard
} from 'lucide-react';
import { db } from '@/lib/db';
import { createBrowserSupabaseClient } from '@/lib/supabase';
import emailjs from '@emailjs/browser';
import { Customer, Profile, GoldLoan } from '@/lib/mockData';
import { formatRupee } from '@/lib/utils';

export default function KycModule() {
  const [activeTab, setActiveTab] = useState<'register' | 'list'>('list');
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [selectedViewCustomer, setSelectedViewCustomer] = useState<Customer | null>(null);
  const [allLoans, setAllLoans] = useState<GoldLoan[]>([]);
  
  // Registration Form Wizard State
  const [formStep, setFormStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    dob: '',
    address: '',
    aadhaar_number: '',
    pan_number: '',
    aadhaar_file: null as string | null,
    pan_file: null as string | null,
    profile_photo: null as string | null,
  });

  // Upload simulation states
  const [isUploadingAadhaar, setIsUploadingAadhaar] = useState(false);
  const [isUploadingPan, setIsUploadingPan] = useState(false);

  // Photo states
  const [capturingPhoto, setCapturingPhoto] = useState(false);
  const [cameraCountdown, setCameraCountdown] = useState(3);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  // OTP Verification States
  const [smsSending, setSmsSending] = useState(false);
  const [smsOtpSent, setSmsOtpSent] = useState(false);
  const [smsCountdown, setSmsCountdown] = useState(59);
  const [smsOtpCode, setSmsOtpCode] = useState('');
  const [smsVerified, setSmsVerified] = useState(false);

  const [emailSending, setEmailSending] = useState(false);
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailCountdown, setEmailCountdown] = useState(59);
  const [emailOtpCode, setEmailOtpCode] = useState('');
  const [expectedEmailOtp, setExpectedEmailOtp] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);

  const [activeChannel, setActiveChannel] = useState<'sms' | 'email' | null>(null);

  // SMS Timer Tick Effect
  useEffect(() => {
    let interval: any;
    if (smsOtpSent && smsCountdown > 0) {
      interval = setInterval(() => {
        setSmsCountdown(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [smsOtpSent, smsCountdown]);

  // Email Timer Tick Effect
  useEffect(() => {
    let interval: any;
    if (emailOtpSent && emailCountdown > 0) {
      interval = setInterval(() => {
        setEmailCountdown(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [emailOtpSent, emailCountdown]);

  // Trigger Real Photo Upload
  const handlePhotoUploadSimulated = async () => {
    // Dynamic file picker
    const file = await new Promise<File | null>((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e: any) => {
        const selected = e.target.files?.[0] || null;
        resolve(selected);
      };
      input.click();
    });

    if (!file) return;

    setUploadingPhoto(true);

    // 1. Read file as Base64 Data URL and show it instantly in the frame
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData(prev => ({ ...prev, profile_photo: reader.result as string }));
    };
    reader.readAsDataURL(file);

    // 2. Upload in background
    try {
      const supabase = createBrowserSupabaseClient();
      if (!supabase) throw new Error('Supabase not configured');

      const fileName = `photo_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const { data, error } = await supabase.storage
        .from('profile-photos')
        .upload(`public/${fileName}`, file, { upsert: true });
        
      if (error) throw new Error(error.message);

      const { data: publicUrlData } = supabase.storage.from('profile-photos').getPublicUrl(`public/${fileName}`);
      setFormData(prev => ({ ...prev, profile_photo: publicUrlData.publicUrl }));
    } catch (err: any) {
      console.warn('Supabase storage photo upload failed, keeping local base64:', err);
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Webcam Camera Snap Implementation
  const handleCameraSnapSimulated = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 300, height: 300, facingMode: 'user' }
      });
      setCameraStream(stream);
      setIsCameraActive(true);
      
      // Let stream bind to element in render cycle
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err: any) {
      console.error("Failed to open webcam:", err);
      setFeedbackMsg(`Webcam error: ${err.message || 'Camera permission denied.'}`);
    }
  };

  const captureWebcamPhoto = async () => {
    if (!videoRef.current || !cameraStream) return;
    
    setUploadingPhoto(true);
    setIsCameraActive(false);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 300;
      canvas.height = videoRef.current.videoHeight || 300;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Mirror the canvas image to match webcam orientation
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      }

      // Stop camera tracks immediately
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);

      // Convert to Base64 Data URL and show it instantly in the frame
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      setFormData(prev => ({ ...prev, profile_photo: dataUrl }));

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
      if (!blob) throw new Error("Failed to capture image from webcam canvas.");

      const file = new File([blob], `camera_snap_${Date.now()}.jpg`, { type: 'image/jpeg' });
      const supabase = createBrowserSupabaseClient();
      
      if (supabase) {
        const fileName = `camera_${Date.now()}.jpg`;
        const { data, error } = await supabase.storage
          .from('profile-photos')
          .upload(`public/${fileName}`, file, { upsert: true });

        if (!error) {
          const { data: publicUrlData } = supabase.storage.from('profile-photos').getPublicUrl(`public/${fileName}`);
          setFormData(prev => ({ ...prev, profile_photo: publicUrlData.publicUrl }));
        } else {
          console.warn("Supabase camera photo upload failed, keeping base64:", error);
        }
      }
    } catch (err: any) {
      console.error("Camera capture error:", err);
      setFeedbackMsg(`Capture warning: ${err.message || 'using client-side local image preview fallback'}`);
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Trigger Send SMS OTP
  const handleSendSmsOtp = () => {
    setSmsSending(true);
    setSmsVerified(false);
    setSmsOtpSent(false);
    setActiveChannel('sms');
    
    setEmailOtpSent(false);
    setEmailVerified(false);

    setTimeout(() => {
      setSmsSending(false);
      setSmsOtpSent(true);
      setSmsCountdown(59);
      setSmsOtpCode('');
    }, 1000);
  };

  // Trigger Send Email OTP
  const handleSendEmailOtp = async () => {
    if (!formData.email) {
      alert('Please enter an email address first.');
      return;
    }

    setEmailSending(true);
    setEmailVerified(false);
    setEmailOtpSent(false);
    setActiveChannel('email');

    setSmsOtpSent(false);
    setSmsVerified(false);

    try {
      const generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();
      setExpectedEmailOtp(generatedOtp);

      const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
      const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID;
      const publicKey = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;

      if (serviceId && templateId && publicKey) {
        await emailjs.send(
          serviceId,
          templateId,
          {
            to_email: formData.email,
            to_name: formData.name || 'Customer',
            otp: generatedOtp,
          },
          publicKey
        );
      } else {
        console.warn('EmailJS environment variables not fully configured. Defaulting to mock email log.');
        console.log(`[MOCK EMAIL] To: ${formData.email} | OTP: ${generatedOtp}`);
      }

      setEmailOtpSent(true);
      setEmailCountdown(59);
      setEmailOtpCode('');
    } catch (err: any) {
      alert(`Failed to send email OTP: ${err.text || err.message || 'Unknown error'}`);
    } finally {
      setEmailSending(false);
    }
  };

  // Verify SMS OTP
  const handleVerifySmsOtp = () => {
    if (smsOtpCode.length === 4) {
      setSmsVerified(true);
      setSmsOtpSent(false);
    } else {
      alert('Error: Please enter a 4-digit numeric code.');
    }
  };

  // Verify Email OTP
  const handleVerifyEmailOtp = () => {
    if (emailOtpCode.length !== 4) {
      alert('Error: Please enter a 4-digit numeric code.');
      return;
    }
    
    if (emailOtpCode === expectedEmailOtp) {
      setEmailVerified(true);
      setEmailOtpSent(false);
    } else {
      alert('Error: Invalid OTP. Please try again.');
    }
  };

  // Clerk Suspension Request modal state
  const [showClerkSuspensionModal, setShowClerkSuspensionModal] = useState(false);
  const [selectedSuspensionCustomer, setSelectedSuspensionCustomer] = useState<Customer | null>(null);
  const [clerkSuspensionReason, setClerkSuspensionReason] = useState('Fraud Suspicion');
  const [clerkCustomReason, setClerkCustomReason] = useState('');
  const [isSubmittingStatusRequest, setIsSubmittingStatusRequest] = useState(false);

  // Manager CRUD overrides
  const [deleteTargetCustomer, setDeleteTargetCustomer] = useState<Customer | null>(null);
  const [showDeleteCustomerModal, setShowDeleteCustomerModal] = useState(false);
  const [isDeletingCustomer, setIsDeletingCustomer] = useState(false);

  const [selectedEditCustomer, setSelectedEditCustomer] = useState<Customer | null>(null);
  const [showEditCustomerModal, setShowEditCustomerModal] = useState(false);
  const [isSubmittingCustomerEdit, setIsSubmittingCustomerEdit] = useState(false);
  const [overrideCustName, setOverrideCustName] = useState('');
  const [overrideCustPhone, setOverrideCustPhone] = useState('');
  const [overrideCustEmail, setOverrideCustEmail] = useState('');
  const [overrideCustBalance, setOverrideCustBalance] = useState('');

  const handleDeleteCustomer = async () => {
    if (!deleteTargetCustomer) return;
    setIsDeletingCustomer(true);
    try {
      await db.deleteCustomer(deleteTargetCustomer.id);
      setCustomers(prev => prev.filter(c => c.id !== deleteTargetCustomer.id));
      setShowDeleteCustomerModal(false);
      setDeleteTargetCustomer(null);
      await db.createAuditLog(
        'Customer Profile Purged',
        `Permanently destructed ledger customer record: ${deleteTargetCustomer.name} (ID: ${deleteTargetCustomer.id})`,
        'KYC'
      );
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setIsDeletingCustomer(false);
    }
  };

  const handleEditCustomerOverride = async () => {
    if (!selectedEditCustomer) return;
    setIsSubmittingCustomerEdit(true);
    try {
      const parsedBalance = parseFloat(overrideCustBalance) || 0;
      await db.updateCustomerDetails(selectedEditCustomer.id, {
        name: overrideCustName,
        phone: overrideCustPhone,
        email: overrideCustEmail,
        balance: parsedBalance
      });
      setCustomers(prev => prev.map(c => c.id === selectedEditCustomer.id ? {
        ...c,
        name: overrideCustName,
        phone: overrideCustPhone,
        email: overrideCustEmail,
        balance: parsedBalance
      } : c));
      setShowEditCustomerModal(false);
      setSelectedEditCustomer(null);
      await db.createAuditLog(
        'Customer Profile Overridden',
        `Manager updated profile parameters for ${overrideCustName}. Balance overridden to: ₹${parsedBalance.toLocaleString('en-IN')}`,
        'KYC'
      );
    } catch (err) {
      console.error('Edit override failed:', err);
    } finally {
      setIsSubmittingCustomerEdit(false);
    }
  };

  const handleRequestStatusChange = async () => {
    if (!selectedSuspensionCustomer) return;
    setIsSubmittingStatusRequest(true);
    const finalReason = clerkSuspensionReason === 'Other' && clerkCustomReason ? clerkCustomReason : clerkSuspensionReason;
    
    try {
      const supabase = createBrowserSupabaseClient();
      
      if (supabase) {
        // Insert into the requests table
        const { error: requestError } = await supabase.from('suspension_requests').insert([{
          customer_id: selectedSuspensionCustomer.id,
          reason: finalReason,
          requested_by: currentProfile?.id,
          status: 'PENDING'
        }]);
        if (requestError) throw new Error(requestError.message);
        
        // Concurrently update customer status
        await db.updateCustomerStatus(
          selectedSuspensionCustomer.id, 
          'PENDING_SUSPENSION', 
          finalReason, 
          currentProfile?.name || 'Clerk Terminal'
        );
      } else {
        await db.updateCustomerStatus(
          selectedSuspensionCustomer.id, 
          'PENDING_SUSPENSION', 
          finalReason, 
          currentProfile?.name || 'Clerk Terminal'
        );
      }

      setFeedbackMsg(`Suspension request successfully dispatched to Manager for '${selectedSuspensionCustomer.name}'.`);
      setShowClerkSuspensionModal(false);
      setSelectedSuspensionCustomer(null);
      setClerkCustomReason('');
      await loadData();
    } catch (err: any) {
      alert(`Error requesting suspension: ${err.message}`);
    } finally {
      setIsSubmittingStatusRequest(false);
      setTimeout(() => setFeedbackMsg(''), 4000);
    }
  };

  const handleManagerApproveSuspension = async (id: string, reason?: string) => {
    try {
      await db.updateCustomerStatus(id, 'SUSPENDED', reason || 'Manager approved suspension');
      setFeedbackMsg('Customer account successfully suspended.');
      await loadData();
    } catch (err: any) {
      alert(`Error suspending: ${err.message}`);
    } finally {
      setTimeout(() => setFeedbackMsg(''), 4000);
    }
  };

  const handleManagerDismissSuspension = async (id: string) => {
    try {
      await db.updateCustomerStatus(id, 'ACTIVE');
      setFeedbackMsg('Suspension request dismissed. Customer returned to Active status.');
      await loadData();
    } catch (err: any) {
      alert(`Error dismissing request: ${err.message}`);
    } finally {
      setTimeout(() => setFeedbackMsg(''), 4000);
    }
  };

  const handleManagerToggleStatus = async (customer: Customer) => {
    try {
      const isCurrentlySuspended = customer.status === 'SUSPENDED';
      const targetStatus = isCurrentlySuspended ? 'ACTIVE' : 'SUSPENDED';
      await db.updateCustomerStatus(customer.id, targetStatus, isCurrentlySuspended ? 'Manager Reactivated' : 'Direct Manager Suspension');
      setFeedbackMsg(`Account for ${customer.name} was successfully ${isCurrentlySuspended ? 'Reactivated' : 'Suspended'}.`);
      await loadData();
    } catch (err: any) {
      alert(`Error toggling status: ${err.message}`);
    } finally {
      setTimeout(() => setFeedbackMsg(''), 4000);
    }
  };

  // List & Search states
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  
  // Uniqueness validation states
  const [duplicateErrors, setDuplicateErrors] = useState<{
    phone?: string;
    email?: string;
    aadhaar_number?: string;
    pan_number?: string;
  }>({});
  const [shakeBanner, setShakeBanner] = useState(false);

  const loadData = async () => {
    try {
      const cList = await db.getCustomers();
      setCustomers(cList);
      const prof = await db.getActiveUser();
      setCurrentProfile(prof);
      const lList = await db.getGoldLoans();
      setAllLoans(lList);
    } catch (err) {
      console.error('Error loading KYC details:', err);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, []);

  // Form input hander
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear duplicate warning as user types
    if (duplicateErrors[name as keyof typeof duplicateErrors]) {
      setDuplicateErrors(prev => {
        const copy = { ...prev };
        delete copy[name as keyof typeof duplicateErrors];
        return copy;
      });
    }
  };

  // Storage upload action
  const handleSimulatedUpload = async (docType: 'aadhaar' | 'pan') => {
    // Dynamic file picker
    const file = await new Promise<File | null>((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/pdf,image/*';
      input.onchange = (e: any) => {
        const selected = e.target.files?.[0] || null;
        resolve(selected);
      };
      input.click();
    });

    if (!file) return;

    const supabase = createBrowserSupabaseClient();
    if (docType === 'aadhaar') {
      setIsUploadingAadhaar(true);
    } else {
      setIsUploadingPan(true);
    }

    try {
      if (!supabase) {
        // Fallback simulated upload
        setTimeout(() => {
          if (docType === 'aadhaar') {
            setIsUploadingAadhaar(false);
            setFormData(prev => ({ ...prev, aadhaar_file: `aadhaar_upload_${Date.now()}.pdf` }));
          } else {
            setIsUploadingPan(false);
            setFormData(prev => ({ ...prev, pan_file: `pan_upload_${Date.now()}.pdf` }));
          }
        }, 1500);
        return;
      }

      const fileName = `${docType}_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const { data, error } = await supabase.storage
        .from('kyc-docs')
        .upload(`public/${fileName}`, file, { upsert: true });
        
      if (error) throw new Error(error.message);

      const { data: publicUrlData } = supabase.storage.from('kyc-docs').getPublicUrl(`public/${fileName}`);

      if (docType === 'aadhaar') {
        setFormData(prev => ({ ...prev, aadhaar_file: publicUrlData.publicUrl }));
      } else {
        setFormData(prev => ({ ...prev, pan_file: publicUrlData.publicUrl }));
      }
    } catch (err: any) {
      setFeedbackMsg(`Upload Error: ${err.message}`);
    } finally {
      if (docType === 'aadhaar') setIsUploadingAadhaar(false);
      else setIsUploadingPan(false);
    }
  };

  // Complete KYC Submit handler
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedbackMsg('');
    setDuplicateErrors({});
    setShakeBanner(false);

    try {
      // Validate inputs
      if (!formData.name || !formData.email || !formData.phone || !formData.dob || !formData.address) {
        throw new Error('Please complete Step 1 details.');
      }
      if (!formData.aadhaar_number || !formData.pan_number) {
        throw new Error('Please complete Step 2 identity inputs.');
      }
      if (!smsVerified && !emailVerified) {
        throw new Error('Please verify at least one identity channel via SMS or Email OTP challenge.');
      }

      // Strict Uniqueness checks (Aadhaar, Mobile Number, PAN, Email)
      const errors: typeof duplicateErrors = {};
      const supabase = createBrowserSupabaseClient();
      
      // Normalizing values for comparison
      const newPhone = formData.phone.replace(/[\s-()]/g, '');
      const newAadhaar = formData.aadhaar_number.replace(/[\s-()]/g, '');
      const newPan = formData.pan_number.trim().toUpperCase();
      const newEmail = formData.email.trim().toLowerCase();

      if (supabase) {
        const { data: existingCustomers, error } = await supabase
          .from('customers')
          .select('id, phone, email, aadhaar_number, pan_number')
          .or(`phone.eq.${newPhone},email.eq.${newEmail},aadhaar_number.eq.${newAadhaar},pan_number.eq.${newPan}`);
        
        if (existingCustomers && existingCustomers.length > 0) {
          existingCustomers.forEach((c: any) => {
            if (c.phone === newPhone) errors.phone = `❌ Duplication Error: A customer profile with this mobile number already exists.`;
            if (c.email === newEmail) errors.email = `❌ Duplication Error: A customer profile with this email address already exists.`;
            if (c.aadhaar_number === newAadhaar) errors.aadhaar_number = `❌ Duplication Error: A customer profile with this Aadhaar already exists.`;
            if (c.pan_number === newPan) errors.pan_number = `❌ Duplication Error: A customer profile with this PAN already exists.`;
          });
        }
      } else {
        // Fallback local mock check
        customers.forEach(c => {
          const cPhone = c.phone.replace(/[\s-()]/g, '');
          const cAadhaar = c.aadhaar_number.replace(/[\s-()]/g, '');
          const cPan = c.pan_number.trim().toUpperCase();
          const cEmail = c.email.trim().toLowerCase();

          if (cPhone === newPhone) errors.phone = `❌ Duplication Error: A customer profile with this mobile number already exists.`;
          if (cEmail === newEmail) errors.email = `❌ Duplication Error: A customer profile with this email address already exists.`;
          if (cAadhaar === newAadhaar) errors.aadhaar_number = `❌ Duplication Error: A customer profile with this Aadhaar already exists.`;
          if (cPan === newPan) errors.pan_number = `❌ Duplication Error: A customer profile with this PAN already exists.`;
        });
      }

      if (Object.keys(errors).length > 0) {
        setDuplicateErrors(errors);
        setShakeBanner(true);
        // Turn off shake state after animation ends so it can shake again on next submit
        setTimeout(() => setShakeBanner(false), 6000);
        throw new Error('Duplication Error: A customer profile with this identity/contact parameter already exists in the ledger.');
      }

      const activeUser = await db.getActiveUser();
      // Managers register as instantly VERIFIED for efficiency, clerks as PENDING
      const initialStatus = activeUser.role === 'manager' ? 'VERIFIED' : 'PENDING_APPROVAL';

      if (supabase) {
        const { error: insertError } = await supabase.from('customers').insert([{
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          dob: formData.dob,
          address: formData.address,
          aadhaar_number: formData.aadhaar_number,
          pan_number: formData.pan_number,
          aadhaar_doc_url: formData.aadhaar_file || 'mock_aadhaar_file.pdf',
          pan_doc_url: formData.pan_file || 'mock_pan_file.pdf',
          status: initialStatus,
          profile_photo: formData.profile_photo || null,
        }]);
        if (insertError) throw new Error(insertError.message);
      } else {
        await db.createCustomer({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          dob: formData.dob,
          address: formData.address,
          aadhaar_number: formData.aadhaar_number,
          pan_number: formData.pan_number,
          aadhaar_doc_url: formData.aadhaar_file || 'mock_aadhaar_file.pdf',
          pan_doc_url: formData.pan_file || 'mock_pan_file.pdf',
          status: initialStatus,
          profile_photo: formData.profile_photo || undefined,
        });
      }

      setSubmitting(false);
      setFeedbackMsg(`Success! Customer '${formData.name}' registered with status: ${initialStatus.replace('_', ' ')}.`);
      
      // Reset Form
      setFormData({
        name: '',
        email: '',
        phone: '',
        dob: '',
        address: '',
        aadhaar_number: '',
        pan_number: '',
        aadhaar_file: null,
        pan_file: null,
        profile_photo: null,
      });
      setFormStep(1);
      setSmsVerified(false);
      setEmailVerified(false);
      setSmsOtpSent(false);
      setEmailOtpSent(false);
      setActiveChannel(null);
      
      // Go back to list view
      setTimeout(() => {
        setActiveTab('list');
        setFeedbackMsg('');
      }, 2000);

    } catch (err: any) {
      setFeedbackMsg(`Error: ${err.message}`);
      setSubmitting(false);
    }
  };

  // Manager Approval handler
  const handleApproveCustomer = async (id: string) => {
    try {
      await db.verifyCustomer(id);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Verification failed.');
    }
  };

  // Filter list
  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery) ||
    c.aadhaar_number.includes(searchQuery) ||
    c.pan_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-zinc-100 display-font">Customer KYC Registry</h2>
          <p className="text-sm text-zinc-400 mt-0.5">Manage customer identities, process registrations, and verify proofs.</p>
        </div>

        {/* Tab Controls */}
        <div className="flex bg-zinc-950 p-1 border border-zinc-900 rounded-xl">
          <button
            onClick={() => setActiveTab('list')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'list' 
                ? 'bg-zinc-900 text-indigo-400 shadow-sm border border-zinc-800' 
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Users className="h-4 w-4" />
            Customer Database
          </button>
          <button
            onClick={() => setActiveTab('register')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'register' 
                ? 'bg-zinc-900 text-emerald-400 shadow-sm border border-zinc-800' 
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <UserPlus className="h-4 w-4" />
            Register Customer KYC
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div className={`p-4 rounded-xl border text-sm font-semibold transition-all ${
          feedbackMsg.startsWith('Error') 
            ? `bg-red-950/20 border-red-900/50 text-red-300 ${shakeBanner ? 'animate-shake border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]' : ''}` 
            : 'bg-emerald-950/20 border-emerald-900/50 text-emerald-300'
        }`}>
          {feedbackMsg.includes('Duplication') ? '❌ ' : ''}{feedbackMsg}
        </div>
      )}

      {/* VIEW: REGISTER KYC (STEP WIZARD) */}
      {activeTab === 'register' && (
        <div className="glass-panel p-6 md:p-8 rounded-3xl max-w-2xl mx-auto relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-emerald-500/5 to-transparent pointer-events-none" />

          {/* Wizard step progress display */}
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-zinc-900">
            <div className="flex items-center gap-4">
              <span className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-extrabold border ${
                formStep === 1 
                  ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' 
                  : 'bg-zinc-900 border-zinc-800 text-zinc-500'
              }`}>
                1
              </span>
              <div>
                <h4 className={`text-sm font-bold display-font ${formStep === 1 ? 'text-zinc-100' : 'text-zinc-500'}`}>
                  Personal Details
                </h4>
                <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Step 1 of 2</p>
              </div>
            </div>

            <ChevronRight className="h-5 w-5 text-zinc-700" />

            <div className="flex items-center gap-4">
              <span className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-extrabold border ${
                formStep === 2 
                  ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400' 
                  : 'bg-zinc-900 border-zinc-800 text-zinc-500'
              }`}>
                2
              </span>
              <div>
                <h4 className={`text-sm font-bold display-font ${formStep === 2 ? 'text-zinc-100' : 'text-zinc-500'}`}>
                  Document Uploads
                </h4>
                <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Step 2 of 2</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleFormSubmit} className="space-y-6">
            {/* STEP 1 FIELDS */}
            {formStep === 1 && (
              <div className="space-y-4">
                
                {/* Profile Photo Capture & Upload Row */}
                <div className="flex flex-col sm:flex-row gap-6 items-center p-4 bg-zinc-900/40 border border-zinc-900 rounded-2xl">
                  {/* Photo Container */}
                  <div className="w-28 h-28 rounded-2xl bg-zinc-950 border border-zinc-800 flex flex-col items-center justify-center relative overflow-hidden select-none shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.05)]">
                    {isCameraActive ? (
                      <video 
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover transform -scale-x-100"
                      />
                    ) : capturingPhoto ? (
                      <div className="flex flex-col items-center gap-1.5 text-center px-2">
                        <Loader2 className="h-6 w-6 animate-spin text-purple-400" />
                        <span className="text-[10px] text-zinc-400 font-extrabold animate-pulse">Capturing ({cameraCountdown}s)</span>
                      </div>
                    ) : uploadingPhoto ? (
                      <div className="flex flex-col items-center gap-1.5 text-center">
                        <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
                        <span className="text-[10px] text-zinc-400 font-semibold">Uploading...</span>
                      </div>
                    ) : formData.profile_photo ? (
                      <img 
                        src={formData.profile_photo} 
                        alt="Profile Preview" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1.5 text-zinc-600 text-center">
                        <Image className="h-8 w-8" />
                        <span className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-500">No Photo</span>
                      </div>
                    )}
                  </div>

                  {/* Upload/Camera action buttons */}
                  <div className="space-y-2 text-center sm:text-left w-full">
                    <h5 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">KYC Live Customer Photo</h5>
                    <p className="text-[10px] text-zinc-500 leading-relaxed">
                      Upload high-contrast JPG/PNG profile portraits or scan live biometric features using the secure desk terminal camera.
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                      <button
                        type="button"
                        onClick={handlePhotoUploadSimulated}
                        disabled={isCameraActive || capturingPhoto || uploadingPhoto}
                        className="bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 border border-zinc-800 text-zinc-300 font-bold py-2 px-3.5 rounded-lg text-[10px] uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer"
                      >
                        <Image className="h-3.5 w-3.5" />
                        Upload Photo
                      </button>

                      {isCameraActive ? (
                        <button
                          type="button"
                          onClick={captureWebcamPhoto}
                          className="bg-emerald-900 hover:bg-emerald-800 border border-emerald-500 text-emerald-400 font-bold py-2 px-3.5 rounded-lg text-[10px] uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <Camera className="h-3.5 w-3.5" />
                          Take Snapshot
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleCameraSnapSimulated}
                          disabled={capturingPhoto || uploadingPhoto}
                          className="bg-purple-950/20 hover:bg-purple-900/20 disabled:opacity-50 border border-purple-500/20 text-purple-400 font-bold py-2 px-3.5 rounded-lg text-[10px] uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <Camera className="h-3.5 w-3.5 animate-pulse" />
                          Trigger Camera
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                      Full Legal Name
                    </label>
                    <input
                      type="text"
                      name="name"
                      placeholder="e.g. Aarav Sharma"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-zinc-200"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      name="dob"
                      value={formData.dob}
                      onChange={handleInputChange}
                      required
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-zinc-200"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                      Operational Contact (Phone)
                    </label>
                    <input
                      type="text"
                      name="phone"
                      placeholder="e.g. +91 98765 43210"
                      value={formData.phone}
                      onChange={handleInputChange}
                      required
                      className={`w-full bg-zinc-900 border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-zinc-200 transition-all ${
                        duplicateErrors.phone ? 'border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.15)] bg-red-950/5' : 'border-zinc-800'
                      }`}
                    />
                    {duplicateErrors.phone && (
                      <p className="mt-1 text-[10px] font-bold text-red-400 animate-pulse">{duplicateErrors.phone}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                      Email Address
                    </label>
                    <input
                      type="email"
                      name="email"
                      placeholder="e.g. aarav.sharma@gmail.com"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className={`w-full bg-zinc-900 border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-zinc-200 transition-all ${
                        duplicateErrors.email ? 'border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.15)] bg-red-950/5' : 'border-zinc-800'
                      }`}
                    />
                    {duplicateErrors.email && (
                      <p className="mt-1 text-[10px] font-bold text-red-400 animate-pulse">{duplicateErrors.email}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                    Permanent Residential Address
                  </label>
                  <textarea
                    name="address"
                    rows={3}
                    placeholder="Enter complete house address with city, state, pin code..."
                    value={formData.address}
                    onChange={handleInputChange}
                    required
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-zinc-200 resize-none"
                  />
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      if (formData.name && formData.dob && formData.phone && formData.email && formData.address) {
                        setFormStep(2);
                      } else {
                        alert('Please fill out all Step 1 details.');
                      }
                    }}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 px-6 rounded-xl text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-[0_4px_12px_rgba(16,185,129,0.2)] hover:shadow-emerald-500/30 cursor-pointer active:scale-95"
                  >
                    <span>Proceed to Documents</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2 FIELDS */}
            {formStep === 2 && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                      Aadhaar Card Number (12 Digits)
                    </label>
                    <input
                      type="text"
                      name="aadhaar_number"
                      placeholder="e.g. 5421 9876 0124"
                      value={formData.aadhaar_number}
                      onChange={handleInputChange}
                      required
                      className={`w-full bg-zinc-900 border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-zinc-200 transition-all ${
                        duplicateErrors.aadhaar_number ? 'border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.15)] bg-red-950/5' : 'border-zinc-800'
                      }`}
                    />
                    {duplicateErrors.aadhaar_number && (
                      <p className="mt-1 text-[10px] font-bold text-red-400 animate-pulse">{duplicateErrors.aadhaar_number}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
                      PAN Card Number (10 Alphanumeric)
                    </label>
                    <input
                      type="text"
                      name="pan_number"
                      placeholder="e.g. ABCPS1234F"
                      value={formData.pan_number}
                      onChange={handleInputChange}
                      required
                      className={`w-full bg-zinc-900 border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-zinc-200 transition-all ${
                        duplicateErrors.pan_number ? 'border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.15)] bg-red-950/5' : 'border-zinc-800'
                      }`}
                    />
                    {duplicateErrors.pan_number && (
                      <p className="mt-1 text-[10px] font-bold text-red-400 animate-pulse">{duplicateErrors.pan_number}</p>
                    )}
                  </div>
                </div>

                {/* Upload Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Aadhaar Dropzone */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                      Upload Aadhaar Proof (PDF/JPG)
                    </label>
                    <div 
                      onClick={() => !formData.aadhaar_file && handleSimulatedUpload('aadhaar')}
                      className={`h-40 border border-dashed rounded-2xl flex flex-col items-center justify-center p-4 text-center cursor-pointer transition-all duration-300 ${
                        formData.aadhaar_file 
                          ? 'border-emerald-500/50 bg-emerald-500/5 text-emerald-400' 
                          : 'border-zinc-800 bg-zinc-900/40 hover:border-emerald-500/30 text-zinc-500'
                      }`}
                    >
                      {isUploadingAadhaar ? (
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                          <span className="text-xs text-zinc-400">Uploading document...</span>
                        </div>
                      ) : formData.aadhaar_file ? (
                        <div className="flex flex-col items-center gap-2">
                          <CheckCircle2 className="h-10 w-10 text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.2)]" />
                          <span className="text-xs font-bold text-zinc-200">Aadhaar Uploaded</span>
                          <span className="text-[10px] text-zinc-500 font-mono truncate max-w-[140px]">{formData.aadhaar_file}</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <UploadCloud className="h-10 w-10 text-zinc-500 hover:text-emerald-400 transition-colors" />
                          <span className="text-xs font-bold text-zinc-300">Click to upload file</span>
                          <span className="text-[9px] text-zinc-500">Max size 5MB (PDF or image)</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* PAN Dropzone */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                      Upload PAN Proof (PDF/JPG)
                    </label>
                    <div 
                      onClick={() => !formData.pan_file && handleSimulatedUpload('pan')}
                      className={`h-40 border border-dashed rounded-2xl flex flex-col items-center justify-center p-4 text-center cursor-pointer transition-all duration-300 ${
                        formData.pan_file 
                          ? 'border-emerald-500/50 bg-emerald-500/5 text-emerald-400' 
                          : 'border-zinc-800 bg-zinc-900/40 hover:border-emerald-500/30 text-zinc-500'
                      }`}
                    >
                      {isUploadingPan ? (
                        <div className="flex flex-col items-center gap-2">
                          <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                          <span className="text-xs text-zinc-400">Uploading document...</span>
                        </div>
                      ) : formData.pan_file ? (
                        <div className="flex flex-col items-center gap-2">
                          <CheckCircle2 className="h-10 w-10 text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.2)]" />
                          <span className="text-xs font-bold text-zinc-200">PAN Uploaded</span>
                          <span className="text-[10px] text-zinc-500 font-mono truncate max-w-[140px]">{formData.pan_file}</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <UploadCloud className="h-10 w-10 text-zinc-500 hover:text-emerald-400 transition-colors" />
                          <span className="text-xs font-bold text-zinc-300">Click to upload file</span>
                          <span className="text-[9px] text-zinc-500">Max size 5MB (PDF or image)</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* DUAL-CHANNEL OTP VERIFICATION CONSOLE */}
                <div className="p-5 bg-zinc-900/30 border border-zinc-900 rounded-2xl space-y-4 shadow-[0_4px_12px_rgba(0,0,0,0.1)]">
                  <div className="flex items-center gap-2 border-b border-zinc-900 pb-2">
                    <CheckCircle className="h-4.5 w-4.5 text-emerald-400" />
                    <h5 className="text-xs font-bold uppercase tracking-wider text-zinc-300">Dual-Channel Identity Verification</h5>
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-relaxed">
                    Verify at least one primary customer operational communication channel. OTP challenges must be verified before inward record submission.
                  </p>

                  <div className="space-y-3">
                    {/* SMS Verification Channel Row */}
                    <div className={`p-4 rounded-xl border transition-all duration-300 ${
                      smsVerified 
                        ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.05)]' 
                        : activeChannel === 'sms'
                        ? 'bg-zinc-900 border-zinc-800'
                        : 'bg-zinc-900/20 border-zinc-950 text-zinc-500'
                    }`}>
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div className="flex items-center gap-2.5">
                          <Phone className={`h-4.5 w-4.5 ${smsVerified ? 'text-emerald-400' : 'text-zinc-550'}`} />
                          <div>
                            <span className="block text-[9px] uppercase tracking-widest text-zinc-500 font-extrabold">SMS OTP Channel</span>
                            <span className={`font-mono text-xs font-bold ${smsVerified ? 'text-emerald-300' : 'text-zinc-300'}`}>
                              {formData.phone || '+91 ••••• •••••'}
                            </span>
                          </div>
                        </div>

                        {smsVerified ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-extrabold uppercase bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 animate-pulse">
                            ✓ SMS Verified
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={handleSendSmsOtp}
                            disabled={smsSending || activeChannel === 'email'}
                            className="bg-zinc-900 hover:bg-zinc-800 disabled:opacity-30 border border-zinc-800 text-zinc-300 font-bold py-2 px-3 rounded-lg text-[10px] uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer ml-auto sm:ml-0"
                          >
                            {smsSending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
                            ) : (
                              'Send SMS OTP'
                            )}
                          </button>
                        )}
                      </div>

                      {/* Revealed SMS OTP numeric prompt */}
                      {activeChannel === 'sms' && smsOtpSent && !smsVerified && (
                        <div className="mt-4 pt-3 border-t border-zinc-800/60 flex flex-col sm:flex-row items-start sm:items-center gap-4 animate-fade-in">
                          <div className="w-full sm:w-auto">
                            <label className="block text-[9px] uppercase tracking-wider text-zinc-400 mb-1 font-bold">Enter 4-Digit OTP</label>
                            <input
                              type="text"
                              maxLength={4}
                              placeholder="e.g. 1234"
                              value={smsOtpCode}
                              onChange={(e) => setSmsOtpCode(e.target.value.replace(/\D/g, ''))}
                              className="w-28 bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-center font-mono font-bold text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder-zinc-800"
                            />
                          </div>

                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto mt-2 sm:mt-4">
                            <button
                              type="button"
                              onClick={handleVerifySmsOtp}
                              disabled={smsOtpCode.length !== 4}
                              className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-900 disabled:text-zinc-600 border border-emerald-500/20 disabled:border-transparent text-white font-extrabold py-2 px-4 rounded-lg text-[10px] uppercase tracking-wider transition-all cursor-pointer"
                            >
                              Verify OTP
                            </button>
                            <span className="text-[10px] text-zinc-500 font-semibold font-mono">
                              {smsCountdown > 0 ? `Resend in ${smsCountdown}s` : 'Resend Available'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Email Verification Channel Row */}
                    <div className={`p-4 rounded-xl border transition-all duration-300 ${
                      emailVerified 
                        ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.05)]' 
                        : activeChannel === 'email'
                        ? 'bg-zinc-900 border-zinc-800'
                        : 'bg-zinc-900/20 border-zinc-950 text-zinc-500'
                    }`}>
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div className="flex items-center gap-2.5">
                          <Mail className={`h-4.5 w-4.5 ${emailVerified ? 'text-emerald-400' : 'text-zinc-550'}`} />
                          <div className="overflow-hidden">
                            <span className="block text-[9px] uppercase tracking-widest text-zinc-500 font-extrabold">Email OTP Channel</span>
                            <span className={`block text-xs font-bold truncate max-w-[200px] ${emailVerified ? 'text-emerald-300' : 'text-zinc-300'}`}>
                              {formData.email || '••••••••@••••.com'}
                            </span>
                          </div>
                        </div>

                        {emailVerified ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-extrabold uppercase bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 animate-pulse">
                            ✓ Email Verified
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={handleSendEmailOtp}
                            disabled={emailSending || activeChannel === 'sms'}
                            className="bg-zinc-900 hover:bg-zinc-800 disabled:opacity-30 border border-zinc-800 text-zinc-300 font-bold py-2 px-3 rounded-lg text-[10px] uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer ml-auto sm:ml-0"
                          >
                            {emailSending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-400" />
                            ) : (
                              'Send Email OTP'
                            )}
                          </button>
                        )}
                      </div>

                      {/* Revealed Email OTP numeric prompt */}
                      {activeChannel === 'email' && emailOtpSent && !emailVerified && (
                        <div className="mt-4 pt-3 border-t border-zinc-800/60 flex flex-col sm:flex-row items-start sm:items-center gap-4 animate-fade-in">
                          <div className="w-full sm:w-auto">
                            <label className="block text-[9px] uppercase tracking-wider text-zinc-400 mb-1 font-bold">Enter 4-Digit OTP</label>
                            <input
                              type="text"
                              maxLength={4}
                              placeholder="e.g. 1234"
                              value={emailOtpCode}
                              onChange={(e) => setEmailOtpCode(e.target.value.replace(/\D/g, ''))}
                              className="w-28 bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-center font-mono font-bold text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder-zinc-800"
                            />
                          </div>

                          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto mt-2 sm:mt-4">
                            <button
                              type="button"
                              onClick={handleVerifyEmailOtp}
                              disabled={emailOtpCode.length !== 4}
                              className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-900 disabled:text-zinc-600 border border-emerald-500/20 disabled:border-transparent text-white font-extrabold py-2 px-4 rounded-lg text-[10px] uppercase tracking-wider transition-all cursor-pointer"
                            >
                              Verify OTP
                            </button>
                            <span className="text-[10px] text-zinc-500 font-semibold font-mono">
                              {emailCountdown > 0 ? `Resend in ${emailCountdown}s` : 'Resend Available'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Navigation and Submission Buttons */}
                <div className="flex justify-between pt-4 border-t border-zinc-900">
                  <button
                    type="button"
                    onClick={() => setFormStep(1)}
                    className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 font-bold py-3.5 px-6 rounded-xl text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Back</span>
                  </button>

                  {currentProfile?.role === 'manager' ? (
                    <button
                      type="submit"
                      disabled={submitting || isUploadingAadhaar || isUploadingPan || (!smsVerified && !emailVerified)}
                      className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 disabled:shadow-none text-white font-bold py-3.5 px-6 rounded-xl text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-[0_4px_12px_rgba(16,185,129,0.2)] hover:shadow-emerald-500/30 cursor-pointer active:scale-95 select-none"
                    >
                      {submitting ? 'Registering customer...' : 'Complete Inward Record'}
                    </button>
                  ) : (
                    <div className="flex flex-col items-end gap-1.5">
                      <button
                        type="button"
                        disabled
                        className="bg-zinc-850 border border-zinc-800 text-zinc-500 font-bold py-3.5 px-6 rounded-xl text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-not-allowed select-none"
                      >
                        <Lock className="h-4 w-4 text-zinc-500" />
                        <span>Complete Inward Record</span>
                      </button>
                      <span className="text-[10px] text-zinc-500 font-semibold flex items-center gap-1">
                        <Lock className="h-3 w-3" /> Privileged action. Access restricted to Manager role.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </form>
        </div>
      )}

      {/* VIEW: ALL CUSTOMERS LIST */}
      {activeTab === 'list' && (
        <div className="space-y-4">
          
          {/* Manager Account Status Change Requests Section */}
          {currentProfile?.role === 'manager' && customers.filter(c => c.status === 'PENDING_SUSPENSION').length > 0 && (
            <div className="glass-panel glass-panel-glow-indigo p-6 rounded-3xl border border-zinc-800 space-y-4 mb-6">
              <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                  <h4 className="text-sm font-bold uppercase tracking-wider text-zinc-200 display-font">
                    Account Status Change Requests
                  </h4>
                </div>
                <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full">
                  {customers.filter(c => c.status === 'PENDING_SUSPENSION').length} Pending Requests
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {customers.filter(c => c.status === 'PENDING_SUSPENSION').map((reqCust) => (
                  <div 
                    key={reqCust.id} 
                    className="p-4 bg-zinc-950/60 border border-zinc-900 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all hover:border-zinc-800/80 shadow-md"
                  >
                    <div className="space-y-1.5 overflow-hidden">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-zinc-100 display-font truncate block">
                          {reqCust.name}
                        </span>
                        <span className="bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[8px] font-extrabold uppercase px-2 py-0.2 rounded-full">
                          Pending Suspension
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-500 leading-tight">
                        Requested by: <span className="font-bold text-zinc-400">{reqCust.suspension_requested_by || 'Clerk'}</span>
                      </p>
                      <p className="text-xs text-zinc-300 bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-900/60 italic inline-block mt-1 max-w-full truncate">
                        Reason: "{reqCust.suspension_reason || 'No specific reason given'}"
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                      <button
                        onClick={() => handleManagerDismissSuspension(reqCust.id)}
                        className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 font-bold px-3 py-2 rounded-xl text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer select-none active:scale-95"
                      >
                        Dismiss Request
                      </button>
                      <button
                        onClick={() => handleManagerApproveSuspension(reqCust.id, reqCust.suspension_reason)}
                        className="bg-rose-950/20 hover:bg-rose-900/20 border border-rose-500/30 hover:border-rose-500/50 text-rose-400 font-bold px-3 py-2 rounded-xl text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer select-none active:scale-95 shadow-[0_2px_8px_rgba(244,63,94,0.1)]"
                      >
                        Approve Suspension
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Search container */}
          <div className="glass-panel p-4 rounded-2xl flex items-center relative overflow-hidden">
            <span className="pl-3 text-zinc-500">
              <Search className="h-5 w-5" />
            </span>
            <input
              type="text"
              placeholder="Search customers by Name, Email, Phone, Aadhaar, or PAN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-0 pl-3 pr-4 py-2.5 text-sm focus:outline-none focus:ring-0 text-zinc-200 placeholder-zinc-500"
            />
          </div>

          {/* Customer Ledger Table */}
          <div className="glass-panel rounded-2xl overflow-hidden border border-zinc-900">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-900/60 border-b border-zinc-900/80 text-zinc-400 font-bold text-xs uppercase tracking-wider">
                    <th className="px-6 py-4">Customer Details</th>
                    <th className="px-6 py-4">Contact Info</th>
                    <th className="px-6 py-4">Identity Credentials</th>
                    <th className="px-6 py-4">KYC Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900/60 text-sm">
                  {filteredCustomers.map((customer) => {
                    const isVerified = customer.status === 'VERIFIED';
                    
                    return (
                      <tr key={customer.id} className="hover:bg-zinc-900/20 transition-colors">
                        {/* Name & DOB */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center shrink-0 overflow-hidden text-[10px] font-bold text-indigo-400 font-mono shadow-[0_2px_8px_rgba(99,102,241,0.1)]">
                              {customer.profile_photo ? (
                                <img 
                                  src={customer.profile_photo} 
                                  alt={customer.name} 
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                customer.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-zinc-200">{customer.name}</p>
                              <p className="text-xs text-zinc-500 mt-0.5">DOB: {customer.dob}</p>
                            </div>
                          </div>
                        </td>
                        {/* Email & Phone */}
                        <td className="px-6 py-4">
                          <div>
                            <p className="font-medium text-zinc-300">{customer.phone}</p>
                            <p className="text-xs text-zinc-500 truncate max-w-[180px]">{customer.email}</p>
                          </div>
                        </td>
                        {/* Identities */}
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-xs text-zinc-300">
                              <span className="font-semibold text-zinc-500">AADHAAR:</span>
                              <span className="font-mono">{customer.aadhaar_number}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-zinc-300">
                              <span className="font-semibold text-zinc-500">PAN:</span>
                              <span className="font-mono">{customer.pan_number}</span>
                            </div>
                          </div>
                        </td>
                        {/* Status Badges */}
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            customer.status === 'VERIFIED' || customer.status === 'ACTIVE'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                              : customer.status === 'SUSPENDED'
                              ? 'bg-red-500/10 text-red-400 border-red-500/20'
                              : customer.status === 'PENDING_SUSPENSION'
                              ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                              : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                          }`}>
                            {customer.status === 'VERIFIED' || customer.status === 'ACTIVE' ? (
                              <>
                                <CheckCircle className="h-3.5 w-3.5" />
                                Active
                              </>
                            ) : customer.status === 'SUSPENDED' ? (
                              <>
                                <X className="h-3.5 w-3.5 text-red-400" />
                                Suspended
                              </>
                            ) : customer.status === 'PENDING_SUSPENSION' ? (
                              <>
                                <Clock className="h-3.5 w-3.5 text-amber-350" />
                                Pending Suspension
                              </>
                            ) : (
                              <>
                                <Clock className="h-3.5 w-3.5" />
                                Pending KYC Approval
                              </>
                            )}
                          </span>
                        </td>
                        {/* Actions */}
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setSelectedViewCustomer(customer)}
                              className="bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/30 hover:border-indigo-500/50 text-indigo-400 font-bold px-3 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View More
                            </button>

                            {currentProfile?.role === 'manager' && (
                              <>
                                <button
                                  onClick={() => {
                                    setSelectedEditCustomer(customer);
                                    setOverrideCustName(customer.name);
                                    setOverrideCustPhone(customer.phone);
                                    setOverrideCustEmail(customer.email);
                                    setOverrideCustBalance(customer.balance !== undefined ? customer.balance.toString() : '');
                                    setShowEditCustomerModal(true);
                                  }}
                                  className="bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/30 hover:border-indigo-500/50 text-indigo-400 p-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center shrink-0"
                                  title="Edit Customer Profile"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    setDeleteTargetCustomer(customer);
                                    setShowDeleteCustomerModal(true);
                                  }}
                                  className="bg-red-950/20 hover:bg-red-900/20 border border-red-500/30 hover:border-red-500/50 text-red-400 p-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center shrink-0"
                                  title="Delete Customer Profile"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}

                            {customer.status === 'PENDING_APPROVAL' ? (
                              currentProfile?.role === 'manager' ? (
                                <button
                                  onClick={() => handleApproveCustomer(customer.id)}
                                  className="bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/30 hover:border-emerald-500/50 text-emerald-400 font-bold px-3 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1 cursor-pointer"
                                >
                                  <UserCheck className="h-3.5 w-3.5" />
                                  Approve KYC
                                </button>
                              ) : (
                                <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-semibold justify-end">
                                  <ShieldAlert className="h-3.5 w-3.5" />
                                  <span>Pending KYC</span>
                                </div>
                              )
                            ) : (
                              currentProfile?.role === 'manager' ? (
                                <button
                                  onClick={() => handleManagerToggleStatus(customer)}
                                  className={`font-bold px-3 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1 cursor-pointer select-none ${
                                    customer.status === 'SUSPENDED'
                                      ? 'bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/30 hover:border-emerald-500/50 text-emerald-400'
                                      : 'bg-red-950/20 hover:bg-red-900/20 border border-red-500/30 hover:border-red-500/50 text-red-400'
                                  }`}
                                >
                                  <ShieldAlert className="h-3.5 w-3.5" />
                                  {customer.status === 'SUSPENDED' ? 'Activate Account' : 'Suspend Account'}
                                </button>
                              ) : (
                                // Clerk row actions for approved customers
                                customer.status === 'PENDING_SUSPENSION' ? (
                                  <span className="text-[10px] text-amber-400 bg-amber-500/5 border border-amber-500/10 px-2.5 py-1.5 rounded-lg font-semibold uppercase tracking-wider">
                                    Request Pending
                                  </span>
                                ) : customer.status === 'SUSPENDED' ? (
                                  <span className="text-[10px] text-red-400 bg-red-500/5 border border-red-500/10 px-2.5 py-1.5 rounded-lg font-semibold uppercase tracking-wider">
                                    Suspended
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setSelectedSuspensionCustomer(customer);
                                      setShowClerkSuspensionModal(true);
                                    }}
                                    className="bg-amber-600/10 hover:bg-amber-600/20 border border-amber-500/30 hover:border-amber-500/50 text-amber-400 font-bold px-3 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1 cursor-pointer select-none"
                                  >
                                    Request Status Change
                                  </button>
                                )
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredCustomers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-sm text-zinc-500">
                        No registered customers matched your search query.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW MORE MODAL OVERLAY */}
      {selectedViewCustomer && (() => {
        const custLoans = allLoans.filter(l => l.customer_id === selectedViewCustomer.id);
        const initials = selectedViewCustomer.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        
        // Dynamic mock ledger balance
        const mockBalance = selectedViewCustomer.balance !== undefined 
          ? selectedViewCustomer.balance 
          : ((selectedViewCustomer.name.charCodeAt(0) * 452) + 12400);
        
        // Dynamic mock card number
        const mockCardLast4 = (selectedViewCustomer.name.charCodeAt(1) * 63) % 10000;
        const formattedCard = `•••• •••• •••• ${mockCardLast4.toString().padStart(4, '0')}`;

        // Mask Aadhaar: •••• •••• 1234
        const cleanAadhaar = selectedViewCustomer.aadhaar_number.replace(/\s+/g, '');
        const maskedAadhaar = cleanAadhaar.length >= 4 
          ? `•••• •••• ${cleanAadhaar.substring(cleanAadhaar.length - 4)}`
          : '•••• •••• ••••';

        return (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="glass-panel glass-panel-glow-indigo p-6 md:p-8 rounded-3xl max-w-2xl w-full relative overflow-y-auto max-h-[90vh] space-y-6">
              
              {/* Close Button [X] */}
              <button
                onClick={() => setSelectedViewCustomer(null)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-200 bg-zinc-900 border border-zinc-800 p-2 rounded-full transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Title Header */}
              <div className="flex items-center gap-2 border-b border-zinc-900 pb-4">
                <Users className="h-5 w-5 text-indigo-400" />
                <h3 className="text-xl font-bold text-zinc-100 display-font">Manager Operations: Customer Profile Folder</h3>
              </div>

              {/* Profile Card Summary */}
              <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start p-4 bg-zinc-900/30 border border-zinc-900 rounded-2xl">
                {/* Profile Photo Placeholder */}
                <div className="w-24 h-24 rounded-2xl bg-indigo-600/10 border border-indigo-500/25 flex flex-col items-center justify-center text-center text-indigo-400 font-extrabold text-2xl select-none shadow-[0_0_15px_rgba(99,102,241,0.15)] shrink-0 overflow-hidden relative">
                  {selectedViewCustomer.profile_photo ? (
                    <img 
                      src={selectedViewCustomer.profile_photo} 
                      alt={selectedViewCustomer.name} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <>
                      {initials}
                      <span className="text-[8px] font-bold uppercase tracking-widest text-zinc-500 mt-1">Photo Box</span>
                    </>
                  )}
                </div>

                <div className="text-center sm:text-left space-y-1.5 overflow-hidden">
                  <h4 className="text-xl font-bold text-zinc-100 display-font truncate">{selectedViewCustomer.name}</h4>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                    selectedViewCustomer.status === 'VERIFIED'
                      ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/20'
                      : 'bg-amber-500/5 text-amber-300 border-amber-500/20'
                  }`}>
                    {selectedViewCustomer.status === 'VERIFIED' ? 'VERIFIED PROFILE' : 'PENDING APPROVAL'}
                  </span>
                  <p className="text-xs text-zinc-500">System Reference ID: <span className="font-mono text-[10px] text-zinc-400">{selectedViewCustomer.id}</span></p>
                </div>
              </div>

              {/* Primary Profile Parameters (2 columns) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="block font-bold text-zinc-500 uppercase tracking-wider text-[10px] mb-1">Operational Phone</span>
                  <p className="font-bold text-zinc-200">{selectedViewCustomer.phone}</p>
                </div>
                <div>
                  <span className="block font-bold text-zinc-500 uppercase tracking-wider text-[10px] mb-1">Email Address</span>
                  <p className="font-bold text-zinc-200">{selectedViewCustomer.email}</p>
                </div>
                <div>
                  <span className="block font-bold text-zinc-500 uppercase tracking-wider text-[10px] mb-1">Masked Aadhaar Number</span>
                  <p className="font-mono font-bold text-zinc-200">{maskedAadhaar}</p>
                </div>
                <div>
                  <span className="block font-bold text-zinc-500 uppercase tracking-wider text-[10px] mb-1">PAN Card String</span>
                  <p className="font-mono font-bold text-zinc-200">{selectedViewCustomer.pan_number}</p>
                </div>
                <div>
                  <span className="block font-bold text-zinc-500 uppercase tracking-wider text-[10px] mb-1">Date of Birth</span>
                  <p className="font-bold text-zinc-200">{selectedViewCustomer.dob}</p>
                </div>
                <div>
                  <span className="block font-bold text-zinc-500 uppercase tracking-wider text-[10px] mb-1">Residential Address</span>
                  <p className="font-bold text-zinc-200 leading-relaxed">{selectedViewCustomer.address}</p>
                </div>
              </div>

              {/* Ledger & Card parameters (Split layout) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-zinc-900 pt-5">
                <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
                  <span className="block text-[9px] font-extrabold uppercase tracking-widest text-emerald-400 mb-1">Available Ledger Balance</span>
                  <h4 className="text-2xl font-black text-emerald-400 display-font">{formatRupee(mockBalance)}</h4>
                </div>

                <div className="p-4 bg-zinc-900/50 border border-zinc-900 rounded-2xl">
                  <span className="block text-[9px] font-extrabold uppercase tracking-widest text-indigo-400 mb-1.5">Masked Debit/ATM Card</span>
                  <p className="font-mono font-bold text-sm text-zinc-300 tracking-wider">{formattedCard}</p>
                </div>
              </div>

              {/* Active Liability / Gold Loan Accounts matrix */}
              <div className="border-t border-zinc-900 pt-5 space-y-3">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Active Liability & Loan Accounts Matrix</span>
                
                <div className="overflow-x-auto rounded-xl border border-zinc-900 bg-zinc-950/40">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-zinc-900 text-zinc-500 font-bold uppercase tracking-wider text-[9px] border-b border-zinc-900">
                        <th className="px-4 py-2">Loan Reference</th>
                        <th className="px-4 py-2">Collateral Purity</th>
                        <th className="px-4 py-2">Physical Location</th>
                        <th className="px-4 py-2 text-right">Principal Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {custLoans.map((loan) => (
                        <tr key={loan.id} className="border-b border-zinc-900/60 last:border-0">
                          <td className="px-4 py-2.5 font-mono text-zinc-400">{loan.id.substring(0, 8)}...</td>
                          <td className="px-4 py-2.5 font-bold text-zinc-200">{loan.net_weight}g at {loan.purity.toUpperCase()}</td>
                          <td className="px-4 py-2.5 font-medium text-zinc-400">{loan.locker_shelf_id} ({loan.packet_number})</td>
                          <td className="px-4 py-2.5 text-right font-bold text-emerald-400">{formatRupee(loan.loan_amount)}</td>
                        </tr>
                      ))}
                      {custLoans.length === 0 && (
                        <tr>
                          <td colSpan={4} className="text-center py-4 text-zinc-500 font-medium italic">No active loan accounts or liabilities registered.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Close footer button */}
              <div className="flex justify-end border-t border-zinc-900 pt-4">
                <button
                  onClick={() => setSelectedViewCustomer(null)}
                  className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-bold py-2.5 px-6 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer active:scale-95"
                >
                  Close Folder
                </button>
              </div>

            </div>
          </div>
        );
      })()}

      {/* CLERK SUSPENSION REQUEST MODAL DIALOG */}
      {showClerkSuspensionModal && selectedSuspensionCustomer && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="glass-panel glass-panel-glow-indigo p-6 md:p-8 rounded-3xl max-w-md w-full relative space-y-6">
            {/* Close button */}
            <button
              onClick={() => {
                setShowClerkSuspensionModal(false);
                setSelectedSuspensionCustomer(null);
                setClerkCustomReason('');
              }}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-200 bg-zinc-900 border border-zinc-800 p-2 rounded-full transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-2 border-b border-zinc-900 pb-3">
              <ShieldAlert className="h-5 w-5 text-amber-500 animate-pulse" />
              <h3 className="text-base font-bold text-zinc-100 display-font uppercase tracking-wider">
                Request Account Status Change
              </h3>
            </div>

            <div className="space-y-4">
              <div className="p-3 bg-zinc-950 border border-zinc-900 rounded-xl">
                <span className="block text-[9px] uppercase tracking-widest text-zinc-500 font-extrabold">Customer Name</span>
                <span className="font-extrabold text-sm text-zinc-200">{selectedSuspensionCustomer.name}</span>
                <span className="block text-[9px] text-zinc-500 font-mono mt-0.5">ID: {selectedSuspensionCustomer.id}</span>
              </div>

              {/* Reason Selector Dropdown */}
              <div className="space-y-2">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">
                  Select Suspension Reason
                </label>
                <select
                  value={clerkSuspensionReason}
                  onChange={(e) => setClerkSuspensionReason(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-xs text-zinc-250 font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="Fraud Suspicion">Fraud Suspicion</option>
                  <option value="Lost Card">Lost Card</option>
                  <option value="Customer Request">Customer Request</option>
                  <option value="Other">Other Reason (Specify Below)</option>
                </select>
              </div>

              {/* Custom Reason TextArea */}
              {clerkSuspensionReason === 'Other' && (
                <div className="space-y-2 animate-fade-in">
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">
                    Specify Custom Reason
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Provide details on the status change requirement..."
                    value={clerkCustomReason}
                    onChange={(e) => setClerkCustomReason(e.target.value)}
                    required
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                  />
                </div>
              )}

              <p className="text-[10px] text-zinc-500 leading-relaxed italic">
                Note: Upon submission, the customer profile is instantly updated to PENDING_SUSPENSION status and flagged for urgent Manager clearance review.
              </p>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 border-t border-zinc-900 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowClerkSuspensionModal(false);
                  setSelectedSuspensionCustomer(null);
                  setClerkCustomReason('');
                }}
                className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 font-bold py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer active:scale-95"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRequestStatusChange}
                disabled={isSubmittingStatusRequest || (clerkSuspensionReason === 'Other' && !clerkCustomReason)}
                className="bg-amber-600 hover:bg-amber-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-[0_4px_12px_rgba(245,158,11,0.2)] cursor-pointer active:scale-95 disabled:opacity-40 select-none"
              >
                {isSubmittingStatusRequest ? 'Sending...' : 'Send Request to Manager'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANAGER DELETE CONFIRMATION DIALOG */}
      {showDeleteCustomerModal && deleteTargetCustomer && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="glass-panel glass-panel-glow-indigo p-6 md:p-8 rounded-3xl max-w-md w-full relative space-y-6">
            <button
              onClick={() => {
                setShowDeleteCustomerModal(false);
                setDeleteTargetCustomer(null);
              }}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-200 bg-zinc-900 border border-zinc-800 p-2 rounded-full transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2 border-b border-zinc-900 pb-3">
              <ShieldAlert className="h-5 w-5 text-red-500 animate-pulse" />
              <h3 className="text-base font-bold text-zinc-100 display-font uppercase tracking-wider">
                Destruct Ledger Record?
              </h3>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-red-950/10 border border-red-500/25 rounded-2xl space-y-2">
                <span className="block text-[9px] uppercase tracking-widest text-red-400 font-extrabold">Warning: Critical Administrative Action</span>
                <p className="text-xs text-zinc-300 leading-relaxed font-semibold">
                  Confirm permanent destruction of ledger record for <span className="text-white font-extrabold">{deleteTargetCustomer.name}</span>?
                </p>
                <p className="text-[10px] text-zinc-400 leading-relaxed font-normal">
                  Permanent destruction of ledger parameters cannot be undone. This operation will globally purge all client profile associations from the workspace core database.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-zinc-900 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteCustomerModal(false);
                  setDeleteTargetCustomer(null);
                }}
                className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 font-bold py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer active:scale-95"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteCustomer}
                disabled={isDeletingCustomer}
                className="bg-red-600 hover:bg-red-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-[0_4px_12px_rgba(239,68,68,0.2)] cursor-pointer active:scale-95 disabled:opacity-40 select-none"
              >
                {isDeletingCustomer ? 'Purging...' : 'Destroy Record'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MANAGER CUSTOMER EDIT OVERRIDE DIALOG */}
      {showEditCustomerModal && selectedEditCustomer && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="glass-panel glass-panel-glow-indigo p-6 md:p-8 rounded-3xl max-w-md w-full relative space-y-6">
            <button
              onClick={() => {
                setShowEditCustomerModal(false);
                setSelectedEditCustomer(null);
              }}
              className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-200 bg-zinc-900 border border-zinc-800 p-2 rounded-full transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2 border-b border-zinc-900 pb-3">
              <Pencil className="h-5 w-5 text-indigo-400 animate-pulse" />
              <h3 className="text-base font-bold text-zinc-100 display-font uppercase tracking-wider">
                Override Customer Parameters
              </h3>
            </div>

            <div className="space-y-4">
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Full Name</label>
                <input
                  type="text"
                  value={overrideCustName}
                  onChange={(e) => setOverrideCustName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                  required
                />
              </div>

              {/* Phone */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Phone Number</label>
                <input
                  type="text"
                  value={overrideCustPhone}
                  onChange={(e) => setOverrideCustPhone(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                  required
                />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Email Address</label>
                <input
                  type="email"
                  value={overrideCustEmail}
                  onChange={(e) => setOverrideCustEmail(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                  required
                />
              </div>

              {/* Balance */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">Available Ledger Balance (₹)</label>
                <input
                  type="number"
                  value={overrideCustBalance}
                  onChange={(e) => setOverrideCustBalance(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-zinc-900 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowEditCustomerModal(false);
                  setSelectedEditCustomer(null);
                }}
                className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 font-bold py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer active:scale-95"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEditCustomerOverride}
                disabled={isSubmittingCustomerEdit || !overrideCustName}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-[0_4px_12px_rgba(99,102,241,0.2)] cursor-pointer active:scale-95 disabled:opacity-40 select-none"
              >
                {isSubmittingCustomerEdit ? 'Saving...' : 'Save Override'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
