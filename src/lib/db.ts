import localforage from 'localforage';

export const faceDb = localforage.createInstance({
  name: 'absense-cam',
  storeName: 'faces',
  description: 'Stores arrays of face descriptors for enrolled users mapped to groups'
});

export const attendanceDb = localforage.createInstance({
  name: 'absense-cam',
  storeName: 'attendance',
  description: 'Stores history of attendance'
});

export interface EnrolledUser {
  id: string;
  name: string;
  groupId: string; // The specific classroom/group the user belongs to
  descriptors: Float32Array[]; // Up to 4 descriptions to improve angle accuracy
  enrolledAt: number;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  groupId: string; 
  timestamp: number;
}
