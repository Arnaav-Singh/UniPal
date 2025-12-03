// Coordinator dashboard for managing events, attendance, and invitations.
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { EventCard } from '@/components/EventCard';
import { QRCodeGenerator } from '@/components/QRCodeGenerator';
import { FeedbackQRCodeGenerator } from '@/components/FeedbackQRCodeGenerator';
import { GoogleFormQRGenerator } from '@/components/GoogleFormQRGenerator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { CalendarDays, Users, QrCode, Plus, FileText, Sparkles, UserPlus, Loader2, Clock, Building2, GraduationCap, X, RefreshCcw, Download, Star, AlertTriangle, Image as ImageIcon } from 'lucide-react';
import { DirectoryMember, DirectorySchool, Event, EventInvitation, EventOverview, User, AttendanceRecord } from '@/types';
import { apiService } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_SCHOOL, getAllSchools, getBranchesForSchool } from '@/lib/schools';

const SDG_GOALS = [
  'SDG1: No Poverty', 'SDG2: Zero Hunger', 'SDG3: Good Health and Well-being',
  'SDG4: Quality Education', 'SDG5: Gender Equality', 'SDG6: Clean Water and Sanitation',
  'SDG7: Affordable and Clean Energy', 'SDG8: Decent Work and Economic Growth',
  'SDG9: Industry, Innovation and Infrastructure', 'SDG10: Reduced Inequalities',
  'SDG11: Sustainable Cities and Communities', 'SDG12: Responsible Consumption and Production',
  'SDG13: Climate Action', 'SDG14: Life Below Water', 'SDG15: Life on Land',
  'SDG16: Peace, Justice and Strong Institutions', 'SDG17: Partnerships for the Goals'
];

type DirectoryRole = 'student' | 'coordinator';

interface CoordinatorEventForm {
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  school: string;
  department: string;
  invitation_mode: 'invite-only' | 'open';
  allow_self_check_in: boolean;
  sdg: string[];
  guest_speakers: string;
}

type ParticipantAccountType = 'participant' | 'student' | 'attendee';

interface ParticipantFormState {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  accountType: ParticipantAccountType;
  registrationId: string;
  school: string;
  department: string;
  phone: string;
}

