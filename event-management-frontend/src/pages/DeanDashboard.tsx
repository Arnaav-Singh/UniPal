// Dean/superadmin command center for approvals, user management, and reporting.
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { apiService } from '@/services/api';
import { Event, EventInvitation, EventReport, User, DeanOverviewMetrics } from '@/types';
import { DEFAULT_SCHOOL, getAllSchools, getBranchesForSchool } from '@/lib/schools';
import { useAuth } from '@/contexts/AuthContext';
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle,
  Crown,
  Edit,
  Eye,
  Flag,
  Key,
  Loader2,
  Mail,
  Plus,
  Clock,
  Shield,
  Target,
  Trash2,
  Users,
  XCircle,
  BarChart3,
  Search,
  Download,
  CalendarDays,
  QrCode,
  FileText,
  Sparkles,
  UserPlus,
  Building2,
  GraduationCap,
  X,
  RefreshCcw,
  Star,
  Image as ImageIcon,
} from 'lucide-react';
import { format } from 'date-fns';

interface NewUserState {
  name: string;
  email: string;
  password: string;
  role: 'dean' | 'coordinator' | 'student';
  school: string;
  department: string;
  designation: string;
}

interface NewEventState {
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
  allow_self_check_in: boolean;
  coordinatorIds: string[];
  category: 'seminar' | 'workshop' | 'competition' | 'guest-lecture' | 'hackathon' | 'orientation' | 'cultural' | 'sports' | 'other';
  event_format: 'seminar' | 'panel' | 'hands-on' | 'networking' | 'ceremony' | 'other';
  delivery_mode: 'in-person' | 'online' | 'hybrid';
  tags: string;
  sponsors: string;
  sdg: string[];
  guest_speakers: string;
  requires_approval: boolean;
}

