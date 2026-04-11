// Coordinator dashboard for managing events, attendance, and invitations.
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { EventCard } from '@/components/EventCard';
import { QRCodeGenerator } from '@/components/QRCodeGenerator';
import { FeedbackQRCodeGenerator } from '@/components/FeedbackQRCodeGenerator';
import { GoogleFormQRGenerator } from '@/components/GoogleFormQRGenerator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { EventCreationDialog } from '@/components/EventCreationDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { CalendarDays, Users, QrCode, Plus, FileText, Sparkles, UserPlus, Loader2, Clock, Building2, GraduationCap, X, Check, RefreshCcw, Download, Star, AlertTriangle, Trash2, Image as ImageIcon } from 'lucide-react';
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
  startDate: string;
  endDate: string;
  time: string;
  location: string;
  school: string;
  department: string;
  invitation_mode: 'invite-only' | 'open';
  sdg: string[];
  guest_speakers: string;
  category: string;
  isMultiDay: boolean;
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
  const [myInvitations, setMyInvitations] = useState<EventInvitation[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);
  const formatLocalDateTime = useCallback((dateStr?: string, timeStr?: string) => {
    if (!dateStr) return '';
    const dateTime = timeStr ? `${dateStr}T${timeStr}` : `${dateStr}T00:00`;
    const parsed = new Date(dateTime);
    if (Number.isNaN(parsed.getTime())) return dateStr;
    return parsed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }, []);
  const coordinatorSchool = user?.school || DEFAULT_SCHOOL;
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
    const branches = getBranchesForSchool(user?.school || DEFAULT_SCHOOL);
    return branches.length > 0 ? branches : ['General'];
  }, [user?.school]);
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

  const loadData = useCallback(async () => {
    if (!user) return;

    try {
      const [eventsData, statsData, invitationsData] = await Promise.all([
        apiService.getEventsByCoordinator(user.id),
        apiService.getCoordinatorStats(user.id),
        apiService.getMyInvitations()
      ]);
      setAssignedEvents(eventsData);
      setStats(statsData);
      setMyInvitations(invitationsData.filter(inv => inv.status === 'pending'));
    } catch (error) {
      console.error('Failed to load coordinator data:', error);
    }
  }, [user]);

  // Success callback for the unified event creation dialog.
  const handleCreateEventSuccess = useCallback(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, loadData]);


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
      roleAtEvent: (directoryRole === 'coordinator' ? 'coordinator' : 'attendee') as 'coordinator' | 'attendee',
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
      let key: string | null = null;
      if ('userId' in invitee) {
        key = `user:${invitee.userId}`;
      } else if ('email' in invitee) {
        key = `email:${invitee.email.toLowerCase()}`;
      }

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

  const handleCancelEvent = useCallback(async (event: Event) => {
    if (!window.confirm(`Are you sure you want to cancel "${event.title}"? This will stop attendance and hide the event.`)) return;
    try {
      await apiService.cancelEvent(event.id);
      toast({
        title: 'Event cancelled',
        description: `"${event.title}" has been cancelled.`,
      });
      loadData();
    } catch (error) {
      toast({
        title: 'Unable to cancel event',
        description: error instanceof Error ? error.message : 'Please try again later.',
        variant: 'destructive',
      });
    }
  }, [toast, loadData]);

  const handleDeleteEvent = useCallback(async (event: Event) => {
    if (!window.confirm(`Permanently delete "${event.title}"? This cannot be undone.`)) return;
    try {
      await apiService.deleteEvent(event.id);
      toast({
        title: 'Event deleted',
        description: `"${event.title}" has been permanently removed.`,
      });
      loadData();
    } catch (error) {
      toast({
        title: 'Unable to delete event',
        description: error instanceof Error ? error.message : 'Please try again later.',
        variant: 'destructive',
      });
    }
  }, [toast, loadData]);

  const [closeAttendanceLoading, setCloseAttendanceLoading] = useState(false);

  const handleCloseAttendance = useCallback(async () => {
    if (!selectedEvent) return;
    setCloseAttendanceLoading(true);
    try {
      await apiService.closeAttendance(selectedEvent.id);
      toast({
        title: 'Attendance closed',
        description: 'Students can no longer mark attendance for this event.',
      });
      loadData();
      fetchEventOverview(selectedEvent.id);
    } catch (error) {
      toast({
        title: 'Unable to close attendance',
        description: error instanceof Error ? error.message : 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setCloseAttendanceLoading(false);
    }
  }, [selectedEvent, toast, loadData, fetchEventOverview]);

  const handleReopenAttendance = useCallback(async () => {
    if (!selectedEvent) return;
    setCloseAttendanceLoading(true);
    try {
      await apiService.reopenAttendance(selectedEvent.id);
      toast({
        title: 'Attendance reopened',
        description: 'Students can now mark attendance again.',
      });
      loadData();
      fetchEventOverview(selectedEvent.id);
    } catch (error) {
      toast({
        title: 'Unable to reopen attendance',
        description: error instanceof Error ? error.message : 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setCloseAttendanceLoading(false);
    }
  }, [selectedEvent, toast, loadData, fetchEventOverview]);

  const fileToBase64 = useCallback((file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  }), []);

  const handleReportFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;
    const limited = Array.from(files).slice(0, 5);
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

  const handleRespondToInvitation = useCallback(async (invitationId: string, status: 'accepted' | 'declined') => {
    setInvitationsLoading(true);
    try {
      await apiService.respondToInvitation(invitationId, status);
      toast({
        title: status === 'accepted' ? 'Invitation accepted' : 'Invitation declined',
        description: status === 'accepted' ? 'You are now a manager for this event.' : 'The invitation has been removed.',
      });
      loadData();
    } catch (error) {
      toast({
        title: 'Error responding to invitation',
        description: error instanceof Error ? error.message : 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setInvitationsLoading(false);
    }
  }, [loadData, toast]);

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
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Coordinator Dashboard</h1>
            <p className="text-muted-foreground">Manage your assigned events</p>
          </div>
          <Button className="gap-2 self-start" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4" />
            Create Event
          </Button>
        </div>

        {/* Hero banner with stats */}
        <div className="relative overflow-hidden rounded-2xl p-6 sm:p-8" style={{ background: 'var(--gradient-primary)' }}>
          <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-white space-y-1">
              <p className="text-sm font-medium opacity-80 uppercase tracking-wider">Your workspace</p>
              <h2 className="text-2xl sm:text-3xl font-bold">{user?.name?.split(' ')[0] ?? 'Coordinator'}</h2>
              <p className="text-sm opacity-75">{user?.school || 'UniPal MIT'}{user?.department ? ' · ' + user.department : ''}</p>
            </div>
            <div className="flex gap-6 text-white">
              <div className="text-center">
                <p className="text-3xl font-bold">{stats.assignedEvents}</p>
                <p className="text-xs opacity-75 mt-1">Assigned</p>
              </div>
              <div className="w-px bg-white/20" />
              <div className="text-center">
                <p className="text-3xl font-bold">{activeEvents.length}</p>
                <p className="text-xs opacity-75 mt-1">Active</p>
              </div>
              <div className="w-px bg-white/20" />
              <div className="text-center">
                <p className="text-3xl font-bold">{assignedEvents.filter(e => e.approval_status !== 'approved').length}</p>
                <p className="text-xs opacity-75 mt-1">Pending</p>
              </div>
            </div>
          </div>
          <div className="absolute -top-8 -right-8 w-48 h-48 rounded-full opacity-10" style={{ background: 'hsl(var(--university-gold))' }} />
          <div className="absolute -bottom-12 -left-8 w-56 h-56 rounded-full opacity-10" style={{ background: 'hsl(var(--primary))' }} />
        </div>

        {assignedEvents.some((event) => event.approval_status !== 'approved') && (
          <div className="flex items-center gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3">
            <Clock className="h-4 w-4 text-warning-foreground shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-warning-foreground">Approval in progress</p>
              <p className="text-xs text-muted-foreground">QR codes and attendance tools unlock once the dean team approves your event.</p>
            </div>
            <Badge variant="outline" className="uppercase tracking-wide shrink-0">
              {assignedEvents.filter((event) => event.approval_status !== 'approved').length} pending
            </Badge>
          </div>
        )}

        {/* Pending Invitations Section */}
        {myInvitations.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Pending Invitations
              </h2>
              <Badge className="bg-primary/20 text-primary border-primary/30">{myInvitations.length} new</Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {myInvitations.map((inv) => (
                <div key={inv.id} className="relative group rounded-2xl border bg-card transition-all hover:shadow-md overflow-hidden p-4">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <p className="text-[10px] text-primary font-bold uppercase tracking-wider">Invitation Received</p>
                        <h3 className="font-bold text-sm leading-tight group-hover:text-primary transition-colors">{inv.event_name || 'Event Invitation'}</h3>
                      </div>
                      <Badge variant="outline" className="capitalize text-[10px]">{inv.role_at_event}</Badge>
                    </div>
                    
                    <div className="space-y-1.5 py-1 border-y border-dashed border-border/50">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CalendarDays className="w-3.5 h-3.5" />
                        <span>Invitation from {inv.invited_by?.name || 'a colleague'}</span>
                      </div>
                      {inv.message && (
                        <p className="text-[11px] italic text-muted-foreground line-clamp-2">"{inv.message}"</p>
                      )}
                    </div>
                    
                    <div className="flex gap-2 pt-1">
                      <Button 
                        size="sm" 
                        className="flex-1 h-9 gap-2 rounded-xl"
                        onClick={() => handleRespondToInvitation(inv.id, 'accepted')}
                        disabled={invitationsLoading}
                      >
                        {invitationsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        Accept
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1 h-9 gap-2 rounded-xl"
                        onClick={() => handleRespondToInvitation(inv.id, 'declined')}
                        disabled={invitationsLoading}
                      >
                        {invitationsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                        Decline
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Events list with per-event analytics */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Your Assigned Events</h2>
            <Badge variant="secondary">{assignedEvents.filter(e => e.status !== 'cancelled').length} active</Badge>
          </div>

          {assignedEvents.filter((e) => e.status !== 'cancelled').length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/30 py-16 text-center">
              <CalendarDays className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="font-medium text-muted-foreground">No active events assigned to you</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Create a new event to get started</p>
            </div>
          )}

          <div className="space-y-3">
            {assignedEvents.filter((e) => e.status !== 'cancelled').map((event) => {
              const eventDate = new Date(event.date);
              const daysUntil = Math.ceil((eventDate.getTime() - Date.now()) / 86400000);
              const statusColors: Record<string, string> = {
                ongoing: 'bg-success/10 text-success border-success/20',
                scheduled: 'bg-primary/10 text-primary border-primary/20',
                completed: 'bg-muted text-muted-foreground border-border',
                draft: 'bg-warning/10 text-warning-foreground border-warning/20',
              };
              const approvalColors: Record<string, string> = {
                approved: 'text-success',
                pending: 'text-warning-foreground',
                rejected: 'text-destructive',
                draft: 'text-muted-foreground',
              };
              return (
                <div key={event.id} className="rounded-2xl border bg-card shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                  <div className="h-1" style={{ background: event.status === 'ongoing' ? 'var(--gradient-accent)' : 'var(--gradient-primary)' }} />
                  <div className="p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      {/* Left: Info */}
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold leading-tight">{event.title}</p>
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${statusColors[event.status] ?? 'bg-muted text-muted-foreground'}`}>
                            {event.status}
                          </span>
                          {event.startDate && event.endDate && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 text-accent px-2 py-0.5 text-[11px] font-medium">
                              <CalendarDays className="w-3 h-3" />
                              Multi-day
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{event.location} · {event.category.replace(/-/g, ' ')}</p>
                        {/* Per-event mini analytics row */}
                        <div className="flex flex-wrap gap-3 pt-1">
                          <div className="flex items-center gap-1.5 text-xs">
                            <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              {event.startDate && event.endDate
                                ? `${new Date(event.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${new Date(event.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                                : eventDate.toLocaleDateString(undefined, { dateStyle: 'medium' })}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs">
                            <Users className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-muted-foreground">
                              {event.attendance_closed ? 'Attendance closed' : daysUntil < 0 ? 'Event passed' : daysUntil === 0 ? 'Today' : `In ${daysUntil}d`}
                            </span>
                          </div>
                          <div className={`flex items-center gap-1 text-xs font-medium ${approvalColors[event.approval_status] ?? 'text-muted-foreground'}`}>
                            <span className="capitalize">{event.approval_status === 'approved' ? '✓ Approved' : event.approval_status === 'pending' ? '⏳ Pending approval' : event.approval_status === 'rejected' ? '✗ Rejected' : 'Draft'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex flex-wrap gap-2 shrink-0">
                        {event.approval_status === 'approved' && event.status !== 'completed' && !event.attendance_closed && (
                          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => handleGenerateQR(event)}>
                            <QrCode className="w-3.5 h-3.5" />
                            QR Code
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => handleOpenEventDetails(event)}>
                          <Users className="w-3.5 h-3.5" />
                          Attendance
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs text-orange-600" onClick={() => handleCancelEvent(event)} title="Cancel Event">
                          <Clock className="w-3.5 h-3.5" />
                          Cancel
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs text-destructive" onClick={() => handleDeleteEvent(event)} title="Delete Event">
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Show cancelled events in a collapsible section */}
          {assignedEvents.some((e) => e.status === 'cancelled') && (
            <details className="mt-6">
              <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Cancelled Events ({assignedEvents.filter((e) => e.status === 'cancelled').length})
              </summary>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                {assignedEvents.filter((e) => e.status === 'cancelled').map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onViewDetails={() => handleOpenEventDetails(event)}
                    onDeleteEvent={() => handleDeleteEvent(event)}
                  />
                ))}
              </div>
            </details>
          )}
        </section>

        <EventCreationDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onSuccess={handleCreateEventSuccess}
          userRole="coordinator"
          userSchool={user?.school}
          userDepartment={user?.department}
        />

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
                startDate={selectedEvent.startDate}
                endDate={selectedEvent.endDate}
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
                    <Button variant="secondary" size="sm" onClick={() => handleGenerateQR(selectedEvent)} disabled={selectedEvent.attendance_closed}>
                      <QrCode className="h-4 w-4 mr-1" />
                      Show Attendance QR
                    </Button>
                    {selectedEvent.feedback_open && (
                      <Button variant="secondary" size="sm" onClick={() => handleGenerateFeedbackQR(selectedEvent)}>
                        <Star className="h-4 w-4 mr-1" />
                        Show Feedback QR
                      </Button>
                    )}
                    {selectedEvent.status !== 'completed' && selectedEvent.status !== 'cancelled' && (
                      <>
                        {selectedEvent.attendance_closed ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleReopenAttendance}
                            disabled={closeAttendanceLoading || overviewLoading}
                            className="gap-1"
                          >
                            {closeAttendanceLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                            Reopen Attendance
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCloseAttendance}
                            disabled={closeAttendanceLoading || overviewLoading}
                            className="gap-1 text-orange-600 border-orange-300 hover:bg-orange-50"
                          >
                            {closeAttendanceLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                            Stop Attendance
                          </Button>
                        )}
                        <Button variant="destructive" size="sm" onClick={handleEndEvent} disabled={endEventLoading || overviewLoading}>
                          {endEventLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                          <AlertTriangle className="h-4 w-4 mr-1" />
                          End Event
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <Tabs value={workspaceTab} onValueChange={(value) => setWorkspaceTab(value as 'attendance' | 'feedback' | 'report')}>
                  <TabsList className="grid w-full grid-cols-3 md:w-auto md:inline-flex">
                    <TabsTrigger value="attendance">Attendance</TabsTrigger>
                    <TabsTrigger value="team">Team</TabsTrigger>
                    <TabsTrigger value="feedback">Feedback</TabsTrigger>
                    {selectedEvent.status === 'completed' && (
                      <TabsTrigger value="report">Report</TabsTrigger>
                    )}
                  </TabsList>

                  <TabsContent value="team" className="space-y-4">
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-between border-b pb-2">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-primary" />
                          <h3 className="text-sm font-semibold uppercase tracking-wider">Current Team</h3>
                        </div>
                        <Badge variant="outline">{selectedEvent.coordinator_names.length} Managers</Badge>
                      </div>

                      <div className="grid gap-2">
                        {/* Original Proposer */}
                        <div className="flex items-center justify-between p-3 rounded-xl border bg-primary/5 border-primary/20">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-white">
                              {(selectedEvent?.created_by_name || 'P').charAt(0)}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{selectedEvent?.created_by_name || 'Event Proposer'}</p>
                              <p className="text-[10px] text-primary uppercase font-semibold">Original Proposer</p>
                            </div>
                          </div>
                          <Badge variant="default" className="text-[10px] bg-primary/80">Author</Badge>
                        </div>

                        {(selectedEvent?.coordinator_names || []).map((name, i) => (
                          <div key={i} className="flex items-center justify-between p-3 rounded-xl border bg-card/50">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                {name.charAt(0)}
                              </div>
                              <div>
                                <p className="text-sm font-medium">{name}</p>
                                <p className="text-[10px] text-muted-foreground uppercase">{i === 0 ? 'Lead Coordinator' : 'Co-manager'}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-2 py-6 border-dashed border-2 hover:border-primary/50 hover:bg-primary/5 transition-all text-primary"
                        onClick={() => openInviteDialog(selectedEvent)}
                      >
                        <UserPlus className="w-4 h-4" />
                        Add or Invite Coordinators
                      </Button>
                      <p className="text-[10px] text-center text-muted-foreground">
                        Coordinators added will have full access to manage this event, generate QR codes, and view attendance.
                      </p>
                    </div>
                  </TabsContent>

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
          <DialogContent className="w-[95vw] max-w-3xl max-h-[90vh] overflow-y-auto">
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
