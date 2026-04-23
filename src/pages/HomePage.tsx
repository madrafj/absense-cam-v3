import { Camera, Users, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';

export default function HomePage() {
  const navigate = useNavigate();
  const { modelsLoaded } = useAppStore();

  return (
    <div className="flex flex-col h-screen p-6 bg-base-200 justify-center items-center">
      <div className="w-full max-w-sm space-y-8 flex flex-col items-center">
        <div className="text-center mb-4">
          <h1 className="text-5xl font-black text-primary tracking-tighter">Absense V3</h1>
          <p className="font-semibold text-base-content/60 mt-2">Real-time Recognition</p>
        </div>
        
        {!modelsLoaded ? (
          <div className="badge badge-warning p-4 shadow-sm w-full font-bold animate-pulse">
            Warming up Neural Networks...
          </div>
        ) : (
          <div className="badge badge-success p-4 shadow-sm w-full font-bold">
            FaceAI Models Ready
          </div>
        )}

        <div className="w-full space-y-4">
          <button 
             className="btn btn-primary btn-lg w-full h-24 rounded-[2rem] shadow-xl flex flex-col gap-1 overflow-hidden relative group"
             disabled={!modelsLoaded}
             onClick={() => navigate('/camera')}
          >
            <Camera className="w-8 h-8"/>
            <span className="text-lg">Live Session</span>
          </button>

          <button 
             className="btn btn-secondary btn-lg w-full h-24 rounded-[2rem] shadow-xl flex flex-col gap-1"
             disabled={!modelsLoaded}
             onClick={() => navigate('/enroll')}
          >
            <Users className="w-8 h-8"/>
            <span className="text-lg">Enroll Student</span>
          </button>

          <button 
             className="btn btn-neutral btn-lg w-full h-24 rounded-[2rem] shadow-xl flex flex-col gap-1"
             onClick={() => navigate('/history')}
          >
            <History className="w-8 h-8"/>
            <span className="text-lg">Attendance History</span>
          </button>
        </div>
      </div>
    </div>
  );
}