export default function CoordinatorDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [showFeedbackQRDialog, setShowFeedbackQRDialog] = useState(false);
  const [showGoogleFormQRDialog, setShowGoogleFormQRDialog] = useState(false);
  const [showAttendanceDialog, setShowAttendanceDialog] = useState(false);
  const [assignedEvents, setAssignedEvents] = useState<Event[]>([]);
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [eventOverview, setEventOverview] = useState<EventOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [attendanceFallbackLoading, setAttendanceFallbackLoading] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState<'attendance' | 'feedback' | 'report'>('attendance');
  const [endEventLoading, setEndEventLoading] = useState(false);
  const [reportSummary, setReportSummary] = useState('');
  const [reportPhotos, setReportPhotos] = useState<{ name: string; data: string }[]>([]);
  const [reportGenerating, setReportGenerating] = useState(false);
  const [stats, setStats] = useState({
    assignedEvents: 0,
    totalAttendees: 0,
    avgFeedbackRating: 0
  });
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEvent, setInviteEvent] = useState<Event | null>(null);
  const [inviteEmails, setInviteEmails] = useState('');
  const [inviteRole, setInviteRole] = useState<'attendee' | 'coordinator'>('attendee');
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteSummary, setInviteSummary] = useState<EventInvitation[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const formatLocalDateTime = useCallback((dateStr?: string, timeStr?: string) => {
    if (!dateStr) return '';
    const dateTime = timeStr ? `${dateStr}T${timeStr}` : `${dateStr}T00:00`;
    const parsed = new Date(dateTime);
    if (Number.isNaN(parsed.getTime())) return dateStr;
    return parsed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }, []);
  const coordinatorSchool = user?.school || DEFAULT_SCHOOL;
  const [createForm, setCreateForm] = useState<CoordinatorEventForm>({
    title: '',
    description: '',
    date: '',
    time: '',
    location: '',
    school: coordinatorSchool,
    department: getBranchesForSchool(coordinatorSchool)[0] ?? '',
    invitation_mode: 'invite-only',
    allow_self_check_in: true,
    sdg: [],
    guest_speakers: '',
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [participantForm, setParticipantForm] = useState<ParticipantFormState>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    accountType: 'participant',
    registrationId: '',
    school: coordinatorSchool,
    department: getBranchesForSchool(coordinatorSchool)[0] ?? '',
    phone: '',
  });
  const [participantSubmitting, setParticipantSubmitting] = useState(false);
  const [selectedActiveEventId, setSelectedActiveEventId] = useState('');
  const schoolOptions = useMemo(() => getAllSchools(), []);
  const createBranchOptions = useMemo(() => {
    const branches = getBranchesForSchool(createForm.school);
    return branches.length > 0 ? branches : ['General'];
  }, [createForm.school]);
  const participantBranchOptions = useMemo(() => {
    const branches = getBranchesForSchool(participantForm.school);
    return branches.length > 0 ? branches : ['General'];
  }, [participantForm.school]);
  const activeEvents = useMemo(
    () => assignedEvents.filter((event) => (['ongoing', 'scheduled'].includes(event.status)) && event.approval_status === 'approved'),
    [assignedEvents]
  );
  const [directoryRole, setDirectoryRole] = useState<DirectoryRole>('student');
  const [directoryData, setDirectoryData] = useState<Record<DirectoryRole, DirectorySchool[]>>({
    student: [],
    coordinator: [],
  });
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [selectedDirectoryMembers, setSelectedDirectoryMembers] = useState<Record<string, DirectoryMember>>({});
  const selectedDirectoryList = useMemo(() => Object.values(selectedDirectoryMembers), [selectedDirectoryMembers]);
  const directorySchools = useMemo(() => directoryData[directoryRole], [directoryData, directoryRole]);
  const manualEmailCount = useMemo(() => inviteEmails.split(/[\n,;]+/).map((email) => email.trim()).filter(Boolean).length, [inviteEmails]);
  const pendingInviteCount = selectedDirectoryList.length + manualEmailCount;

  // Fetch assigned events and high-level stats for the current coordinator.
  const loadData = useCallback(async () => {
    if (!user) return;

    try {
      const [eventsData, statsData] = await Promise.all([
        apiService.getEventsByCoordinator(user.id),
        apiService.getCoordinatorStats(user.id)
      ]);
      setAssignedEvents(eventsData);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load coordinator data:', error);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, loadData]);

  useEffect(() => {
    if (!user?.school) return;
    setCreateForm((prev) => {
      if (createDialogOpen || prev.title || prev.location) {
        return prev;
      }
      const defaultDepartment = getBranchesForSchool(user.school)[0] ?? prev.department;
      return {
        ...prev,
        school: user.school,
        department: defaultDepartment,
      };
    });
  }, [user?.school, createDialogOpen]);

  useEffect(() => {
    if (activeEvents.length > 0) {
      setSelectedActiveEventId((prev) => {
        if (prev && activeEvents.some((ev) => ev.id === prev)) return prev;
        return activeEvents[0].id;
      });
    } else {
      setSelectedActiveEventId('');
    }
  }, [activeEvents]);

  // Open the QR modal for attendance check-ins.
  const handleGenerateQR = (event: Event) => {
    setSelectedEvent(event);
    setShowQRDialog(true);
  };

  // Open the QR modal for feedback submission.
  const handleGenerateFeedbackQR = (event: Event) => {
    if (!event.feedback_open) {
      toast({
        title: 'Feedback not open',
        description: 'Please end the event first to open feedback collection.',
        variant: 'destructive',
      });
      return;
    }
    setSelectedEvent(event);
    setShowFeedbackQRDialog(true);
  };

  // Launch the Google Form QR modal so feedback links can be distributed.
  const handleGenerateGoogleFormQR = (event: Event) => {
    setSelectedEvent(event);
    setShowGoogleFormQRDialog(true);
  };

  // Fetch directory records grouped by school for bulk invitations.
  const loadDirectoryData = useCallback(async (role: DirectoryRole) => {
    setDirectoryLoading(true);
    try {
      const response = await apiService.getDirectory(role);
      setDirectoryData((prev) => ({
        ...prev,
        [role]: response.schools,
      }));
    } catch (error) {
      toast({
        title: 'Unable to load directory',
        description: error instanceof Error ? error.message : 'Please try again later.',
        variant: 'destructive'
      });
    } finally {
      setDirectoryLoading(false);
    }
  }, [toast]);

  // Reset selections when toggling between student/coordinator directories.
  const handleDirectoryRoleChange = useCallback(async (role: DirectoryRole) => {
    setDirectoryRole(role);
    setSelectedDirectoryMembers({});
    setInviteRole(role === 'coordinator' ? 'coordinator' : 'attendee');
    if (directoryData[role].length === 0) {
      await loadDirectoryData(role);
    }
  }, [directoryData, loadDirectoryData]);

  // Prepare the invitation dialog with existing invite summaries.
  const openInviteDialog = async (event: Event) => {
    setInviteEvent(event);
    setInviteEmails('');
    setInviteMessage('');
    setInviteDialogOpen(true);
    setInviteLoading(true);
    try {
      await handleDirectoryRoleChange('student');
      const invitations = await apiService.getEventInvitations(event.id);
      setInviteSummary(invitations);
    } catch (error) {
      toast({
        title: 'Unable to load invitations',
        description: error instanceof Error ? error.message : 'Please try again later.',
        variant: 'destructive'
      });
      setInviteSummary([]);
    } finally {
      setInviteLoading(false);
    }
  };

  // Send invitations to a mix of directory selections and manual emails.
  const handleSendInvites = async () => {
    if (!inviteEvent) return;
    const emails = inviteEmails.split(/[\n,;]+/).map((email) => email.trim()).filter(Boolean);
    const directoryInvitees = selectedDirectoryList.map((member) => ({
      userId: member.id,
      roleAtEvent: directoryRole === 'coordinator' ? 'coordinator' : 'attendee' as const,
      message: inviteMessage || undefined,
    }));
    const manualInvitees = emails.map((email) => ({
      email,
      roleAtEvent: inviteRole,
      message: inviteMessage || undefined,
    }));

    if (directoryInvitees.length === 0 && manualInvitees.length === 0) {
      toast({
        title: 'No invitees selected',
        description: 'Select a school/branch or provide email addresses before sending invites.',
        variant: 'destructive'
      });
      return;
    }

    const combinedInvitees = [...directoryInvitees, ...manualInvitees];
    const uniqueInvitees: { userId?: string; email?: string; roleAtEvent: 'coordinator' | 'attendee'; message?: string }[] = [];
    const seen = new Set<string>();
    for (const invitee of combinedInvitees) {
      const key = invitee.userId ? `user:${invitee.userId}` : invitee.email ? `email:${invitee.email.toLowerCase()}` : null;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      uniqueInvitees.push(invitee);
    }
    if (uniqueInvitees.length === 0) {
      toast({
        title: 'Invitees already added',
        description: 'Everyone you selected is already in the invite list.',
        variant: 'destructive'
      });
      return;
    }
    setInviteLoading(true);
    try {
      await apiService.inviteParticipants(inviteEvent.id, uniqueInvitees);
      toast({
        title: 'Invitations sent',
        description: `${uniqueInvitees.length} invitation${uniqueInvitees.length > 1 ? 's' : ''} dispatched.`,
      });
      const refreshed = await apiService.getEventInvitations(inviteEvent.id);
      setInviteSummary(refreshed);
      setInviteEmails('');
      setInviteMessage('');
      setSelectedDirectoryMembers({});
      loadData();
    } catch (error) {
      toast({
        title: 'Unable to send invitations',
        description: error instanceof Error ? error.message : 'Please try again later.',
        variant: 'destructive'
      });
    } finally {
      setInviteLoading(false);
    }
  };

  // Bulk-select whole departments at once when inviting.
  const addDepartmentMembers = useCallback((members: DirectoryMember[]) => {
    setSelectedDirectoryMembers((prev) => {
      const next = { ...prev } as Record<string, DirectoryMember>;
      members.forEach((member) => {
        if (member?.id) {
          next[member.id] = member;
        }
      });
      return next;
    });
  }, []);

  // Remove individuals from the invite staging list.
  const removeSelectedMember = useCallback((id: string) => {
    setSelectedDirectoryMembers((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev } as Record<string, DirectoryMember>;
      delete next[id];
      return next;
    });
  }, []);

  // Normalise controlled form inputs for the event creation drawer.
  const handleCreateFormChange = useCallback((field: keyof CoordinatorEventForm, value: string | boolean) => {
    setCreateForm((prev) => {
      if (field === 'school' && typeof value === 'string') {
        const nextBranches = getBranchesForSchool(value);
        return {
          ...prev,
          school: value,
          department: nextBranches[0] ?? '',
        };
      }
      if (field === 'allow_self_check_in' && typeof value === 'boolean') {
        return { ...prev, allow_self_check_in: value };
      }
      if (field === 'invitation_mode' && typeof value === 'string') {
        return { ...prev, invitation_mode: value as CoordinatorEventForm['invitation_mode'] };
      }
      return {
        ...prev,
        [field]: value,
      } as CoordinatorEventForm;
    });
  }, []);

  const handleSDGToggle = useCallback((goal: string) => {
    setCreateForm((prev) => {
      const current = prev.sdg || [];
      const updated = current.includes(goal)
        ? current.filter(g => g !== goal)
        : [...current, goal];
      return { ...prev, sdg: updated };
    });
  }, []);

  // Mirror signup validations for the participant creation form.
  const handleParticipantFormChange = useCallback((field: keyof ParticipantFormState, value: string) => {
    setParticipantForm((prev) => {
      if (field === 'school') {
        const nextBranches = getBranchesForSchool(value);
        return {
          ...prev,
          school: value,
          department: nextBranches[0] ?? '',
        };
      }
      if (field === 'accountType') {
        return { ...prev, accountType: value as ParticipantAccountType };
      }
      return { ...prev, [field]: value };
    });
  }, []);

  // Persist a new event draft and refresh the coordinator's assignments.
  const handleCreateEvent = useCallback(async () => {
    if (!createForm.title.trim() || !createForm.date || !createForm.time || !createForm.location.trim()) {
      toast({
        title: 'Missing details',
        description: 'Please provide the event title, date, time, and location.',
        variant: 'destructive',
      });
      return;
    }
    if (!createForm.school || !createForm.department) {
      toast({
        title: 'Choose school and branch',
        description: 'Select where this event belongs so students can find it.',
        variant: 'destructive',
      });
      return;
    }

    setCreateLoading(true);
    try {
      await apiService.createCoordinatorEvent({
        title: createForm.title.trim(),
        description: createForm.description.trim(),
        date: createForm.date,
        time: createForm.time,
        location: createForm.location.trim(),
        school: createForm.school,
        department: createForm.department,
        invitation_mode: createForm.invitation_mode,
        allow_self_check_in: createForm.allow_self_check_in,
        sdg: createForm.sdg,
        guest_speakers: createForm.guest_speakers.split('\n').filter(s => s.trim()),
      });
      toast({
        title: 'Event submitted for approval',
        description: 'The dean will review your request shortly.',
      });
      setCreateDialogOpen(false);
      setCreateForm((prev) => ({
        ...prev,
        title: '',
        description: '',
        date: '',
        time: '',
        location: '',
        invitation_mode: 'invite-only',
        allow_self_check_in: true,
        sdg: [],
        guest_speakers: '',
      }));
      loadData();
    } catch (error) {
      toast({
        title: 'Unable to create event',
        description: error instanceof Error ? error.message : 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setCreateLoading(false);
    }
  }, [createForm, loadData, toast]);

  const fetchEventOverview = useCallback(async (eventId: string) => {
    setOverviewLoading(true);
    try {
      const overview = await apiService.getEventOverview(eventId);
      setEventOverview(overview);
      setAttendanceData(overview.attendance);
      setSelectedEvent(overview.event);
    } catch (error) {
      setEventOverview(null);
      setAttendanceData([]);
      setAttendanceFallbackLoading(true);
      try {
        const { attendees } = await apiService.getEventAttendance(eventId);
        setAttendanceData(attendees);
      } catch (fallbackError) {
        toast({
          title: 'Unable to load event details',
          description: fallbackError instanceof Error ? fallbackError.message : 'Please try again later.',
          variant: 'destructive',
        });
      } finally {
        setAttendanceFallbackLoading(false);
      }
    } finally {
      setOverviewLoading(false);
    }
  }, [toast]);

  const handleOpenEventDetails = useCallback((event: Event) => {
    setSelectedEvent(event);
    setWorkspaceTab('attendance');
    setReportSummary('');
    setReportPhotos([]);
    setShowAttendanceDialog(true);
    fetchEventOverview(event.id);
  }, [fetchEventOverview]);

  const handleEndEvent = useCallback(async () => {
    if (!selectedEvent) return;
    setEndEventLoading(true);
    try {
      const overview = await apiService.endEvent(selectedEvent.id);
      setEventOverview(overview);
      setAttendanceData(overview.attendance);
      setSelectedEvent(overview.event);
      setWorkspaceTab('feedback');
      toast({
        title: 'Event ended',
        description: 'Attendance is closed and feedback is now open.',
      });
      loadData();
    } catch (error) {
      toast({
        title: 'Unable to end event',
        description: error instanceof Error ? error.message : 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setEndEventLoading(false);
    }
  }, [selectedEvent, toast, loadData]);

  const fileToBase64 = useCallback((file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  }), []);

  const handleReportFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;
    const limited = Array.from(files).slice(0, 3);
    try {
      const converted = await Promise.all(
        limited.map(async (file) => ({
          name: file.name,
          data: await fileToBase64(file),
        }))
      );
      setReportPhotos(converted);
    } catch (error) {
      toast({
        title: 'Unable to process images',
        description: error instanceof Error ? error.message : 'Please try again with different files.',
        variant: 'destructive',
      });
    }
  }, [fileToBase64, toast]);

  const handleGenerateReport = useCallback(async () => {
    if (!selectedEvent) return;
    if (!reportSummary.trim()) {
      toast({
        title: 'Add a summary',
        description: 'Please include a short Minutes of Meeting or recap before generating the PDF.',
        variant: 'destructive',
      });
      return;
    }
    setReportGenerating(true);
    try {
      const blob = await apiService.generateEventReport(selectedEvent.id, {
        summary: reportSummary.trim(),
        photos: reportPhotos.map((photo) => photo.data),
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${selectedEvent.title.replace(/\s+/g, '_')}_report.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({
        title: 'Report generated',
        description: 'Your PDF report is ready to share.',
      });
    } catch (error) {
      toast({
        title: 'Unable to generate report',
        description: error instanceof Error ? error.message : 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setReportGenerating(false);
    }
  }, [reportPhotos, reportSummary, selectedEvent, toast]);

  useEffect(() => {
    if (showAttendanceDialog && selectedEvent && !eventOverview && !overviewLoading) {
      fetchEventOverview(selectedEvent.id);
    }
  }, [eventOverview, fetchEventOverview, overviewLoading, selectedEvent, showAttendanceDialog]);

  const handleCreateParticipantAccount = useCallback(async () => {
    if (!selectedActiveEventId) {
      toast({
        title: 'Select an event',
        description: 'Choose an active event to attach this participant to.',
        variant: 'destructive',
      });
      return;
    }
    if (!participantForm.name.trim() || !participantForm.email.trim()) {
      toast({
        title: 'Missing details',
        description: 'Please provide the participant name and email.',
        variant: 'destructive',
      });
      return;
    }
    if (participantForm.password !== participantForm.confirmPassword) {
      toast({
        title: 'Password mismatch',
        description: 'Password and confirmation must match.',
        variant: 'destructive',
      });
      return;
    }
    if (participantForm.password.length < 6) {
      toast({
        title: 'Password too short',
        description: 'Password must be at least 6 characters long.',
        variant: 'destructive',
      });
      return;
    }
    if (!participantForm.school || !participantForm.department) {
      toast({
        title: 'School details required',
        description: 'Select a school and branch for the participant.',
        variant: 'destructive',
      });
      return;
    }
    if (!participantForm.registrationId.trim()) {
      toast({
        title: 'Registration ID required',
        description: 'Add the registration ID to keep attendance records clean.',
        variant: 'destructive',
      });
      return;
    }

    setParticipantSubmitting(true);
    try {
      const resolvedRole: 'student' | 'coordinator' = 'student';
      const created = await apiService.createParticipantAccount(selectedActiveEventId, {
        name: participantForm.name.trim(),
        email: participantForm.email.trim(),
        password: participantForm.password,
        role: resolvedRole,
        school: participantForm.school,
        department: participantForm.department,
        registrationId: participantForm.registrationId.trim(),
        phone: participantForm.phone.trim() || undefined,
      });
      const targetEvent = activeEvents.find((ev) => ev.id === selectedActiveEventId);
      toast({
        title: 'Participant created',
        description: `${created.name} can now log in and mark attendance for ${targetEvent?.title || 'the selected event'}.`,
      });
      setParticipantForm((prev) => ({
        ...prev,
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        registrationId: '',
      }));
      if (selectedEvent?.id === selectedActiveEventId) {
        fetchEventOverview(selectedActiveEventId);
      }
      loadData();
    } catch (error) {
      toast({
        title: 'Unable to create participant',
        description: error instanceof Error ? error.message : 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setParticipantSubmitting(false);
    }
  }, [activeEvents, fetchEventOverview, loadData, participantForm, selectedActiveEventId, selectedEvent, toast]);

  const statsDisplay = [
    { label: 'Assigned Events', value: stats.assignedEvents, icon: CalendarDays, color: 'bg-primary' },
    { label: 'Total Attendees', value: stats.totalAttendees, icon: Users, color: 'bg-success' },
    { label: 'Pending Approvals', value: assignedEvents.filter((event) => event.approval_status !== 'approved').length, icon: Clock, color: 'bg-warning' }
  ];

  const renderDirectory = () => (
    <ScrollArea className="max-h-64 rounded-md border bg-background/60 p-2">
      {directoryLoading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading {directoryRole === 'coordinator' ? 'coordinators' : 'students'}...
        </div>
      ) : directorySchools.length === 0 ? (
        <div className="py-6 text-center text-sm text-muted-foreground">
          No {directoryRole === 'coordinator' ? 'coordinators' : 'students'} found in the directory.
        </div>
      ) : (
        <div className="space-y-3">
          {directorySchools.map((school) => {
            const schoolMembers = school.departments.flatMap((dept) => dept.members ?? []);
            const hasMembers = schoolMembers.length > 0;
            return (
              <div key={`${directoryRole}-${school.school}`} className="rounded-lg border bg-background p-3 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium leading-tight">{school.school}</p>
                      <p className="text-xs text-muted-foreground">
                        {school.totalMembers} {directoryRole === 'coordinator' ? 'coordinator' : 'student'}{school.totalMembers === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!hasMembers}
                    onClick={() => addDepartmentMembers(schoolMembers)}
                    className="shrink-0"
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    Add school
                  </Button>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {school.departments.map((dept) => (
                    <button
                      key={`${school.school}-${dept.department}`}
                      type="button"
                      onClick={() => addDepartmentMembers(dept.members ?? [])}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted px-3 py-2 text-left transition-colors hover:bg-muted/80"
                      disabled={dept.count === 0}
                    >
                      <div className="flex items-center gap-2">
                        <GraduationCap className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{dept.department}</span>
                      </div>
                      <Badge variant="outline">{dept.count}</Badge>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ScrollArea>
  );

  return (
    <Layout title="Coordinator Dashboard">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Coordinator Dashboard</h1>
          <p className="text-muted-foreground">Manage your assigned events</p>
        </div>

        {assignedEvents.some((event) => event.approval_status !== 'approved') && (
          <Card className="border-warning/40 bg-warning/10">
            <CardContent className="py-4 flex flex-col gap-3 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
              <div className="space-y-1">
                <p className="font-semibold text-warning-foreground">Approval in progress</p>
                <p className="text-sm text-muted-foreground">
                  QR codes and attendance tools unlock once the dean team approves your event.
                </p>
              </div>
              <Badge variant="outline" className="mx-auto uppercase tracking-wide sm:mx-0">
                {assignedEvents.filter((event) => event.approval_status !== 'approved').length} pending
              </Badge>
            </CardContent>
          </Card>
        )}

        {activeEvents.length > 0 ? (
          <Card className="border-primary/30 shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2 text-lg">
                Create New Participant Account
                <Badge variant="secondary" className="uppercase">
                  Live events only
                </Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Mirror the signup form to quickly onboard attendees while an event is active.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Attach to Event</Label>
                  <Select value={selectedActiveEventId} onValueChange={setSelectedActiveEventId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an active event" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeEvents.map((event) => (
                        <SelectItem key={event.id} value={event.id}>
                          {event.title} — {formatLocalDateTime(event.date, (event as { time?: string }).time)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="participantName">Full Name</Label>
                  <Input
                    id="participantName"
                    value={participantForm.name}
                    onChange={(e) => handleParticipantFormChange('name', e.target.value)}
                    placeholder="Enter full name"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="participantEmail">Email Address</Label>
                  <Input
                    id="participantEmail"
                    type="email"
                    value={participantForm.email}
                    onChange={(e) => handleParticipantFormChange('email', e.target.value)}
                    placeholder="name@example.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="registrationId">Registration ID</Label>
                  <Input
                    id="registrationId"
                    value={participantForm.registrationId}
                    onChange={(e) => handleParticipantFormChange('registrationId', e.target.value)}
                    placeholder="Unique registration ID"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Account Type</Label>
                  <Select value={participantForm.accountType} onValueChange={(value) => handleParticipantFormChange('accountType', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="participant">Participant</SelectItem>
                      <SelectItem value="student">Student</SelectItem>
                      <SelectItem value="attendee">Attendee</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="participantPhone">Phone Number (optional)</Label>
                  <Input
                    id="participantPhone"
                    value={participantForm.phone}
                    onChange={(e) => handleParticipantFormChange('phone', e.target.value)}
                    placeholder="+91 98765 43210"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="participantPassword">Password</Label>
                  <Input
                    id="participantPassword"
                    type="password"
                    value={participantForm.password}
                    onChange={(e) => handleParticipantFormChange('password', e.target.value)}
                    placeholder="Create a password"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="participantConfirmPassword">Confirm Password</Label>
                  <Input
                    id="participantConfirmPassword"
                    type="password"
                    value={participantForm.confirmPassword}
                    onChange={(e) => handleParticipantFormChange('confirmPassword', e.target.value)}
                    placeholder="Confirm password"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>School</Label>
                  <Select value={participantForm.school} onValueChange={(value) => handleParticipantFormChange('school', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select school" />
                    </SelectTrigger>
                    <SelectContent>
                      {schoolOptions.map((school) => (
                        <SelectItem key={school} value={school}>
                          {school}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Branch / Department</Label>
                  <Select value={participantForm.department} onValueChange={(value) => handleParticipantFormChange('department', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {participantBranchOptions.map((branch) => (
                        <SelectItem key={branch} value={branch}>
                          {branch}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  New users are added to the event roster immediately so they can scan the attendance QR.
                </p>
                <Button onClick={handleCreateParticipantAccount} disabled={participantSubmitting} className="gap-2 w-full sm:w-auto">
                  {participantSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create Participant
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed border-muted-foreground/50 bg-muted/40">
            <CardContent className="p-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="font-semibold">Participant onboarding is locked</p>
                <p className="text-sm text-muted-foreground">
                  This panel appears when at least one approved event is ongoing.
                </p>
              </div>
              <Badge variant="outline">No active events</Badge>
            </CardContent>
          </Card>
        )}

        {/* Google Form CTA Section */}
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-4 text-center sm:flex-row sm:items-center sm:text-left">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto sm:mx-0">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-blue-900">Create Interactive Events</h3>
                  <p className="text-blue-700 text-sm">
                    Generate QR codes for Google Forms to collect feedback and registrations from attendees
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-blue-300 text-blue-700 hover:bg-blue-100 sm:w-auto"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Learn More
                </Button>
                <Button
                  size="sm"
                  className="w-full bg-blue-600 hover:bg-blue-700 sm:w-auto"
                  onClick={() => setCreateDialogOpen(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Event
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {statsDisplay.map((stat) => (
            <Card key={stat.label} className="bg-gradient-card shadow-card border-0">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-lg ${stat.color} flex items-center justify-center`}>
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="bg-gradient-card shadow-card border-0">
          <CardHeader>
            <CardTitle>Your Assigned Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {assignedEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onViewDetails={() => handleOpenEventDetails(event)}
                  onGenerateQR={() => handleGenerateQR(event)}
                  onGenerateGoogleFormQR={() => handleGenerateGoogleFormQR(event)}
                  onViewAttendance={() => handleOpenEventDetails(event)}
                  onManageInvites={() => openInviteDialog(event)}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <Dialog
          open={createDialogOpen}
          onOpenChange={(open) => {
            setCreateDialogOpen(open);
            if (!open) {
              setCreateLoading(false);
              setCreateForm((prev) => ({
                ...prev,
                title: '',
                description: '',
                date: '',
                time: '',
                location: '',
                invitation_mode: 'invite-only',
                allow_self_check_in: true,
                sdg: [],
                guest_speakers: '',
              }));
            }
          }}
        >
          <DialogContent className="w-full max-w-3xl">
            <DialogHeader>
              <DialogTitle>Create a new event</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Draft your event details and send them to the dean for approval.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="eventTitle">Event Title</Label>
                  <Input
                    id="eventTitle"
                    value={createForm.title}
                    onChange={(e) => handleCreateFormChange('title', e.target.value)}
                    placeholder="AI & Emerging Tech Summit"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eventLocation">Location</Label>
                  <Input
                    id="eventLocation"
                    value={createForm.location}
                    onChange={(e) => handleCreateFormChange('location', e.target.value)}
                    placeholder="Main Auditorium"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eventDate">Date</Label>
                  <Input
                    id="eventDate"
                    type="date"
                    value={createForm.date}
                    onChange={(e) => handleCreateFormChange('date', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eventTime">Time</Label>
                  <Input
                    id="eventTime"
                    type="time"
                    value={createForm.time}
                    onChange={(e) => handleCreateFormChange('time', e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="eventDescription">Description</Label>
                <Textarea
                  id="eventDescription"
                  value={createForm.description}
                  onChange={(e) => handleCreateFormChange('description', e.target.value)}
                  placeholder="Share a short overview, agenda highlights, or special guests."
                  rows={3}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>School</Label>
                  <Select value={createForm.school} onValueChange={(value) => handleCreateFormChange('school', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select school" />
                    </SelectTrigger>
                    <SelectContent>
                      {schoolOptions.map((school) => (
                        <SelectItem key={school} value={school}>
                          {school}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Branch / Department</Label>
                  <Select value={createForm.department} onValueChange={(value) => handleCreateFormChange('department', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {createBranchOptions.map((branch) => (
                        <SelectItem key={branch} value={branch}>
                          {branch}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Sustainable Development Goals (SDGs)</Label>
                <ScrollArea className="h-32 rounded-md border p-2">
                  <div className="space-y-2">
                    {SDG_GOALS.map((goal) => (
                      <div key={goal} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={`sdg-${goal}`}
                          checked={createForm.sdg?.includes(goal)}
                          onChange={() => handleSDGToggle(goal)}
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <label
                          htmlFor={`sdg-${goal}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {goal}
                        </label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              <div className="space-y-2">
                <Label htmlFor="guestSpeakers">Guest Speakers</Label>
                <Textarea
                  id="guestSpeakers"
                  value={createForm.guest_speakers}
                  onChange={(e) => handleCreateFormChange('guest_speakers', e.target.value)}
                  placeholder="Enter guest speakers (one per line)"
                  rows={3}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Invitation Mode</Label>
                  <Select
                    value={createForm.invitation_mode}
                    onValueChange={(value: 'invite-only' | 'open') => handleCreateFormChange('invitation_mode', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="invite-only">Invite only</SelectItem>
                      <SelectItem value="open">Open to all</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="flex flex-wrap items-center justify-between gap-2 text-sm font-medium">
                    Allow self check-in
                    <Switch
                      checked={createForm.allow_self_check_in}
                      onCheckedChange={(checked) => handleCreateFormChange('allow_self_check_in', checked)}
                    />
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    When disabled, only coordinators can mark attendance for attendees.
                  </p>
                </div>
              </div>
            </div>
            <DialogFooter className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button onClick={handleCreateEvent} disabled={createLoading} className="gap-2 w-full sm:w-auto">
                {createLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                Submit for Approval
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* QR Code Dialog */}
        <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
          <DialogContent className="w-full max-w-md sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>QR Code Generator</DialogTitle>
              <DialogDescription>
                Generate a QR code for event check-in.
              </DialogDescription>
            </DialogHeader>
            {selectedEvent && (
              <QRCodeGenerator
                eventId={selectedEvent.id}
                eventTitle={selectedEvent.title}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Feedback QR Code Dialog */}
        <Dialog open={showFeedbackQRDialog} onOpenChange={setShowFeedbackQRDialog}>
          <DialogContent className="w-full max-w-md sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Feedback QR Code Generator</DialogTitle>
              <DialogDescription>
                Generate a QR code for collecting event feedback.
              </DialogDescription>
            </DialogHeader>
            {selectedEvent && (
              <FeedbackQRCodeGenerator
                eventId={selectedEvent.id}
                eventTitle={selectedEvent.title}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Google Form QR Code Dialog */}
        <Dialog open={showGoogleFormQRDialog} onOpenChange={setShowGoogleFormQRDialog}>
          <DialogContent className="w-full max-w-2xl">
            <DialogHeader>
              <DialogTitle>Google Form QR Code Generator</DialogTitle>
              <DialogDescription>
                Generate a QR code for a Google Form.
              </DialogDescription>
            </DialogHeader>
            {selectedEvent && (
              <GoogleFormQRGenerator
                eventId={selectedEvent.id}
                eventTitle={selectedEvent.title}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Attendance Dialog */}
        <Dialog
          open={showAttendanceDialog}
          onOpenChange={(open) => {
            setShowAttendanceDialog(open);
            if (!open) {
              if (!showQRDialog && !showGoogleFormQRDialog) {
                setSelectedEvent(null);
              }
              setAttendanceData([]);
              setEventOverview(null);
              setReportSummary('');
              setReportPhotos([]);
              setWorkspaceTab('attendance');
            }
          }}
        >
          <DialogContent className="w-full max-w-5xl">
            <DialogHeader>
              <DialogTitle>Event Tools</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Attendance, QR tools, and feedback insights are read-only for coordinators.
              </DialogDescription>
            </DialogHeader>
            {selectedEvent ? (
              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold leading-tight">{selectedEvent.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {formatLocalDateTime(selectedEvent.date, (selectedEvent as { time?: string }).time)} • {selectedEvent.location}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary" className="capitalize">{selectedEvent.status}</Badge>
                      <Badge variant="outline" className="capitalize">{selectedEvent.approval_status}</Badge>
                      {selectedEvent.feedback_open && <Badge variant="secondary">Feedback open</Badge>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => fetchEventOverview(selectedEvent.id)} disabled={overviewLoading}>
                      {overviewLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      <RefreshCcw className="h-4 w-4 mr-1" />
                      Refresh
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => handleGenerateQR(selectedEvent)}>
                      <QrCode className="h-4 w-4 mr-1" />
                      Show Attendance QR
                    </Button>
                    {selectedEvent.feedback_open && (
                      <Button variant="secondary" size="sm" onClick={() => handleGenerateFeedbackQR(selectedEvent)}>
                        <Star className="h-4 w-4 mr-1" />
                        Show Feedback QR
                      </Button>
                    )}
                    {selectedEvent.status !== 'completed' && (
                      <Button variant="destructive" size="sm" onClick={handleEndEvent} disabled={endEventLoading || overviewLoading}>
                        {endEventLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        <AlertTriangle className="h-4 w-4 mr-1" />
                        End Event
                      </Button>
                    )}
                  </div>
                </div>

                <Tabs value={workspaceTab} onValueChange={(value) => setWorkspaceTab(value as 'attendance' | 'feedback' | 'report')}>
                  <TabsList className="grid w-full grid-cols-2 md:w-auto md:inline-flex">
                    <TabsTrigger value="attendance">Attendance</TabsTrigger>
                    <TabsTrigger value="feedback">Feedback</TabsTrigger>
                    {selectedEvent.status === 'completed' && (
                      <TabsTrigger value="report">Generate Report</TabsTrigger>
                    )}
                  </TabsList>

                  <TabsContent value="attendance" className="space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>Live roster (read-only)</span>
                      </div>
                      <Badge variant="secondary" className="w-fit">
                        {attendanceData.length} attendee{attendanceData.length === 1 ? '' : 's'}
                      </Badge>
                    </div>
                    <div className="rounded-lg border bg-muted/40">
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
                        <span>Reg. ID</span>
                        <span>Name</span>
                        <span className="hidden sm:block">Email</span>
                        <span>Signature</span>
                        <span className="hidden sm:block">Timestamp</span>
                      </div>
                      <ScrollArea className="max-h-72">
                        <div className="divide-y">
                          {(overviewLoading || attendanceFallbackLoading) && attendanceData.length === 0 && (
                            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Loading attendance...
                            </div>
                          )}
                          {attendanceData.map((attendee) => {
                            const signatureSrc = attendee.signature
                              ? (attendee.signature.startsWith('data:')
                                ? attendee.signature
                                : `data:image/svg+xml;utf8,${encodeURIComponent(attendee.signature)}`)
                              : null;
                            return (
                              <div key={`${attendee.user_id}-${attendee.timestamp || 'na'}`} className="grid grid-cols-2 sm:grid-cols-5 gap-2 px-3 py-3 text-sm">
                                <span className="font-mono text-xs">{attendee.registration_id || '—'}</span>
                                <div className="space-y-0.5">
                                  <p className="font-medium leading-tight">{attendee.name}</p>
                                  <p className="text-xs text-muted-foreground sm:hidden break-all">{attendee.email}</p>
                                </div>
                                <p className="hidden sm:block text-xs break-all text-muted-foreground">{attendee.email}</p>
                                <div className="flex items-center">
                                  {signatureSrc ? (
                                    <img src={signatureSrc} alt="Signature" className="h-8 max-w-[120px] object-contain" />
                                  ) : (
                                    <span className="text-xs text-muted-foreground">Not captured</span>
                                  )}
                                </div>
                                <span className="hidden sm:block text-xs text-muted-foreground">
                                  {attendee.timestamp ? new Date(attendee.timestamp).toLocaleString() : '—'}
                                </span>
                              </div>
                            );
                          })}
                          {!overviewLoading && attendanceData.length === 0 && (
                            <div className="py-8 text-center text-sm text-muted-foreground">
                              No attendance records yet.
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  </TabsContent>

                  <TabsContent value="feedback" className="space-y-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-3">
                        <div className="rounded-full bg-secondary px-3 py-2 text-center">
                          <p className="text-2xl font-bold">
                            {eventOverview?.feedback.averageRating?.toFixed?.(1) ?? '—'}
                          </p>
                          <p className="text-xs text-muted-foreground">avg rating</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">
                            {eventOverview?.feedback.total ?? 0} response{(eventOverview?.feedback.total ?? 0) === 1 ? '' : 's'}
                          </p>
                          {selectedEvent.status !== 'completed' && (
                            <p className="text-xs text-muted-foreground">
                              End the event to start the feedback flow.
                            </p>
                          )}
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => fetchEventOverview(selectedEvent.id)} disabled={overviewLoading}>
                        <RefreshCcw className="h-4 w-4 mr-1" />
                        Refresh feedback
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {(eventOverview?.feedback.entries || []).map((fb) => (
                        <div key={fb.id} className="rounded-lg border bg-background/80 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="font-medium">{fb.user?.name || 'Anonymous'}</p>
                              <p className="text-xs text-muted-foreground">{fb.user?.email}</p>
                            </div>
                            <div className="flex items-center gap-1">
                              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                              <span className="text-sm font-semibold">{fb.rating}/5</span>
                            </div>
                          </div>
                          {fb.comments && (
                            <p className="mt-2 text-sm text-muted-foreground">“{fb.comments}”</p>
                          )}
                        </div>
                      ))}
                      {(eventOverview?.feedback.entries || []).length === 0 && (
                        <p className="text-sm text-muted-foreground">No feedback submitted yet.</p>
                      )}
                    </div>
                  </TabsContent>

                  {selectedEvent.status === 'completed' && (
                    <TabsContent value="report" className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="reportSummary">Minutes of Meeting / Summary</Label>
                        <Textarea
                          id="reportSummary"
                          value={reportSummary}
                          onChange={(e) => setReportSummary(e.target.value)}
                          placeholder="Add key discussion points, decisions, and outcomes."
                          rows={4}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="reportPhotos">Upload 2–3 event photos</Label>
                        <Input
                          id="reportPhotos"
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(e) => handleReportFiles(e.target.files)}
                        />
                        {reportPhotos.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {reportPhotos.map((photo) => (
                              <Badge key={photo.name} variant="secondary" className="flex items-center gap-1">
                                <ImageIcon className="h-3 w-3" />
                                {photo.name}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">Images are embedded directly into the PDF.</p>
                      </div>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-muted-foreground">Attendance list and feedback are auto-attached.</p>
                        <Button onClick={handleGenerateReport} disabled={reportGenerating} className="gap-2 w-full sm:w-auto">
                          {reportGenerating && <Loader2 className="h-4 w-4 animate-spin" />}
                          <Download className="h-4 w-4" />
                          Generate PDF
                        </Button>
                      </div>
                    </TabsContent>
                  )}
                </Tabs>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Select an event to view tools.</p>
            )}
          </DialogContent>
        </Dialog>

        {/* Invite Participants Dialog */}
        <Dialog
          open={inviteDialogOpen}
          onOpenChange={(open) => {
            setInviteDialogOpen(open);
            if (!open) {
              setInviteEvent(null);
              setInviteSummary([]);
              setInviteEmails('');
              setInviteMessage('');
              setSelectedDirectoryMembers({});
              setDirectoryRole('student');
              setInviteRole('attendee');
            }
          }}
        >
          <DialogContent className="w-full max-w-3xl">
            <DialogHeader>
              <DialogTitle>Invite Participants</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Send invites to coordinators or attendees for this event.
              </DialogDescription>
            </DialogHeader>
            {inviteEvent ? (
              <div className="space-y-5">
                <div className="rounded-lg border bg-muted/50 p-4">
                  <p className="font-semibold">{inviteEvent.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatLocalDateTime(inviteEvent.date, (inviteEvent as { time?: string }).time)} • {inviteEvent.location}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Approval status: <span className="font-medium capitalize">{inviteEvent.approval_status}</span>
                  </p>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Invite Type</Label>
                  <div className="flex flex-col gap-3 rounded-lg border bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-col gap-3 text-center sm:flex-row sm:items-center sm:text-left">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        {directoryRole === 'coordinator' ? (
                          <Users className="h-5 w-5 text-primary" />
                        ) : (
                          <GraduationCap className="h-5 w-5 text-primary" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium leading-tight">
                          {directoryRole === 'coordinator'
                            ? 'Invite fellow coordinators to co-host your event'
                            : 'Invite students by selecting their school and branch'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Switch tabs below to change between students and coordinators.
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="w-fit">
                      {directoryRole === 'coordinator' ? 'Co-coordinator' : 'Attendee'}
                    </Badge>
                  </div>
                </div>

                <Tabs value={directoryRole} onValueChange={(value) => handleDirectoryRoleChange(value as DirectoryRole)}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="student">Students</TabsTrigger>
                    <TabsTrigger value="coordinator">Coordinators</TabsTrigger>
                  </TabsList>
                  <TabsContent value="student" className="mt-3">
                    {renderDirectory()}
                  </TabsContent>
                  <TabsContent value="coordinator" className="mt-3">
                    {renderDirectory()}
                  </TabsContent>
                </Tabs>

                {selectedDirectoryList.length > 0 && (
                  <div className="space-y-2">
                    <Label>Selected from directory</Label>
                    <div className="flex flex-wrap gap-2">
                      {selectedDirectoryList.map((member) => (
                        <Badge key={member.id} variant="secondary" className="flex items-center gap-1">
                          <span>{member.name}</span>
                          <button
                            type="button"
                            onClick={() => removeSelectedMember(member.id)}
                            className="rounded-full p-0.5 hover:bg-secondary-foreground/10"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Email addresses (optional)</Label>
                  <Textarea
                    value={inviteEmails}
                    onChange={(e) => setInviteEmails(e.target.value)}
                    placeholder="someone@example.com\nanother@example.com"
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use this field to invite people who are not yet in the directory.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Message (optional)</Label>
                  <Textarea
                    value={inviteMessage}
                    onChange={(e) => setInviteMessage(e.target.value)}
                    placeholder="Add a note that will be included in the invite email"
                    rows={3}
                  />
                </div>

                <DialogFooter className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setInviteDialogOpen(false);
                      setInviteEvent(null);
                    }}
                    className="w-full sm:w-auto"
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleSendInvites} disabled={inviteLoading} className="gap-2 w-full sm:w-auto">
                    {inviteLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {pendingInviteCount > 0
                      ? `Send ${pendingInviteCount} invite${pendingInviteCount > 1 ? 's' : ''}`
                      : 'Send Invites'}
                  </Button>
                </DialogFooter>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Existing invitations</h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    {inviteSummary.map((invitation) => (
                      <div key={invitation.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-center sm:text-left">
                          <p className="font-medium">{invitation.invitee.name}</p>
                          <p className="text-xs text-muted-foreground">{invitation.invitee.email}</p>
                        </div>
                        <div className="text-center sm:text-right">
                          <Badge variant={invitation.status === 'accepted' ? 'secondary' : invitation.status === 'pending' ? 'outline' : 'destructive'}>
                            {invitation.status.charAt(0).toUpperCase() + invitation.status.slice(1)}
                          </Badge>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {invitation.role_at_event === 'coordinator' ? 'Co-coordinator' : 'Attendee'}
                          </p>
                        </div>
                      </div>
                    ))}
                    {inviteSummary.length === 0 && !inviteLoading && (
                      <p className="text-sm text-muted-foreground">No invitations yet for this event.</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Select an event to manage invitations.</p>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