export default function DeanDashboard() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const schoolOptions = useMemo(() => getAllSchools(), []);
  const defaultBranches = useMemo(() => {
    const branches = getBranchesForSchool(DEFAULT_SCHOOL);
    return branches.length > 0 ? branches : ['General'];
  }, []);
  const [newUserBranches, setNewUserBranches] = useState<string[]>(defaultBranches);
  const [newEventBranches, setNewEventBranches] = useState<string[]>(defaultBranches);

  const [users, setUsers] = useState<User[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [coordinators, setCoordinators] = useState<User[]>([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalEvents: 0,
    totalCoordinators: 0,
    completedEvents: 0,
  });
  const [overview, setOverview] = useState<DeanOverviewMetrics | null>(null);
  const [pendingEvents, setPendingEvents] = useState<Event[]>([]);
  const [approvalDialog, setApprovalDialog] = useState<{ open: boolean; decision: 'approved' | 'rejected'; event: Event | null }>({
    open: false,
    decision: 'approved',
    event: null,
  });
  const [approvalNotes, setApprovalNotes] = useState('');
  const [approvalLoading, setApprovalLoading] = useState(false);

  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false); // New state for event creation sheet
  const [createLoading, setCreateLoading] = useState(false); // New state for event creation loading
  const [isLoading, setIsLoading] = useState(true);
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const [userSchoolFilter, setUserSchoolFilter] = useState<'others' | 'all' | string>('others');
  const [userSearchTerm, setUserSearchTerm] = useState('');

  const [newUser, setNewUser] = useState<NewUserState>({
    name: '',
    email: '',
    password: '',
    role: 'student',
    school: DEFAULT_SCHOOL,
    department: defaultBranches[0] ?? '',
    designation: 'Student',
  });

  const [newEvent, setNewEvent] = useState<NewEventState>({
    title: '',
    description: '',
    date: '',
    startDate: '',
    endDate: '',
    time: '',
    location: '',
    school: DEFAULT_SCHOOL,
    department: defaultBranches[0] ?? '',
    invitation_mode: 'invite-only',
    allow_self_check_in: true,
    coordinatorIds: [],
    category: 'seminar',
    event_format: 'seminar',
    delivery_mode: 'in-person',
    tags: '',
    sponsors: '',
    sdg: [],
    guest_speakers: '',
    requires_approval: true,
  });

  const [detailEvent, setDetailEvent] = useState<Event | null>(null);
  const [finalizeEventTarget, setFinalizeEventTarget] = useState<Event | null>(null);
  const [reportNotes, setReportNotes] = useState('');
  const [finalizeReport, setFinalizeReport] = useState<EventReport | null>(null);
  const [eventInvitations, setEventInvitations] = useState<EventInvitation[]>([]);
  // Report generation has been moved to coordinator UI; keep dialog state disabled.
  const [finalizeDialogOpen, setFinalizeDialogOpen] = useState(false);
  const [finalizeLoading, setFinalizeLoading] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; user: User | null }>({ open: false, user: null });
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Restore the new user form to its default state.
  const resetNewUser = () => {
    const branches = getBranchesForSchool(DEFAULT_SCHOOL);
    const normalizedBranches = branches.length > 0 ? branches : ['General'];
    setNewUserBranches(normalizedBranches);
    setNewUser({
      name: '',
      email: '',
      password: '',
      role: 'student',
      school: DEFAULT_SCHOOL,
      department: normalizedBranches[0] ?? '',
      designation: 'Student',
    });
  };

  // Clear the event creation form when dialogs close.
  const resetNewEvent = () => {
    const branches = getBranchesForSchool(DEFAULT_SCHOOL);
    const normalizedBranches = branches.length > 0 ? branches : ['General'];
    setNewEventBranches(normalizedBranches);
    setNewEvent({
      title: '',
      description: '',
      date: '',
      startDate: '',
      endDate: '',
      time: '',
      location: '',
      school: DEFAULT_SCHOOL,
      department: normalizedBranches[0] ?? '',
      invitation_mode: 'invite-only',
      allow_self_check_in: true,
      coordinatorIds: [],
      category: 'seminar',
      event_format: 'seminar',
      delivery_mode: 'in-person',
      tags: '',
      sponsors: '',
      sdg: [],
      guest_speakers: '',
      requires_approval: true,
    });
  };

  // Update branch options when the user selects a different school.
  const handleNewUserSchoolChange = (school: string) => {
    const branches = getBranchesForSchool(school);
    const normalizedBranches = branches.length > 0 ? branches : ['General'];
    setNewUserBranches(normalizedBranches);
    setNewUser((prev) => ({
      ...prev,
      school,
      department: normalizedBranches[0] ?? '',
    }));
  };

  // Keep event branch selections aligned with the chosen school.
  const handleNewEventSchoolChange = (school: string) => {
    const branches = getBranchesForSchool(school);
    const normalizedBranches = branches.length > 0 ? branches : ['General'];
    setNewEventBranches(normalizedBranches);
    setNewEvent((prev) => ({
      ...prev,
      school,
      department: normalizedBranches[0] ?? '',
    }));
  };

  // Load user listings with current filters applied.
  const fetchUsers = useCallback(async () => {
    setIsUsersLoading(true);
    try {
      const trimmedSearch = userSearchTerm.trim();
      const params: { school?: string; search?: string; scope?: 'all' | 'others' } = {};

      if (userSchoolFilter === 'all') {
        params.scope = 'all';
      } else if (userSchoolFilter === 'others') {
        params.scope = currentUser?.school ? 'others' : 'all';
      } else {
        params.school = userSchoolFilter;
      }

      if (trimmedSearch.length > 0) {
        params.search = trimmedSearch;
      }

      const data = await apiService.getUsers(params);
      setUsers(data);
    } catch (error) {
      toast({
        title: 'Unable to load directory',
        description: error instanceof Error ? error.message : 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setIsUsersLoading(false);
    }
  }, [userSchoolFilter, userSearchTerm, toast, currentUser?.school]);

  // Gather dashboard metrics, event lists, and invitation summaries.
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [eventsData, statsData, coordinatorList, overviewData] = await Promise.all([
        apiService.getEvents(),
        apiService.getAdminStats(),
        apiService.getCoordinators(),
        apiService.getDeanOverview(),
      ]);

      const deanSchool = currentUser?.school;
      const eventsForSchool = eventsData.filter((event) => {
        const matchesSchool = deanSchool ? (event.school || DEFAULT_SCHOOL) === deanSchool : true;
        return matchesSchool && event.status === 'scheduled';
      });
      const pendingForSchool = eventsData.filter((event) => {
        const matchesSchool = deanSchool ? (event.school || DEFAULT_SCHOOL) === deanSchool : true;
        return matchesSchool && event.approval_status === 'pending';
      });

      setEvents(eventsForSchool);
      setPendingEvents(pendingForSchool);
      setCoordinators(coordinatorList);
      setOverview(overviewData);

      setStats({
        totalUsers: statsData.totalUsers,
        totalEvents: statsData.totalEvents,
        totalCoordinators: statsData.totalCoordinators,
        completedEvents: statsData.completedEvents,
      });
    } catch (error) {
      toast({
        title: 'Error loading data',
        description: error instanceof Error ? error.message : 'Failed to load dashboard data.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, currentUser?.school]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Create dean/coordinator/student accounts and refresh listings.
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiService.provisionUser({
        name: newUser.name,
        email: newUser.email,
        password: newUser.password,
        role: newUser.role,
        school: newUser.school,
        department: newUser.department,
        designation: newUser.designation,
      });
      toast({
        title: 'User Created',
        description: `${newUser.name} has been added to UniPal MIT.`,
      });
      setIsCreatingUser(false);
      resetNewUser();
      await Promise.all([loadData(), fetchUsers()]);
    } catch (error) {
      toast({
        title: 'Unable to create user',
        description: error instanceof Error ? error.message : 'Please try again later.',
        variant: 'destructive',
      });
    }
  };

  // Submit a dean-authored event and reset form inputs.
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    if (!newEvent.date && !newEvent.startDate) {
      toast({
        title: 'Event date required',
        description: 'Please select a date (or start date) for the event.',
        variant: 'destructive',
      });
      setCreateLoading(false);
      return;
    }
    if (!newEvent.time) {
      toast({
        title: 'Event time required',
        description: 'Please select a time for the event.',
        variant: 'destructive',
      });
      setCreateLoading(false);
      return;
    }

    try {
      const isoDate = newEvent.date
        ? new Date(`${newEvent.date}T${newEvent.time}`).toISOString()
        : new Date(`${newEvent.startDate}T${newEvent.time}`).toISOString();

      const tagList = newEvent.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
      const sponsorList = newEvent.sponsors
        .split(',')
        .map((sponsor) => sponsor.trim())
        .filter(Boolean);

      await apiService.createEvent({
        title: newEvent.title,
        description: newEvent.description,
        date: isoDate,
        startDate: newEvent.startDate,
        endDate: newEvent.endDate,
        location: newEvent.location,
        school: newEvent.school,
        department: newEvent.department,
        invitation_mode: newEvent.invitation_mode,
        allow_self_check_in: newEvent.allow_self_check_in,
        coordinator_ids: newEvent.coordinatorIds,
        category: newEvent.category,
        event_format: newEvent.event_format,
        delivery_mode: newEvent.delivery_mode,
        tags: tagList,
        sponsors: sponsorList,
        sdg: newEvent.sdg,
        guest_speakers: newEvent.guest_speakers.split('\n').filter(s => s.trim()),
        requires_approval: newEvent.requires_approval,
      });

      toast({
        title: 'Event scheduled',
        description: `${newEvent.title} has been created and assigned to the selected coordinators.`,
      });
      setCreateDialogOpen(false);
      resetNewEvent();
      loadData();
    } catch (error) {
      toast({
        title: 'Unable to create event',
        description: error instanceof Error ? error.message : 'Please review the details and try again.',
        variant: 'destructive',
      });
    } finally {
      setCreateLoading(false);
    }
  };

  // Track delete dialog visibility and reset transient state.
  const handleDeleteDialogOpenChange = (open: boolean) => {
    if (!open) {
      setDeleteDialog({ open: false, user: null });
      setDeletePassword('');
      setDeleteLoading(false);
    }
  };

  // Confirm destructive user deletions with password re-entry.
  const handleDeleteUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!deleteDialog.user) return;
    if (!deletePassword) {
      toast({
        title: 'Password required',
        description: 'Please enter your password to confirm deletion.',
        variant: 'destructive',
      });
      return;
    }

    setDeleteLoading(true);
    try {
      await apiService.deleteUser(deleteDialog.user.id, deletePassword);
      toast({
        title: 'User removed',
        description: `${deleteDialog.user.name} has been removed from UniPal MIT.`,
      });
      await Promise.all([fetchUsers(), loadData()]);
      handleDeleteDialogOpenChange(false);
    } catch (error) {
      toast({
        title: 'Unable to delete user',
        description: error instanceof Error ? error.message : 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  // Launch the approval modal for the selected event.
  const openApprovalDialog = (event: Event, decision: 'approved' | 'rejected') => {
    setApprovalDialog({ open: true, decision, event });
    setApprovalNotes('');
  };

  // Clear approval dialog state without persisting changes.
  const closeApprovalDialog = () => {
    setApprovalDialog({ open: false, decision: 'approved', event: null });
    setApprovalNotes('');
    setApprovalLoading(false);
  };

  // Approve or reject an event, persisting optional notes.
  const handleSubmitApproval = async () => {
    if (!approvalDialog.event) return;
    setApprovalLoading(true);
    try {
      const decision = approvalDialog.decision;
      if (decision === 'rejected' && !approvalNotes.trim()) {
        toast({
          title: 'Add review note',
          description: 'Please include feedback for the coordinator when rejecting an event.',
          variant: 'destructive',
        });
        setApprovalLoading(false);
        return;
      }
      await apiService.updateEventApproval(approvalDialog.event.id, decision, approvalNotes);
      toast({
        title: decision === 'approved' ? 'Event approved' : 'Event rejected',
        description: `${approvalDialog.event.title} has been ${decision === 'approved' ? 'approved and scheduled' : 'sent back to the coordinator'}.`,
      });
      closeApprovalDialog();
      loadData();
    } catch (error) {
      toast({
        title: 'Unable to update approval',
        description: error instanceof Error ? error.message : 'Please try again later.',
        variant: 'destructive',
      });
      setApprovalLoading(false);
    }
  };

  // Remove an event from the system after dean confirmation.
  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Are you sure you want to remove this event?')) return;
    try {
      await apiService.deleteEvent(eventId);
      toast({
        title: 'Event removed',
        description: 'The event has been deleted from the calendar.',
      });
      loadData();
    } catch (error) {
      toast({
        title: 'Unable to delete event',
        description: error instanceof Error ? error.message : 'Please try again later.',
        variant: 'destructive',
      });
    }
  };

  // Finalise an event, trigger report emails, and update metrics.
  // Report generation moved to coordinator; dean finalize disabled.
  const handleFinalizeEvent = async () => {
    toast({
      title: 'Report handled by coordinators',
      description: 'Please ask the coordinator to end the event and generate the report.',
      variant: 'destructive',
    });
  };

  // Retrieve detailed invitation stats when inspecting an event.
  const handleViewEvent = async (event: Event) => {
    setDetailEvent(event);
    try {
      const invitations = await apiService.getEventInvitations(event.id);
      setEventInvitations(invitations);
    } catch {
      setEventInvitations([]);
    }
  };

  // Format timestamps for readability inside tables and cards.
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd MMM yyyy, hh:mm a');
    } catch {
      return dateString;
    }
  };

  const handleExportExcel = async () => {
    try {
      const blob = await apiService.exportEvents();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `events-export-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({
        title: 'Export successful',
        description: 'Event data has been exported to Excel.',
      });
    } catch (error) {
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Failed to export events.',
        variant: 'destructive',
      });
    }
  };

  const statsDisplay = [
    { label: 'Total Events', value: stats.totalEvents, icon: Calendar, color: 'bg-primary' },
    { label: 'Pending Approvals', value: overview?.pendingApprovals ?? 0, icon: Clock, color: 'bg-warning' },
    { label: 'Coordinators', value: stats.totalCoordinators, icon: Shield, color: 'bg-secondary' },
    { label: 'Attendance Logged', value: overview?.totalAttendance ?? 0, icon: BarChart3, color: 'bg-accent' },
  ];

  return (
    <Layout title="Dean Control Center">
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Crown className="w-8 h-8 text-yellow-500" />
              Dean Dashboard
            </h1>
            <p className="text-muted-foreground">
              Coordinate events across every school and branch.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button className="gap-2" onClick={() => setCreateDialogOpen(true)}>
              <Target className="w-4 h-4" />
              Schedule Event
            </Button>
            {/* Create Event Dialog */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogContent className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Schedule New Event</DialogTitle>
                  <DialogDescription>
                    Create a new event for your school or department.
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleCreateEvent} className="space-y-8 py-4">
                  {/* Basic Details Section */}
                  <section className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider border-b pb-2">Basic Details</h3>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="eventTitle">Event Title</Label>
                        <Input
                          id="eventTitle"
                          value={newEvent.title}
                          onChange={(e) => setNewEvent((prev) => ({ ...prev, title: e.target.value }))}
                          placeholder="e.g., Annual Tech Symposium 2024"
                          className="text-lg font-medium"
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="eventDescription">Description</Label>
                        <Textarea
                          id="eventDescription"
                          value={newEvent.description}
                          onChange={(e) => setNewEvent((prev) => ({ ...prev, description: e.target.value }))}
                          placeholder="Provide context, goals, and what attendees can expect..."
                          rows={3}
                        />
                      </div>
                    </div>
                  </section>

                  {/* Logistics Section */}
                  <section className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider border-b pb-2">Logistics</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {['hackathon', 'competition', 'cultural', 'sports'].includes(newEvent.category) ? (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="startDate">Start Date</Label>
                            <Input
                              id="startDate"
                              type="date"
                              value={newEvent.startDate}
                              onChange={(e) => setNewEvent((prev) => ({ ...prev, startDate: e.target.value }))}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="endDate">End Date</Label>
                            <Input
                              id="endDate"
                              type="date"
                              value={newEvent.endDate}
                              onChange={(e) => setNewEvent((prev) => ({ ...prev, endDate: e.target.value }))}
                              required
                            />
                          </div>
                        </>
                      ) : (
                        <div className="space-y-2">
                          <Label htmlFor="eventDate">Date</Label>
                          <Input
                            id="eventDate"
                            type="date"
                            value={newEvent.date}
                            onChange={(e) => setNewEvent((prev) => ({ ...prev, date: e.target.value }))}
                            required
                          />
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="eventTime">Time</Label>
                        <Input
                          id="eventTime"
                          type="time"
                          value={newEvent.time}
                          onChange={(e) => setNewEvent((prev) => ({ ...prev, time: e.target.value }))}
                          required
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="eventLocation">Venue</Label>
                        <Input
                          id="eventLocation"
                          value={newEvent.location}
                          onChange={(e) => setNewEvent((prev) => ({ ...prev, location: e.target.value }))}
                          placeholder="e.g., Innovation Hub Auditorium"
                          required
                        />
                      </div>
                    </div>
                  </section>

                  {/* Organization Section */}
                  <section className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider border-b pb-2">Organization</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label>School</Label>
                        <Select
                          value={newEvent.school}
                          onValueChange={(value) => {
                            const branches = getBranchesForSchool(value);
                            setNewEvent((prev) => ({
                              ...prev,
                              school: value,
                              department: branches[0] || '',
                            }));
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select school" />
                          </SelectTrigger>
                          <SelectContent>
                            {getAllSchools().map((school) => (
                              <SelectItem key={school} value={school}>
                                {school}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Department / Programme</Label>
                        <Select
                          value={newEvent.department}
                          onValueChange={(value) => setNewEvent((prev) => ({ ...prev, department: value }))}
                          disabled={!newEvent.school}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            {getBranchesForSchool(newEvent.school).map((branch) => (
                              <SelectItem key={branch} value={branch}>
                                {branch}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </section>

                  {/* Categorization Section */}
                  <section className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider border-b pb-2">Categorization</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Category</Label>
                        <Select
                          value={newEvent.category}
                          onValueChange={(value) => setNewEvent((prev) => ({ ...prev, category: value as NewEventState['category'] }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="seminar">Seminar</SelectItem>
                            <SelectItem value="workshop">Workshop</SelectItem>
                            <SelectItem value="guest-lecture">Guest Lecture</SelectItem>
                            <SelectItem value="hackathon">Hackathon</SelectItem>
                            <SelectItem value="competition">Competition</SelectItem>
                            <SelectItem value="orientation">Orientation</SelectItem>
                            <SelectItem value="cultural">Cultural</SelectItem>
                            <SelectItem value="sports">Sports</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Format</Label>
                        <Select
                          value={newEvent.event_format}
                          onValueChange={(value) => setNewEvent((prev) => ({ ...prev, event_format: value as NewEventState['event_format'] }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select format" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="seminar">Seminar</SelectItem>
                            <SelectItem value="panel">Panel Discussion</SelectItem>
                            <SelectItem value="hands-on">Hands-on / Lab</SelectItem>
                            <SelectItem value="networking">Networking</SelectItem>
                            <SelectItem value="ceremony">Ceremony</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Delivery Mode</Label>
                        <Select
                          value={newEvent.delivery_mode}
                          onValueChange={(value) => setNewEvent((prev) => ({ ...prev, delivery_mode: value as NewEventState['delivery_mode'] }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select mode" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="in-person">In-person</SelectItem>
                            <SelectItem value="online">Online</SelectItem>
                            <SelectItem value="hybrid">Hybrid</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="eventTags">Tags</Label>
                        <Input
                          id="eventTags"
                          value={newEvent.tags}
                          onChange={(e) => setNewEvent((prev) => ({ ...prev, tags: e.target.value }))}
                          placeholder="innovation, ai, alumni"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="eventSponsors">Sponsors / Partners</Label>
                        <Input
                          id="eventSponsors"
                          value={newEvent.sponsors}
                          onChange={(e) => setNewEvent((prev) => ({ ...prev, sponsors: e.target.value }))}
                          placeholder="Manipal Alumni Association"
                        />
                      </div>
                    </div>
                  </section>

                  {/* Additional Details Section */}
                  <section className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider border-b pb-2">Additional Details</h3>

                    <div className="space-y-2">
                      <Label htmlFor="guestSpeakers">Guest Speakers (one per line)</Label>
                      <Textarea
                        id="guestSpeakers"
                        value={newEvent.guest_speakers}
                        onChange={(e) => setNewEvent((prev) => ({ ...prev, guest_speakers: e.target.value }))}
                        placeholder="Dr. Jane Doe, CEO of TechCorp&#10;Mr. John Smith, AI Researcher"
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Sustainable Development Goals (SDGs)</Label>
                      <div className="flex flex-wrap gap-2 p-4 border rounded-lg bg-muted/20">
                        {['SDG 1', 'SDG 2', 'SDG 3', 'SDG 4', 'SDG 5', 'SDG 6', 'SDG 7', 'SDG 8', 'SDG 9', 'SDG 10', 'SDG 11', 'SDG 12', 'SDG 13', 'SDG 14', 'SDG 15', 'SDG 16', 'SDG 17'].map((sdg) => {
                          const isSelected = newEvent.sdg.includes(sdg);
                          return (
                            <Button
                              key={sdg}
                              type="button"
                              variant={isSelected ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => {
                                setNewEvent((prev) => ({
                                  ...prev,
                                  sdg: isSelected
                                    ? prev.sdg.filter((s) => s !== sdg)
                                    : [...prev.sdg, sdg],
                                }));
                              }}
                              className={`text-xs h-7 ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-accent'}`}
                            >
                              {sdg}
                            </Button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Assign Coordinators</Label>
                      <div className="flex flex-wrap gap-2 p-4 border rounded-lg bg-muted/20 min-h-[100px]">
                        {coordinators.map((coordinator) => {
                          const isSelected = newEvent.coordinatorIds.includes(coordinator.id);
                          return (
                            <Button
                              key={coordinator.id}
                              type="button"
                              variant={isSelected ? 'default' : 'outline'}
                              size="sm"
                              className="gap-2"
                              onClick={() => {
                                setNewEvent((prev) => ({
                                  ...prev,
                                  coordinatorIds: isSelected
                                    ? prev.coordinatorIds.filter((id) => id !== coordinator.id)
                                    : [...prev.coordinatorIds, coordinator.id],
                                }));
                              }}
                            >
                              {isSelected && <Check className="w-4 h-4" />}
                              {coordinator.name}
                            </Button>
                          );
                        })}
                        {coordinators.length === 0 && (
                          <p className="text-sm text-muted-foreground w-full text-center py-8">
                            No coordinators available.
                          </p>
                        )}
                      </div>
                    </div>
                  </section>

                  {/* Settings Section */}
                  <section className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider border-b pb-2">Settings</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label>Invitation Mode</Label>
                        <Select
                          value={newEvent.invitation_mode}
                          onValueChange={(value: 'invite-only' | 'open') =>
                            setNewEvent((prev) => ({ ...prev, invitation_mode: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select invitation mode" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="invite-only">Invite-only (recommended)</SelectItem>
                            <SelectItem value="open">Open to all students</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Allow self check-in</Label>
                        <Select
                          value={newEvent.allow_self_check_in ? 'yes' : 'no'}
                          onValueChange={(value: 'yes' | 'no') =>
                            setNewEvent((prev) => ({ ...prev, allow_self_check_in: value === 'yes' }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Allow self check-in" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="yes">Yes — attendees can scan and mark attendance</SelectItem>
                            <SelectItem value="no">No — coordinators will mark attendance</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Requires Dean Approval</Label>
                        <Select
                          value={newEvent.requires_approval ? 'yes' : 'no'}
                          onValueChange={(value: 'yes' | 'no') =>
                            setNewEvent((prev) => ({ ...prev, requires_approval: value === 'yes' }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="yes">Yes, route for approval</SelectItem>
                            <SelectItem value="no">No, publish immediately</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </section>
                </form>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateEvent} disabled={createLoading}>
                    {createLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Schedule Event'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {statsDisplay.map((stat) => (
            <Card key={stat.label} className="bg-gradient-card shadow-card border-0">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-lg ${stat.color} flex items-center justify-center`}>
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{isLoading ? '-' : stat.value}</p>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="bg-gradient-card shadow-card border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Pending Approvals
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">All events are approved. Great job!</p>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Coordinators</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingEvents.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span>{event.title}</span>
                            <span className="text-xs text-muted-foreground">{event.department || 'General'} • {event.school || 'MIT'}</span>
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(event.date)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{event.delivery_mode.replace('-', ' ')}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">{event.category.replace('-', ' ')}</Badge>
                        </TableCell>
                        <TableCell>
                          {event.coordinator_names.length > 0 ? event.coordinator_names.join(', ') : 'Unassigned'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1"
                              onClick={() => openApprovalDialog(event, 'rejected')}
                            >
                              <XCircle className="w-4 h-4" />
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              className="gap-1"
                              onClick={() => openApprovalDialog(event, 'approved')}
                            >
                              <CheckCircle className="w-4 h-4" />
                              Approve
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {overview && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-gradient-card shadow-card border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Top Departments by Attendance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {overview.topDepartments.length === 0 && (
                  <p className="text-sm text-muted-foreground">No attendance data yet.</p>
                )}
                {overview.topDepartments.map((dept) => (
                  <div key={dept.department} className="flex flex-col gap-2 p-3 border rounded-lg sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-center sm:text-left">
                      <p className="font-medium">{dept.department}</p>
                      <p className="text-xs text-muted-foreground">{dept.events} events • {dept.attendance} check-ins</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-gradient-card shadow-card border-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Recently Scheduled
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {overview.recentEvents.length === 0 && (
                  <p className="text-sm text-muted-foreground">No events created recently.</p>
                )}
                {overview.recentEvents.map((recent) => (
                  <div key={recent._id || `${recent.name}-${recent.date}`} className="flex flex-col gap-2 p-3 border rounded-lg sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-center sm:text-left">
                      <p className="font-medium">{recent.name}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(recent.date)}</p>
                    </div>
                    <Badge variant={recent.approvalStatus === 'approved' ? 'secondary' : 'outline'} className="w-full justify-center capitalize sm:w-auto">
                      {recent.approvalStatus}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        <Card className="bg-gradient-card shadow-card border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Community Directory
              <Badge variant="outline" className="ml-2">{isUsersLoading ? '—' : users.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={userSearchTerm}
                    onChange={(e) => setUserSearchTerm(e.target.value)}
                    placeholder="Search by name, email, or department"
                    className="pl-9"
                  />
                </div>
                <div className="sm:w-60">
                  <Select value={userSchoolFilter} onValueChange={(value) => setUserSchoolFilter(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by school" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="others">All other schools</SelectItem>
                      <SelectItem value="all">Entire university</SelectItem>
                      {currentUser?.school && (
                        <SelectItem value={currentUser.school}>
                          {currentUser.school} (My school)
                        </SelectItem>
                      )}
                      {schoolOptions
                        .filter((school) => school !== currentUser?.school)
                        .map((school) => (
                          <SelectItem key={school} value={school}>
                            {school}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>School</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isUsersLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Loading directory…</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : users.length > 0 ? (
                    users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant={user.role === 'dean' ? 'destructive' : 'secondary'}>
                            {user.role === 'dean' ? 'Dean' : user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>{user.school || '—'}</TableCell>
                        <TableCell>{formatDate(user.created_at)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="outline" size="sm" title="Reset password (coming soon)">
                              <Key className="w-4 h-4" />
                            </Button>
                            <Button variant="outline" size="sm" title="Edit profile (coming soon)">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                setDeleteDialog({ open: true, user });
                                setDeletePassword('');
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No users found. Adjust your filters or invite coordinators from another school.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card shadow-card border-0">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Event Pipeline
            </CardTitle>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleExportExcel}>
              <Download className="w-4 h-4" />
              Export Excel
            </Button>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Venue</TableHead>
                    <TableHead>Coordinators</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => {
                    const isDetailOpen = detailEvent?.id === event.id;
                    const isFinalizeOpen = finalizeDialogOpen && finalizeEventTarget?.id === event.id;
                    const invitationsForEvent = isDetailOpen ? eventInvitations : [];
                    const detailData = isDetailOpen ? detailEvent : event;
                    const finalizeData = isFinalizeOpen ? finalizeEventTarget : event;

                    return (
                      <TableRow key={event.id}>
                        <TableCell className="font-medium">
                          <div>
                            <p>{event.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {event.school || DEFAULT_SCHOOL}{event.department ? ` • ${event.department}` : ''}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(event.date)}</TableCell>
                        <TableCell>{event.location}</TableCell>
                        <TableCell>
                          {event.coordinator_names.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {event.coordinator_names.map((name) => (
                                <Badge key={name} variant="secondary">{name}</Badge>
                              ))}
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">Unassigned</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant={event.status === 'completed' ? 'secondary' : 'default'}>
                              {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                            </Badge>
                            <Badge variant="outline">{event.invitation_mode === 'invite-only' ? 'Invite-only' : 'Open'}</Badge>
                            <Badge
                              variant={event.approval_status === 'approved' ? 'secondary' : event.approval_status === 'pending' ? 'outline' : 'destructive'}
                              className="capitalize"
                            >
                              {event.approval_status}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Dialog
                              open={isDetailOpen}
                              onOpenChange={(open) => {
                                if (open) {
                                  handleViewEvent(event);
                                  setDetailEvent(event);
                                } else {
                                  setDetailEvent(null);
                                  setEventInvitations([]);
                                }
                              }}
                            >
                              <DialogTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    handleViewEvent(event);
                                    setDetailEvent(event);
                                  }}
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="w-full max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle>{detailData.title}</DialogTitle>
                                  <DialogDescription>
                                    Invitations and attendance snapshot for this event.
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <p className="text-muted-foreground">Date &amp; time</p>
                                      <p className="font-medium">{formatDate(detailData.date)}</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Venue</p>
                                      <p className="font-medium">{detailData.location}</p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Coordinators</p>
                                      <p className="font-medium">
                                        {detailData.coordinator_names.length > 0 ? detailData.coordinator_names.join(', ') : 'Unassigned'}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground">Invitation mode</p>
                                      <p className="font-medium">
                                        {detailData.invitation_mode === 'invite-only' ? 'Invite-only' : 'Open to CS&E members'}
                                      </p>
                                    </div>
                                  </div>
                                  <div>
                                    <h3 className="text-sm font-semibold mb-2">Invited attendees</h3>
                                    <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                                      {invitationsForEvent.map((invitation) => (
                                        <div key={invitation.id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                                          <div className="text-center sm:text-left">
                                            <p className="font-medium">{invitation.invitee.name}</p>
                                            <p className="text-xs text-muted-foreground">{invitation.invitee.email}</p>
                                          </div>
                                          <div className="text-center sm:text-right">
                                            <Badge variant={invitation.status === 'accepted' ? 'secondary' : invitation.status === 'pending' ? 'outline' : 'destructive'} className="w-full justify-center sm:w-auto">
                                              {invitation.status.charAt(0).toUpperCase() + invitation.status.slice(1)}
                                            </Badge>
                                            <p className="text-xs text-muted-foreground mt-1">
                                              Role: {invitation.role_at_event === 'coordinator' ? 'Coordinator' : 'Attendee'}
                                            </p>
                                          </div>
                                        </div>
                                      ))}
                                      {invitationsForEvent.length === 0 && (
                                        <p className="text-sm text-muted-foreground">
                                          No invitations have been sent yet. Coordinators can invite participants from their dashboard.
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                            {/* Report generation disabled for deans; coordinators own this flow */}
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDeleteEvent(event.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {events.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No events scheduled. Use the &ldquo;Schedule Event&rdquo; button to create the first CS&E event.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-card shadow-card border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Governance &amp; Controls
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-3 p-4 border rounded-lg sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-3 text-center sm:flex-row sm:items-center sm:text-left">
                  <AlertTriangle className="w-5 h-5 text-warning" />
                  <div>
                    <p className="font-medium">Academic Calendar Sync</p>
                    <p className="text-sm text-muted-foreground">Align UniPal MIT's timeline with departmental calendar.</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full sm:w-auto">Configure</Button>
              </div>
              <div className="flex flex-col gap-3 p-4 border rounded-lg sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-3 text-center sm:flex-row sm:items-center sm:text-left">
                  <Shield className="w-5 h-5 text-primary" />
                  <div>
                    <p className="font-medium">Access Policies</p>
                    <p className="text-sm text-muted-foreground">Review permissions across deans, coordinators, and students.</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full sm:w-auto">Manage</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Dialog
          open={deleteDialog.open}
          onOpenChange={handleDeleteDialogOpenChange}
        >
          <DialogContent className="w-full max-w-md sm:max-w-lg">
            <form onSubmit={handleDeleteUser} className="space-y-5">
              <DialogHeader>
                <DialogTitle>Delete user</DialogTitle>
                <DialogDescription>
                  This action will immediately remove{' '}
                  <span className="font-medium text-foreground">
                    {deleteDialog.user?.name}
                  </span>{' '}
                  ({deleteDialog.user?.email}) from UniPal MIT. Please confirm using your password.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="delete-password">Password</Label>
                <Input
                  id="delete-password"
                  type="password"
                  value={deletePassword}
                  autoFocus
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
              </div>
              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleDeleteDialogOpenChange(false)}
                  disabled={deleteLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  className="gap-2"
                  disabled={deleteLoading || deletePassword.length === 0}
                >
                  {deleteLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Delete user
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog
          open={approvalDialog.open}
          onOpenChange={(open) => {
            if (!open) {
              closeApprovalDialog();
            }
          }}
        >
          <DialogContent className="w-full max-w-md sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {approvalDialog.decision === 'approved' ? 'Approve Event' : 'Reject Event'}
              </DialogTitle>
              <DialogDescription>
                {approvalDialog.decision === 'approved'
                  ? 'Confirm that this event is ready to be published to all stakeholders.'
                  : 'Share guidance with the coordinating team before rejecting.'}
              </DialogDescription>
            </DialogHeader>
            {approvalDialog.event && (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="font-semibold">{approvalDialog.event.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(approvalDialog.event.date), 'dd MMM yyyy, hh:mm a')} • {approvalDialog.event.location}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="outline" className="capitalize">{approvalDialog.event.category.replace('-', ' ')}</Badge>
                    <Badge variant="secondary" className="capitalize">{approvalDialog.event.delivery_mode.replace('-', ' ')}</Badge>
                    <Badge variant="outline">{approvalDialog.event.invitation_mode === 'invite-only' ? 'Invite-only' : 'Open'}</Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="approvalNotes">Dean Notes</Label>
                  <Textarea
                    id="approvalNotes"
                    placeholder={approvalDialog.decision === 'approved' ? 'Optional remarks for the coordinating team' : 'Share revision requests or concerns'}
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    rows={4}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={closeApprovalDialog}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSubmitApproval}
                    className="gap-2"
                    variant={approvalDialog.decision === 'approved' ? 'default' : 'destructive'}
                    disabled={approvalLoading}
                  >
                    {approvalLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {approvalDialog.decision === 'approved' ? 'Approve & Publish' : 'Reject Event'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout >
  );
}
