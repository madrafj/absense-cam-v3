import { useRef, useState, useEffect } from 'react';
import * as faceapi from '@vladmandic/face-api';
import { faceDb } from '../lib/db';
import type { EnrolledUser } from '../lib/db';
import { Camera, Save, ArrowLeft, Info, PlusCircle, List, UserPlus, FileEdit, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const captureHints = [
  "Look straight at the camera",
  "Turn slightly to your left",
  "Turn slightly to your right",
  "Look slightly up or smile"
];

export default function EnrollmentPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  
  const [name, setName] = useState('');
  
  // Available groups for dropdown
  const [availableGroups, setAvailableGroups] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<EnrolledUser[]>([]);
  
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  
  // Group Selection
  const [selectedGroup, setSelectedGroup] = useState('');
  const [newGroupName, setNewGroupName] = useState(() => {
    const y = new Date().getFullYear();
    const shortY = y.toString().substring(2);
    const shortNext = (y + 1).toString().substring(2);
    return `INST_CLASS_${shortY}/${shortNext}`;
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  
  const [descriptors, setDescriptors] = useState<Float32Array[]>([]);

  // Load data on mount
  const refreshData = async () => {
    const groups = new Set<string>();
    const users: EnrolledUser[] = [];
    await faceDb.iterate((user: EnrolledUser) => {
      groups.add(user.groupId);
      users.push(user);
    });
    const groupList = Array.from(groups);
    setAvailableGroups(groupList);
    setAllUsers(users);
    
    if (groupList.length > 0 && !selectedGroup) {
      setSelectedGroup(groupList[0]);
    } else if (groupList.length === 0) {
      setIsCreatingNew(true);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  useEffect(() => {
    async function setupCamera() {
      if (!window.isSecureContext && window.location.hostname !== 'localhost') {
        setMessage('Camera requires HTTPS on mobile. Please access via a secure URL.');
        return;
      }

      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      try {
        const constraints = { 
          video: { 
            facingMode: facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 }
          } 
        };
        const mv = await navigator.mediaDevices.getUserMedia(constraints);
        setStream(mv);
        if (videoRef.current) {
          videoRef.current.srcObject = mv;
          videoRef.current.setAttribute('playsinline', 'true');
        }
      } catch (err: any) {
        console.error('Camera Error:', err);
        setMessage(`Camera Error: ${err.message || 'Unknown error'}`);
      }
    }
    setupCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [facingMode]);

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const handleCaptureStep = async () => {
    if (!videoRef.current) return;
    setLoading(true);
    setMessage('Scanning face...');

    try {
      const detection = await faceapi.detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions())
                                     .withFaceLandmarks()
                                     .withFaceDescriptor();

      if (!detection) {
        setMessage('No face detected! Please ensure your face is well lit and centered.');
        return;
      }

      setDescriptors(prev => [...prev, detection.descriptor]);
      setMessage('');
    } catch (err) {
      console.error(err);
      setMessage('Error reading face data.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditUserSelect = (id: string) => {
    const user = allUsers.find(u => u.id === id);
    if (user) {
      setName(user.name);
      setSelectedGroup(user.groupId);
      setEditingUserId(user.id);
      setIsEditMode(true);
      setIsCreatingNew(false);
      setDescriptors([]); // Allow fresh capture for update
      setMessage(`Loaded ${user.name} for editing.`);
    }
  };

  const handleFinalSubmit = async () => {
    const finalGroupName = isCreatingNew ? newGroupName.trim() : selectedGroup;
    
    if (!name.trim() || !finalGroupName) {
       setMessage('Please fill in Name and Group.');
       return;
    }

    if (isCreatingNew && !finalGroupName.includes('_')) {
       setMessage('Group Pattern: <institution>_<class>_<period>');
       return;
    }

    const id = isEditMode && editingUserId ? editingUserId : crypto.randomUUID();
    
    const user: EnrolledUser = {
      id,
      name: name.trim(),
      groupId: finalGroupName,
      descriptors: descriptors,
      enrolledAt: Date.now()
    };

    setLoading(true);
    try {
      await faceDb.setItem(id, user);
      setMessage(`Successfully ${isEditMode ? 'updated' : 'enrolled'}: ${user.name}`);
      
      await refreshData();
      
      // Reset after 2s
      setTimeout(() => {
        if (!isEditMode) {
          setName('');
          setDescriptors([]);
        }
        setMessage('');
      }, 2000);
    } catch(err) {
      setMessage('Database error saving records.');
    } finally {
      setLoading(false);
    }
  };

  const resetMode = () => {
    setIsEditMode(false);
    setEditingUserId(null);
    setName('');
    setDescriptors([]);
    setMessage('');
  };

  return (
    <div className="flex flex-col h-screen bg-base-200">
      <div className="navbar bg-base-100 shadow-sm z-10 px-4">
        <button className="btn btn-ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-6 h-6"/> Back
        </button>
        <div className="mx-auto font-bold text-lg hidden sm:block">Student Management</div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-8 text-base-content">
        <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Camera View */}
          <div className="flex flex-col gap-4">
            <div className="relative rounded-3xl overflow-hidden bg-black aspect-[3/4] sm:aspect-video flex items-center justify-center shadow-xl border-4 border-base-100">
              <video 
                autoPlay 
                muted 
                playsInline 
                ref={videoRef} 
                className={`absolute inset-0 w-full h-full object-cover transform ${facingMode === 'user' ? '-scale-x-100' : ''}`} 
              />
              {!stream && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-base-300 gap-4 p-6 text-center">
                   <span className="loading loading-ring loading-lg text-primary"></span>
                   {message && <p className="text-error text-sm font-bold">{message}</p>}
                </div>
              )}
              
              <div className="absolute top-4 right-4 z-20">
                <button className="btn btn-circle btn-sm btn-ghost bg-base-100/20 backdrop-blur-md" onClick={toggleCamera}>
                  <Camera className="w-4 h-4"/>
                </button>
              </div>

              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
                {Array.from({length: 4}).map((_, i) => (
                   <div key={i} className={`w-3 h-3 rounded-full shadow-sm ${i < descriptors.length ? 'bg-success' : 'bg-base-200/50'}`}></div>
                ))}
              </div>
            </div>
            
            <div className="card bg-base-100 shadow-sm border border-base-300">
               <div className="card-body p-4 text-center">
                 {descriptors.length < 4 ? (
                   <>
                     <h3 className="font-bold text-lg">{captureHints[descriptors.length]}</h3>
                     <p className="text-sm text-base-content/60">Capture faces to {isEditMode ? 'update' : 'create'} biometric data</p>
                     <button 
                       className={`btn btn-primary mt-2 flex items-center gap-2 ${loading ? 'loading' : ''}`}
                       onClick={handleCaptureStep}
                       disabled={loading || !stream}
                     >
                       <Camera className="w-5 h-5"/>
                       Capture Step {descriptors.length + 1}
                     </button>
                   </>
                 ) : (
                   <div className="text-success font-bold flex flex-col items-center gap-2">
                     All 4 optimal angles captured!
                     <button className="btn btn-sm btn-outline mt-2" onClick={() => setDescriptors([])}>Retake Faces</button>
                   </div>
                 )}
               </div>
            </div>
          </div>

          {/* Form */}
          <div className="space-y-6">
            <div className="card bg-base-100 shadow-xl border border-base-300 overflow-hidden">
              <div className="flex p-0 bg-base-200">
                <button 
                  onClick={resetMode}
                  className={`flex-1 py-4 font-bold flex items-center justify-center gap-2 transition-colors ${!isEditMode ? 'bg-base-100 text-primary' : 'hover:bg-base-300 text-base-content/60'}`}
                >
                  <UserPlus className="w-5 h-5"/> Enroll New
                </button>
                <button 
                  onClick={() => setIsEditMode(true)}
                  className={`flex-1 py-4 font-bold flex items-center justify-center gap-2 transition-colors ${isEditMode ? 'bg-base-100 text-secondary' : 'hover:bg-base-300 text-base-content/60'}`}
                >
                  <FileEdit className="w-5 h-5"/> Update Existing
                </button>
              </div>

              <div className="card-body">
                {isEditMode ? (
                  <div className="form-control mb-4">
                    <label className="label"><span className="label-text font-bold">Select Student</span></label>
                    <select 
                      className="select select-bordered w-full bg-base-200"
                      onChange={(e) => handleEditUserSelect(e.target.value)}
                      value={editingUserId || ''}
                    >
                      <option value="" disabled>--- Choose Student to Update ---</option>
                      {allUsers.map(u => (
                        <option key={u.id} value={u.id}>{u.name} ({u.groupId})</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="form-control mb-4">
                    <label className="label"><span className="label-text font-bold">Student Name</span></label>
                    <input 
                      type="text" 
                      className="input input-bordered w-full" 
                      value={name} 
                      onChange={(e) => setName(e.target.value)} 
                      placeholder="Enter full name" 
                    />
                  </div>
                )}

                <div className="p-5 rounded-2xl border bg-base-200/50 border-base-300 space-y-4">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2 text-secondary">
                      <List className="w-4 h-4"/>
                      <h3 className="font-bold text-xs uppercase tracking-widest text-secondary">Class / Group</h3>
                    </div>
                    {!isEditMode && availableGroups.length > 0 && (
                      <button 
                        className="btn btn-xs btn-ghost gap-1 text-primary"
                        onClick={() => setIsCreatingNew(!isCreatingNew)}
                      >
                        {isCreatingNew ? <><List className="w-3 h-3"/> Use List</> : <><PlusCircle className="w-3 h-3"/> Create New</>}
                      </button>
                    )}
                  </div>
                  
                  {isCreatingNew ? (
                    <div className="form-control">
                      <input 
                        type="text" 
                        className="input input-sm input-bordered w-full" 
                        value={newGroupName} 
                        onChange={(e) => setNewGroupName(e.target.value)} 
                        placeholder="Rabbani_10A_25/26" 
                      />
                    </div>
                  ) : (
                    <div className="form-control">
                      <select 
                        className="select select-sm select-bordered w-full"
                        disabled={isEditMode}
                        value={selectedGroup}
                        onChange={(e) => setSelectedGroup(e.target.value)}
                      >
                        {availableGroups.map(g => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {isEditMode && editingUserId && (
                  <div className="alert alert-info py-2 shadow-sm text-xs mt-4">
                    <Info className="w-4 h-4"/>
                    <span>Collecting new faces will overwrite previous biometric data for this user.</span>
                  </div>
                )}

                {message && !message.includes('Scanning') && (
                  <div className={`alert text-sm font-semibold shadow-sm mt-4 ${message.includes('Error') || message.includes('Please') ? 'alert-error' : 'alert-success'}`}>
                    <span>{message}</span>
                  </div>
                )}

                <div className="flex gap-2 mt-6">
                   <button 
                    className={`btn flex-1 ${isEditMode ? 'btn-secondary' : 'btn-primary shadow-lg'}`}
                    disabled={descriptors.length === 0 || loading || !name.trim()}
                    onClick={handleFinalSubmit}
                  >
                    <Save className="w-5 h-5"/>
                    {isEditMode ? 'Update Face' : 'Enroll Student'}
                  </button>
                  
                  {isEditMode && editingUserId && (
                    <button 
                      className="btn btn-error btn-square btn-outline"
                      title="Delete Student"
                      onClick={async () => {
                        if(confirm(`Are you sure you want to delete ${name}?`)) {
                          await faceDb.removeItem(editingUserId);
                          resetMode();
                          refreshData();
                        }
                      }}
                    >
                      <Trash2 className="w-5 h-5"/>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
