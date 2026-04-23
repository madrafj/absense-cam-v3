import { useRef, useState, useEffect } from 'react';
import * as faceapi from '@vladmandic/face-api';
import { faceDb, attendanceDb } from '../lib/db';
import type { EnrolledUser, AttendanceRecord } from '../lib/db';
import { useAppStore } from '../store/useAppStore';
import { UserCheck, Trash2, CheckCircle2, ShieldAlert, ArrowLeft, Play, Camera, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function CameraPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const { recognizedSessionBuffer, addRecognizedUser, removeRecognizedUser, clearSessionBuffer } = useAppStore();
  const [faceMatcher, setFaceMatcher] = useState<faceapi.FaceMatcher | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState('');
  const runningRef = useRef(false);

  // Pre-session strict group selection
  const [availableGroups, setAvailableGroups] = useState<string[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [sessionStarted, setSessionStarted] = useState(false);

  // Load all unique groups on mount
  useEffect(() => {
    async function loadGroups() {
      const groups = new Set<string>();
      await faceDb.iterate((user: EnrolledUser) => {
        groups.add(user.groupId);
      });
      setAvailableGroups(Array.from(groups));
    }
    loadGroups();
  }, []);

  // When session starts, create face matcher for ONLY that group
  useEffect(() => {
    if (!sessionStarted || !selectedGroup) return;

    async function initializeMatcher() {
      const labeledDescriptors: faceapi.LabeledFaceDescriptors[] = [];
      
      await faceDb.iterate((user: EnrolledUser) => {
        if (user.groupId === selectedGroup) {
          const arrays = user.descriptors.map(d => new Float32Array(d));
          labeledDescriptors.push(
            new faceapi.LabeledFaceDescriptors(user.id, arrays)
          );
        }
      });
      
      if (labeledDescriptors.length > 0) {
        setFaceMatcher(new faceapi.FaceMatcher(labeledDescriptors, 0.45)); 
      } else {
        setFaceMatcher(null);
      }
    }
    initializeMatcher();
  }, [sessionStarted, selectedGroup]);

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');

  // Start Camera only when session is active
  useEffect(() => {
    if (!sessionStarted) return;

    async function setupCamera() {
      if (!window.isSecureContext && window.location.hostname !== 'localhost') {
        setCameraError('Camera requires HTTPS on mobile. Use a secure context.');
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
        console.error('Camera Access Error:', err);
        setCameraError(err.message || 'Could not access camera.');
      }
    }
    setupCamera();
    
    return () => {
      runningRef.current = false;
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, [sessionStarted, facingMode]);

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const handleVideoPlay = () => {
    runningRef.current = true;
    detectLoop();
  };

  const detectLoop = async () => {
    if (!videoRef.current || !canvasRef.current || !runningRef.current) return;
    
    try {
      const detections = await faceapi.detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
                                      .withFaceLandmarks()
                                      .withFaceDescriptors();
      
      const displaySize = { width: videoRef.current.videoWidth, height: videoRef.current.videoHeight };
      if (displaySize.width === 0) {
         setTimeout(detectLoop, 100);
         return;
      }
      
      faceapi.matchDimensions(canvasRef.current, displaySize);
      const resizedDetections = faceapi.resizeResults(detections, displaySize);
      
      canvasRef.current.getContext('2d')?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

      if (faceMatcher) {
        const results = resizedDetections.map(d => faceMatcher!.findBestMatch(d.descriptor));
        results.forEach((result, i) => {
          let box = resizedDetections[i].detection.box;
          
          // Manually flip coordinates if the video is mirrored via CSS
          // so the labels stay readable (non-mirrored) on the canvas
          if (facingMode === 'user') {
            box = new faceapi.Box({
              x: displaySize.width - box.x - box.width,
              y: box.y,
              width: box.width,
              height: box.height
            });
          }

          let color = result.label !== 'unknown' ? '#10b981' : '#ef4444';
          let text = result.label !== 'unknown' ? 'Recognized' : 'Unknown';

          if (result.label !== 'unknown') {
            faceDb.getItem<EnrolledUser>(result.label).then(user => {
               if (user) {
                 addRecognizedUser({ id: user.id, name: user.name });
               }
            });
          }
          
          const drawBox = new faceapi.draw.DrawBox(box, { label: text, boxColor: color, drawLabelOptions: { fontSize: 16 } });
          drawBox.draw(canvasRef.current!);
        });
      } else {
         // Fallback for simple detection without matcher
         resizedDetections.forEach(d => {
            let box = d.detection.box;
            if (facingMode === 'user') {
                box = new faceapi.Box({
                  x: displaySize.width - box.x - box.width,
                  y: box.y,
                  width: box.width,
                  height: box.height
                });
            }
            new faceapi.draw.DrawBox(box).draw(canvasRef.current!);
         });
      }
    } catch(err) {
       console.error("Detection loop error", err);
    }
    
    if (runningRef.current) {
       setTimeout(detectLoop, 250); 
    }
  };

  const handleConfirmSubmit = async () => {
    const timestamp = Date.now();
    for (const [id, user] of recognizedSessionBuffer.entries()) {
      const record: AttendanceRecord = {
        id: crypto.randomUUID(),
        userId: id,
        userName: user.name,
        groupId: selectedGroup,
        timestamp
      };
      await attendanceDb.setItem(record.id, record);
    }
    clearSessionBuffer();
    setIsModalOpen(false);
  };

  const forceExit = () => {
     runningRef.current = false;
     if (stream) stream.getTracks().forEach(track => track.stop());
     clearSessionBuffer();
     navigate(-1);
  };

  if (!sessionStarted) {
    return (
      <div className="flex flex-col h-screen bg-base-200">
        <div className="navbar bg-base-100 shadow-sm z-10 px-4">
          <button className="btn btn-ghost text-base-content" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-6 h-6"/> Back
          </button>
          <div className="mx-auto font-bold text-lg hidden sm:block text-base-content">Session Config</div>
        </div>
        
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="card max-w-sm w-full bg-base-100 shadow-2xl border border-base-300">
            <div className="card-body">
              <h2 className="card-title text-2xl font-black mb-2 text-base-content">Startup Setup</h2>
              <p className="text-base-content/60 mb-6 font-medium">Select a designated grouping to start recognition.</p>
              
              <div className="form-control w-full mb-8">
                <label className="label">
                  <span className="label-text font-bold text-base-content">Target Classroom / Group</span>
                </label>
                
                {/* Visual Fix: Styled select with distinct background and border contrast */}
                <div className="relative group">
                  <select 
                    className="select select-bordered select-lg w-full bg-base-200 border-2 border-primary/30 focus:border-primary shadow-inner font-bold text-base-content"
                    value={selectedGroup}
                    onChange={(e) => setSelectedGroup(e.target.value)}
                  >
                    <option disabled value="">Pick a group</option>
                    {availableGroups.map(g => (
                      <option 
                        key={g} 
                        value={g} 
                        className="bg-base-100 text-base-content py-3"
                      >
                        {g}
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-primary">
                    <ChevronDown className="w-5 h-5"/>
                  </div>
                </div>

                {availableGroups.length === 0 && (
                  <label className="label">
                     <span className="label-text-alt text-error font-medium mt-1">No groups found. Enroll students first.</span>
                  </label>
                )}
              </div>

              <button 
                className="btn btn-primary btn-lg w-full shadow-lg h-16 rounded-2xl"
                disabled={!selectedGroup}
                onClick={() => setSessionStarted(true)}
              >
                <Play className="w-6 h-6"/> Start Session
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Active Session View
  return (
    <div className="h-screen flex flex-col bg-black relative">
      <div className="absolute top-4 left-4 z-50">
        <button 
          className="btn btn-error btn-sm shadow-xl backdrop-blur-md bg-error/90"
          onClick={forceExit}
        >
          <ArrowLeft className="w-4 h-4"/> Stop Session
        </button>
      </div>

      <div className={`transition-all duration-300 absolute top-4 left-1/2 -translate-x-1/2 z-50 ${recognizedSessionBuffer.size > 0 ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'}`}>
        <div 
           className="badge badge-primary badge-lg shadow-2xl p-6 gap-3 cursor-pointer border border-white/20" 
           onClick={() => setIsModalOpen(true)}
        >
          <UserCheck className="w-6 h-6"/>
          <span className="font-bold text-lg">Recognized: {recognizedSessionBuffer.size}</span>
          <button className="btn btn-sm btn-circle ml-2 bg-white text-primary border-none">➔</button>
        </div>
      </div>

      <div className="flex-1 w-full h-full relative overflow-hidden">
        <video 
          ref={videoRef} 
          autoPlay 
          muted 
          playsInline
          onPlay={handleVideoPlay}
          className={`absolute inset-0 w-full h-full object-cover transform ${facingMode === 'user' ? '-scale-x-100' : ''}`}
        />
        <canvas 
          ref={canvasRef} 
          className="absolute inset-0 w-full h-full object-cover pointer-events-none" 
        />

        <div className="absolute top-4 right-4 z-50">
          <button className="btn btn-circle btn-ghost bg-white/20 backdrop-blur-md text-white shadow-lg" onClick={toggleCamera}>
            <Camera className="w-6 h-6"/>
          </button>
        </div>

        {cameraError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-md z-20 p-6 text-center">
             <div className="bg-error/20 text-error-content p-6 rounded-2xl border border-error/50">
               <ShieldAlert className="w-12 h-12 text-error mx-auto mb-4"/>
               <h3 className="text-xl font-bold mb-2">Camera Error</h3>
               <p>{cameraError}</p>
               <button className="btn btn-ghost mt-4" onClick={() => navigate(-1)}>Go Back</button>
             </div>
          </div>
        )}
        {!faceMatcher && !cameraError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-10">
            <div className="bg-error/20 text-error-content p-6 rounded-2xl flex flex-col items-center gap-4 text-center max-w-md mx-4 shadow-xl border border-error/50">
              <ShieldAlert className="w-12 h-12 text-error"/>
              <h3 className="text-xl font-bold">No Students Identofied for "{selectedGroup}"</h3>
              <p>Enroll students to this group before running a session.</p>
            </div>
          </div>
        )}
      </div>

      <input type="checkbox" id="review_modal" className="modal-toggle" checked={isModalOpen} onChange={(e) => setIsModalOpen(e.target.checked)} />
      <div className="modal modal-bottom sm:modal-middle backdrop-blur-sm" role="dialog">
        <div className="modal-box relative p-8 shadow-2xl border border-base-200">
          <label htmlFor="review_modal" className="btn btn-sm btn-circle absolute right-6 top-6 bg-base-200 border-none">✕</label>
          <h3 className="font-black text-2xl mb-6 flex items-center gap-3">
            <div className="p-2 bg-secondary/10 rounded-lg text-secondary"><CheckCircle2 className="w-6 h-6" /></div>
            Review Session: {selectedGroup}
          </h3>
          
          {recognizedSessionBuffer.size === 0 ? (
            <div className="flex flex-col items-center py-10 text-base-content/50">
              <UserCheck className="w-12 h-12 mb-4 opacity-50"/>
              <p className="font-medium text-lg">No students pending.</p>
            </div>
          ) : (
            <div className="bg-base-200 rounded-xl overflow-hidden mb-6 border border-base-300 max-h-64 overflow-y-auto shadow-inner">
              <ul className="divide-y divide-base-300">
                {Array.from(recognizedSessionBuffer.values()).map(user => (
                  <li key={user.id} className="flex flex-row justify-between items-center p-4 hover:bg-base-300/50 transition-colors">
                    <div>
                      <span className="font-bold text-lg block leading-none mb-1 text-base-content">{user.name}</span>
                      <span className="text-xs text-base-content/50 font-medium">Spotted {user.count} times</span>
                    </div>
                    <button onClick={() => removeRecognizedUser(user.id)} className="btn btn-error btn-sm btn-square btn-outline ml-4">
                      <Trash2 className="w-4 h-4"/>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="modal-action mt-8">
            <button className="btn btn-ghost" onClick={() => setIsModalOpen(false)}>Continue</button>
            <button className="btn btn-primary px-8" onClick={handleConfirmSubmit} disabled={recognizedSessionBuffer.size === 0}>
              Commit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
