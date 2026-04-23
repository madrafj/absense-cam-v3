import { create } from 'zustand';

interface AppState {
  modelsLoaded: boolean;
  setModelsLoaded: (loaded: boolean) => void;
  // Session recognition for currently recognized users in the stream
  recognizedSessionBuffer: Map<string, { id: string, name: string, count: number }>;
  addRecognizedUser: (user: { id: string, name: string }) => void;
  removeRecognizedUser: (id: string) => void;
  clearSessionBuffer: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  modelsLoaded: false,
  setModelsLoaded: (loaded) => {
    console.log("[Store] setModelsLoaded ->", loaded);
    set({ modelsLoaded: loaded });
  },
  recognizedSessionBuffer: new Map(),
  addRecognizedUser: (user) => 
    set((state) => {
      const newMap = new Map(state.recognizedSessionBuffer);
      const existing = newMap.get(user.id);
      if (existing) {
        existing.count += 1;
      } else {
        newMap.set(user.id, { ...user, count: 1 });
      }
      return { recognizedSessionBuffer: newMap };
    }),
  removeRecognizedUser: (id) =>
    set((state) => {
      const newMap = new Map(state.recognizedSessionBuffer);
      newMap.delete(id);
      return { recognizedSessionBuffer: newMap };
    }),
  clearSessionBuffer: () => set({ recognizedSessionBuffer: new Map() })
}));
