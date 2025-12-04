// Shared TypeScript contracts used across pages and services for API results.
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'dean' | 'admin' | 'coordinator' | 'student' | 'superadmin';
  created_at: string;
  registration_id?: string;
  phone?: string;
  school?: string;
  department?: string;
  designation?: string;
}

export interface EventReport {
  generated_at?: string;
  attendee_count: number;
  feedback_count: number;
  average_rating: number;
  notes?: string;
  recipients?: string[];
}

export interface EventAgendaItem {
  title?: string;
  start_time?: string;
  end_time?: string;
  speaker?: string;
  location?: string;
}

export interface EventContact {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  time?: string;
  location: string;
  school?: string;
  department?: string;
  status: 'draft' | 'scheduled' | 'ongoing' | 'completed';
  invitation_mode: 'open' | 'invite-only';
  allow_self_check_in: boolean;
  category: string;
  event_format: string;
  delivery_mode: 'in-person' | 'online' | 'hybrid';
  tags: string[];
  sponsors: string[];
  budget: {
    currency: string;
    amount: number;
  };
  requires_approval: boolean;
  approval_status: 'draft' | 'pending' | 'approved' | 'rejected';
  approval_notes?: string;
  approved_at?: string;
  approved_by?: string;
  approved_by_name?: string;
  feedback_open?: boolean;
  coordinators: string[];
  coordinator_names: string[];
  assigned_coordinator?: string;
  qr_code?: string;
  google_form_url?: string;
  created_at: string;
  agenda: EventAgendaItem[];
  important_contacts: EventContact[];
  report?: EventReport | null;
  feedback_submitted?: boolean;
}

export interface Attendance {
  id: string;
  event_id: string;
  student_id: string;
  scanned_at: string;
}

export interface AttendanceRecord {
  user_id: string;
  registration_id?: string;
  name: string;
  email: string;
  signature?: string | null;
  timestamp?: string | null;
  school?: string;
  department?: string;
}

export interface Feedback {
  id: string;
  event_id: string;
  student_id: string;
  rating: number;
  comments: string;
  created_at: string;
  user?: User;
}

export interface EventInvitation {
  id: string;
  event_id: string;
  role_at_event: 'coordinator' | 'attendee';
  status: 'pending' | 'accepted' | 'declined' | 'revoked';
  invited_at: string;
  responded_at?: string;
  message?: string;
  invitee: User;
  invited_by?: User;
}

export interface AuthUser {
  user: User;
  token: string;
}

// Backend response types
export interface BackendUser {
  _id?: string;
  id?: string;
  userID?: string;
  name: string;
  email: string;
  role: string;
  createdAt?: string;
  registrationId?: string;
  phone?: string;
  school?: string;
  department?: string;
  designation?: string;
}

export interface BackendEventReport {
  generatedAt?: string;
  attendeeCount?: number;
  feedbackCount?: number;
  averageRating?: number;
  notes?: string;
  recipients?: (string | BackendUser)[];
}

export interface BackendAgendaItem {
  title?: string;
  startTime?: string;
  endTime?: string;
  speaker?: string;
  location?: string;
}

export interface BackendContact {
  name?: string;
  role?: string;
  email?: string;
  phone?: string;
}

export interface BackendEvent {
  _id?: string;
  id?: string;
  eventID?: string;
  title?: string;
  name?: string;
  description?: string;
  date: string;
  time?: string;
  location: string;
  school?: string;
  department?: string;
  status?: 'draft' | 'scheduled' | 'ongoing' | 'completed';
  invitationMode?: 'open' | 'invite-only';
  allowSelfCheckIn?: boolean;
  category?: string;
  eventFormat?: string;
  deliveryMode?: 'in-person' | 'online' | 'hybrid';
  tags?: string[];
  sponsors?: string[];
  budget?: {
    currency?: string;
    amount?: number;
  };
  attendanceLog?: Array<{
    user?: BackendUser | string;
    signature?: string;
    capturedAt?: string;
  }>;
  feedbackOpen?: boolean;
  requiresApproval?: boolean;
  approvalStatus?: 'draft' | 'pending' | 'approved' | 'rejected';
  approvalNotes?: string;
  approvedAt?: string;
  approvedBy?: BackendUser | string;
  coordinators?: string[] | BackendUser[];
  qr_code?: string;
  google_form_url?: string;
  createdAt?: string;
  agenda?: BackendAgendaItem[];
  importantContacts?: BackendContact[];
  report?: BackendEventReport | null;
  feedbackSubmitted?: boolean;
}

export interface BackendFeedback {
  _id?: string;
  id?: string;
  event?: { _id: string };
  event_id?: string;
  user?: BackendUser | { _id: string };
  student_id?: string;
  rating: number;
  comments?: string;
  createdAt?: string;
}

export interface BackendInvitation {
  _id?: string;
  id?: string;
  event?: string | BackendEvent;
  invitee?: BackendUser;
  invitedBy?: BackendUser;
  roleAtEvent: 'coordinator' | 'attendee';
  status: 'pending' | 'accepted' | 'declined' | 'revoked';
  message?: string;
  createdAt?: string;
  updatedAt?: string;
  respondedAt?: string;
}

export interface BackendAuthResponse {
  _id?: string;
  id?: string;
  userID?: string;
  name: string;
  email: string;
  role: string;
  token: string;
  createdAt?: string;
  school?: string;
  department?: string;
  designation?: string;
}

export interface BackendStatsResponse {
  assignedEvents?: number;
  events?: number;
  attendance?: number;
  completedEvents?: number;
}

export interface DeanOverviewMetrics {
  pendingApprovals: number;
  rejectedApprovals: number;
  upcomingApproved: number;
  totalAttendance: number;
  topDepartments: Array<{ department: string; events: number; attendance: number; }>;
  recentEvents: Array<{
    _id?: string;
    name: string;
    date: string;
    status: string;
    approvalStatus: string;
    school?: string;
    department?: string;
    createdAt?: string;
  }>;
}

export interface DirectoryMember {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'coordinator';
  school?: string;
  department?: string;
}

export interface DirectoryDepartment {
  department: string;
  count: number;
  members: DirectoryMember[];
}

export interface DirectorySchool {
  school: string;
  totalMembers: number;
  departments: DirectoryDepartment[];
}

export interface DirectoryResponse {
  role: 'student' | 'coordinator';
  schools: DirectorySchool[];
}

export interface EventOverview {
  event: Event;
  attendance: AttendanceRecord[];
  feedback: {
    averageRating: number;
    total: number;
    entries: Feedback[];
  };
}
