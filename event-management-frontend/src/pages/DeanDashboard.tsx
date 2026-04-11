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
import { Event, EventInvitation, EventReport, User, DeanOverviewMetrics, EventOverview } from '@/types';
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
  MapPin,
  Image as ImageIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import { EventCreationDialog } from '@/components/EventCreationDialog';
import { QRCodeGenerator } from '@/components/QRCodeGenerator';

interface NewUserState {
  name: string;
  email: string;
  password: string;
  role: 'dean' | 'coordinator' | 'student';
  school: string;
  department: string;
  designation: string;
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
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [selectedQREvent, setSelectedQREvent] = useState<Event | null>(null);

  const [newUser, setNewUser] = useState<NewUserState>({
    name: '',
    email: '',
    password: '',
    role: 'student',
    school: DEFAULT_SCHOOL,
    department: defaultBranches[0] ?? '',
    designation: 'Student',
  });

  const [detailEvent, setDetailEvent] = useState<Event | null>(null);
  const [finalizeEventTarget, setFinalizeEventTarget] = useState<Event | null>(null);
  const [reportNotes, setReportNotes] = useState('');
  const [finalizeReport, setFinalizeReport] = useState<EventReport | null>(null);
  const [eventInvitations, setEventInvitations] = useState<EventInvitation[]>([]);
  const [finalizeDialogOpen, setFinalizeDialogOpen] = useState(false);
  const [finalizeLoading, setFinalizeLoading] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; user: User | null }>({ open: false, user: null });
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [eventOverview, setEventOverview] = useState<EventOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);

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
        return matchesSchool && ['scheduled', 'ongoing', 'completed', 'cancelled'].includes(event.status);
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
  const handleCreateEventSuccess = () => {
    loadData();
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
    if (!confirm('Are you sure you want to permanently remove this event?')) return;
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

  // Cancel an event (sets status to cancelled, hides from active list)
  const handleCancelEvent = async (eventId: string, title: string) => {
    if (!confirm(`Are you sure you want to cancel "${title}"? This will stop attendance and hide the event.`)) return;
    try {
      await apiService.cancelEvent(eventId);
      toast({
        title: 'Event cancelled',
        description: `"${title}" has been cancelled.`,
      });
      loadData();
    } catch (error) {
      toast({
        title: 'Unable to cancel event',
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
    setOverviewLoading(true);
    try {
      const [invitations, overview] = await Promise.all([
        apiService.getEventInvitations(event.id),
        apiService.getEventOverview(event.id)
      ]);
      setEventInvitations(invitations);
      setEventOverview(overview);
    } catch {
      setEventInvitations([]);
      setEventOverview(null);
    } finally {
      setOverviewLoading(false);
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Crown className="w-7 h-7 text-yellow-500" />
              Dean Control Center
            </h1>
            <p className="text-muted-foreground">Oversee events, approvals, and coordinators across all schools.</p>
          </div>
          <Button className="gap-2 self-start" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4" />
            Schedule Event
          </Button>
        </div>

        {/* Hero banner */}
        <div className="relative overflow-hidden rounded-2xl p-6 sm:p-8" style={{ background: 'var(--gradient-primary)' }}>
          <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-white space-y-1">
              <p className="text-sm font-medium opacity-80 uppercase tracking-wider">Command Center</p>
              <h2 className="text-2xl sm:text-3xl font-bold">{currentUser?.name?.split(' ')[0] ?? 'Dean'}</h2>
              <p className="text-sm opacity-75">{currentUser?.school || DEFAULT_SCHOOL}</p>
            </div>
            <div className="flex flex-wrap gap-6 text-white">
              <div className="text-center">
                <p className="text-3xl font-bold">{isLoading ? '—' : stats.totalEvents}</p>
                <p className="text-xs opacity-75 mt-1">Total Events</p>
              </div>
              <div className="w-px bg-white/20 hidden sm:block" />
              <div className="text-center">
                <p className="text-3xl font-bold">{isLoading ? '—' : pendingEvents.length}</p>
                <p className="text-xs opacity-75 mt-1">Pending</p>
              </div>
              <div className="w-px bg-white/20 hidden sm:block" />
              <div className="text-center">
                <p className="text-3xl font-bold">{isLoading ? '—' : stats.totalCoordinators}</p>
                <p className="text-xs opacity-75 mt-1">Coordinators</p>
              </div>
              <div className="w-px bg-white/20 hidden sm:block" />
              <div className="text-center">
                <p className="text-3xl font-bold">{isLoading ? '—' : (overview?.totalAttendance ?? 0)}</p>
                <p className="text-xs opacity-75 mt-1">Check-ins</p>
              </div>
            </div>
          </div>
          <div className="absolute -top-8 -right-8 w-48 h-48 rounded-full opacity-10" style={{ background: 'hsl(var(--university-gold))' }} />
          <div className="absolute -bottom-12 -left-8 w-56 h-56 rounded-full opacity-10" style={{ background: 'hsl(var(--primary))' }} />
        </div>

        {/* Create Event Dialog — lives outside any button wrapper */}
        <EventCreationDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onSuccess={handleCreateEventSuccess}
          userRole="dean"
          userSchool={currentUser?.school}
          userDepartment={currentUser?.department}
        />

        {/* Pending Approvals */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Clock className="w-5 h-5 text-warning-foreground" />
              Pending Approvals
            </h2>
            {pendingEvents.length > 0 && (
              <Badge className="bg-warning/20 text-warning-foreground border-warning/30">{pendingEvents.length} awaiting</Badge>
            )}
          </div>
          {pendingEvents.length === 0 ? (
            <div className="flex items-center gap-3 rounded-xl border bg-success/5 border-success/20 px-4 py-3">
              <CheckCircle className="w-5 h-5 text-success shrink-0" />
              <p className="text-sm font-medium text-success">All events are approved — great job!</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {pendingEvents.map((event) => (
                <div key={event.id} className="rounded-2xl border bg-card shadow-sm overflow-hidden">
                  <div className="h-1 w-full bg-warning/60" />
                  <div className="p-4 space-y-3">
                    <div>
                      <p className="font-semibold leading-tight">{event.title}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Proposed by: <span className="font-medium text-foreground/80">{event.created_by_name || 'Coordinator'}</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {event.department || 'General'} · {event.school || 'MIT'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="secondary" className="capitalize text-[11px]">{event.category.replace(/-/g, ' ')}</Badge>
                      <Badge variant="outline" className="capitalize text-[11px]">{event.delivery_mode.replace('-', ' ')}</Badge>
                      <span className="text-[11px] text-muted-foreground self-center">{formatDate(event.date)}</span>
                    </div>
                    {event.coordinator_names.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        📋 {event.coordinator_names.join(', ')}
                      </p>
                    )}
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" variant="outline" className="flex-1 gap-1.5 h-8 text-xs text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => openApprovalDialog(event, 'rejected')}>
                        <XCircle className="w-3.5 h-3.5" /> Reject
                      </Button>
                      <Button size="sm" className="flex-1 gap-1.5 h-8 text-xs bg-success hover:bg-success/90" onClick={() => openApprovalDialog(event, 'approved')}>
                        <CheckCircle className="w-3.5 h-3.5" /> Approve
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Analytics — departments + recent events */}
        {overview && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border bg-card shadow-sm p-5">
              <h3 className="font-semibold flex items-center gap-2 mb-4">
                <BarChart3 className="w-4 h-4 text-primary" />
                Top Departments by Attendance
              </h3>
              {overview.topDepartments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No attendance data yet.</p>
              ) : (
                <div className="space-y-3">
                  {overview.topDepartments.map((dept, i) => {
                    const max = overview.topDepartments[0]?.attendance || 1;
                    const pct = Math.round((dept.attendance / max) * 100);
                    return (
                      <div key={dept.department}>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="font-medium truncate">{dept.department}</span>
                          <span className="text-muted-foreground text-xs shrink-0 ml-2">{dept.attendance} check-ins · {dept.events} events</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: i === 0 ? 'var(--gradient-primary)' : 'hsl(var(--primary) / 0.5)' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-2xl border bg-card shadow-sm p-5">
              <h3 className="font-semibold flex items-center gap-2 mb-4">
                <Calendar className="w-4 h-4 text-primary" />
                Recently Scheduled
              </h3>
              {overview.recentEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events created recently.</p>
              ) : (
                <div className="space-y-2">
                  {overview.recentEvents.map((recent) => (
                    <div key={recent._id || `${recent.name}-${recent.date}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted/50 transition-colors">
                      <div className={`h-2 w-2 rounded-full shrink-0 ${recent.approvalStatus === 'approved' ? 'bg-success' : recent.approvalStatus === 'pending' ? 'bg-warning' : 'bg-destructive'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{recent.name}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(recent.date)}</p>
                      </div>
                      <Badge variant={recent.approvalStatus === 'approved' ? 'secondary' : 'outline'} className="capitalize text-[11px] shrink-0">
                        {recent.approvalStatus}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Community Directory */}
        <section>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Community Directory
              <Badge variant="outline" className="ml-1">{isUsersLoading ? '—' : users.length}</Badge>
            </h2>
          </div>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isUsersLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-24 rounded-xl border bg-muted/20 animate-pulse" />
              ))
            ) : users.length > 0 ? (
              users.map((user) => (
                <div key={user.id} className="group relative rounded-xl border bg-card p-4 hover:shadow-md transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{user.name}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[150px]">{user.email}</p>
                      </div>
                    </div>
                    <Badge variant={user.role === 'dean' ? 'destructive' : 'secondary'} className="text-[10px] px-1.5 py-0">
                      {user.role}
                    </Badge>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="text-[10px] text-muted-foreground uppercase font-semibold">School</p>
                      <p className="text-xs font-medium">{user.school || '—'}</p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" title="Edit">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        title="Delete"
                        onClick={() => {
                          setDeleteDialog({ open: true, user });
                          setDeletePassword('');
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full py-12 text-center border rounded-xl bg-muted/5">
                <p className="text-sm text-muted-foreground">No users found match your criteria.</p>
              </div>
            )}
          </div>
        </section>

        {/* Event Pipeline */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Event Pipeline
            </h2>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleExportExcel}>
              <Download className="w-4 h-4" />
              Export Excel
            </Button>
          </div>
          <div className="space-y-4">
            {events.filter((e) => e.status !== 'cancelled').length > 0 ? (
              events.filter((e) => e.status !== 'cancelled').map((event) => {
                const isDetailOpen = detailEvent?.id === event.id;
                const invitationsForEvent = isDetailOpen ? eventInvitations : [];
                const detailData = isDetailOpen ? detailEvent : event;

                return (
                  <div key={event.id} className="relative group rounded-2xl border bg-card transition-all hover:shadow-md overflow-hidden">
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${event.approval_status === 'approved' ? 'bg-success' :
                        event.approval_status === 'pending' ? 'bg-warning' : 'bg-destructive'
                      }`} />

                    <div className="p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-lg leading-tight">{event.title}</h3>
                            <Badge variant={event.status === 'completed' ? 'secondary' : 'default'} className="h-5 text-[10px]">
                              {event.status}
                            </Badge>
                          </div>
                          {event.created_by_name && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              Proposed by: <span className="font-medium text-foreground/80">{event.created_by_name}</span>
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-4 h-4" />
                              {formatDate(event.date)}
                            </div>
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-4 h-4" />
                              {event.location}
                            </div>
                            <div className="flex items-center gap-1.5 font-medium text-foreground/80">
                              <GraduationCap className="w-4 h-4" />
                              {event.school || 'General'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
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
                              <Button variant="outline" size="sm" className="gap-2 h-9">
                                <Eye className="w-4 h-4" />
                                View Stats
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="w-full max-w-4xl">
                              <DialogHeader>
                                <DialogTitle className="text-xl font-bold">{detailData.title}</DialogTitle>
                                <DialogDescription>
                                  View attendance, manage ownership, and monitor feedback.
                                </DialogDescription>
                              </DialogHeader>

                              {detailData && (
                                <div className="space-y-6 pt-4">
                                  <Tabs defaultValue="attendance" className="w-full">
                                    <TabsList className="grid w-full grid-cols-3 md:w-auto md:inline-flex mb-6">
                                      <TabsTrigger value="attendance" className="gap-2">
                                        <Users className="w-4 h-4" />
                                        Attendance
                                      </TabsTrigger>
                                      <TabsTrigger value="team" className="gap-2">
                                        <Shield className="w-4 h-4" />
                                        Team
                                      </TabsTrigger>
                                      <TabsTrigger value="feedback" className="gap-2">
                                        <Star className="w-4 h-4" />
                                        Feedback
                                      </TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="attendance" className="space-y-4">
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                                        <div className="p-3 rounded-xl border bg-muted/50">
                                          <p className="text-2xl font-bold">{eventOverview?.attendance.length || 0}</p>
                                          <p className="text-[10px] uppercase text-muted-foreground font-semibold">Total Attendance</p>
                                        </div>
                                        <div className="p-3 rounded-xl border bg-success/5 border-success/20">
                                          <p className="text-2xl font-bold text-success">
                                            {eventOverview?.feedback.total || 0}
                                          </p>
                                          <p className="text-[10px] uppercase text-success/70 font-semibold">Feedback</p>
                                        </div>
                                        <div className="p-3 rounded-xl border bg-warning/5 border-warning/20">
                                          <p className="text-2xl font-bold text-warning">
                                            {eventOverview?.feedback.averageRating.toFixed(1) || '0.0'}
                                          </p>
                                          <p className="text-[10px] uppercase text-warning/70 font-semibold">Avg Rating</p>
                                        </div>
                                        <div className="p-3 rounded-xl border bg-muted/50">
                                          <p className="text-2xl font-bold">{detailData.coordinator_names.length}</p>
                                          <p className="text-[10px] uppercase text-muted-foreground font-semibold">Coordinators</p>
                                        </div>
                                      </div>

                                      <div className="grid gap-6 md:grid-cols-2">
                                        <div className="space-y-3">
                                          <div className="flex items-center justify-between">
                                            <h4 className="text-sm font-semibold flex items-center gap-2">
                                              <Users className="w-4 h-4 text-primary" />
                                              Actual Attendance ({eventOverview?.attendance.length || 0})
                                            </h4>
                                          </div>
                                          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 rounded-xl border p-2 bg-muted/30">
                                            {eventOverview && eventOverview.attendance.length > 0 ? (
                                              eventOverview.attendance.map((record, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-3 rounded-xl border bg-card/60 hover:bg-card transition-colors">
                                                  <div>
                                                    <p className="text-sm font-medium">{record.name}</p>
                                                    <p className="text-[10px] text-muted-foreground">{record.email} · {record.registration_id}</p>
                                                  </div>
                                                  <Badge variant="secondary" className="text-[10px]">{record.timestamp ? new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</Badge>
                                                </div>
                                              ))
                                            ) : (
                                              <div className="text-center py-12">
                                                <Users className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                                                <p className="text-sm text-muted-foreground">No attendance records yet.</p>
                                              </div>
                                            )}
                                          </div>
                                        </div>

                                        <div className="space-y-3">
                                          <div className="flex items-center justify-between">
                                            <h4 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                                              <Mail className="w-4 h-4" />
                                              Recent Invitations ({invitationsForEvent.length})
                                            </h4>
                                          </div>
                                          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 rounded-xl border p-2 bg-muted/10">
                                            {invitationsForEvent.length > 0 ? (
                                              invitationsForEvent.map((invitation) => (
                                                <div key={invitation.id} className="flex items-center justify-between p-3 rounded-xl border bg-card/40">
                                                  <div>
                                                    <p className="text-sm font-medium">{invitation.invitee.name}</p>
                                                    <p className="text-[10px] text-muted-foreground">{invitation.invitee.email}</p>
                                                  </div>
                                                  <Badge variant={invitation.status === "accepted" ? "secondary" : "outline"} className="text-[10px]">
                                                    {invitation.status}
                                                  </Badge>
                                                </div>
                                              ))
                                            ) : (
                                              <div className="text-center py-8">
                                                <p className="text-xs text-muted-foreground">No invitations tracked.</p>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </TabsContent>

                                    <TabsContent value="team" className="space-y-4">
                                      <div className="flex flex-col gap-4">
                                        <div className="flex items-center justify-between">
                                          <h4 className="text-sm font-semibold flex items-center gap-2 text-primary uppercase tracking-wider">
                                            Assigned Coordinators
                                          </h4>
                                          <Badge variant="secondary">Total: {detailData.coordinator_names.length}</Badge>
                                        </div>

                                        <div className="grid gap-2">
                                          {/* Proposer / Creator */}
                                          <div className="flex items-center justify-between p-4 rounded-2xl border bg-primary/5 border-primary/20 transition-all hover:bg-card">
                                            <div className="flex items-center gap-4">
                                              <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-sm font-bold text-white">
                                                {(detailData?.created_by_name || 'P').charAt(0)}
                                              </div>
                                              <div>
                                                <p className="text-sm font-bold">{detailData?.created_by_name || 'Event Proposer'}</p>
                                                <p className="text-[10px] text-primary font-medium uppercase tracking-tight">Original Proposer</p>
                                              </div>
                                            </div>
                                            <Badge variant="default" className="text-[10px] bg-primary/80">Author</Badge>
                                          </div>

                                          {(detailData?.coordinator_names || []).map((name, i) => (
                                            <div key={i} className="flex items-center justify-between p-4 rounded-2xl border bg-card/50 transition-all hover:bg-card">
                                              <div className="flex items-center gap-4">
                                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                                                  {name.charAt(0)}
                                                </div>
                                                <div>
                                                  <p className="text-sm font-bold">{name}</p>
                                                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">
                                                    {i === 0 ? "Lead Manager" : "Co-manager"}
                                                  </p>
                                                </div>
                                              </div>
                                              <Badge variant="outline" className="text-[10px] border-primary/20 text-primary">Active</Badge>
                                            </div>
                                          ))}
                                        </div>

                                        <div className="mt-4 p-4 rounded-2xl border border-warning/20 bg-warning/5 text-warning-foreground text-[11px] leading-relaxed italic">
                                          Deans can add more coordinators through the standard creation/edit flow.
                                          Coordinators listed here have full management rights for check-ins, QR tools, and reporting.
                                        </div>
                                      </div>
                                    </TabsContent>

                                    <TabsContent value="feedback" className="space-y-4">
                                      <div className="flex items-center justify-between border-b pb-2">
                                        <h4 className="text-sm font-semibold flex items-center gap-2">
                                          <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                          Feedback Entries ({eventOverview?.feedback.total || 0})
                                        </h4>
                                        <div className="flex items-center gap-1">
                                          <span className="text-sm font-bold text-primary">{eventOverview?.feedback.averageRating.toFixed(1) || '0.0'}</span>
                                          <span className="text-xs text-muted-foreground">average</span>
                                        </div>
                                      </div>

                                      <div className="grid gap-3">
                                        {eventOverview && eventOverview.feedback.entries.length > 0 ? (
                                          eventOverview.feedback.entries.map((fb, idx) => (
                                            <div key={idx} className="p-4 rounded-2xl border bg-card shadow-sm space-y-2">
                                              <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                  <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">
                                                    {fb.user?.name?.charAt(0) || 'A'}
                                                  </div>
                                                  <div>
                                                    <p className="text-xs font-bold">{fb.user?.name || 'Anonymous'}</p>
                                                    <p className="text-[10px] text-muted-foreground">{fb.user?.email || 'No email'}</p>
                                                  </div>
                                                </div>
                                                <div className="flex gap-0.5">
                                                  {[...Array(5)].map((_, i) => (
                                                    <Star
                                                      key={i}
                                                      className={`w-3 h-3 ${i < fb.rating ? 'text-yellow-500 fill-yellow-500' : 'text-muted-foreground/20'}`}
                                                    />
                                                  ))}
                                                </div>
                                              </div>
                                              {fb.comments && <p className="text-xs text-muted-foreground italic">“{fb.comments}”</p>}
                                            </div>
                                          ))
                                        ) : (
                                          <div className="text-center py-16">
                                            <Star className="w-12 h-12 text-muted-foreground/10 mx-auto mb-3" />
                                            <p className="text-sm text-muted-foreground">No feedback results available for this event yet.</p>
                                          </div>
                                        )}
                                      </div>
                                    </TabsContent>
                                  </Tabs>
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>

                          <div className="flex gap-1 border rounded-lg p-1">
                            {event.approval_status === 'approved' && event.status !== 'completed' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-orange-600"
                                title="Cancel Event"
                                onClick={() => handleCancelEvent(event.id, event.title)}
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            )}
                            {event.approval_status === 'approved' && event.status !== 'completed' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-primary"
                                title="Show Attendance QR"
                                onClick={() => {
                                  setSelectedQREvent(event);
                                  setShowQRDialog(true);
                                }}
                              >
                                <QrCode className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              title="Delete Event"
                              onClick={() => handleDeleteEvent(event.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between border-t pt-4 gap-4">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground uppercase font-semibold">Approval:</span>
                          <Badge variant={event.approval_status === 'approved' ? 'secondary' : 'outline'} className="capitalize">
                            {event.approval_status}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex -space-x-2">
                            {event.coordinator_names.slice(0, 3).map((name, i) => (
                              <div key={i} title={name} className="h-7 w-7 rounded-full bg-muted border-2 border-card flex items-center justify-center text-[10px] font-bold">
                                {name.charAt(0)}
                              </div>
                            ))}
                            {event.coordinator_names.length > 3 && (
                              <div className="h-7 w-7 rounded-full bg-primary/10 border-2 border-card flex items-center justify-center text-[10px] font-bold text-primary">
                                +{event.coordinator_names.length - 3}
                              </div>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {event.coordinator_names.length > 0 ? 'Assigned' : 'Unassigned'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-20 text-center border-2 border-dashed rounded-3xl">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <Calendar className="w-6 h-6 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-lg">No events in pipeline</h3>
                <p className="text-muted-foreground max-w-xs mx-auto text-sm mt-1">
                  Scheduled events will appear here. Start by creating a new event for your department.
                </p>
              </div>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-3">
            <Shield className="w-5 h-5 text-primary" />
            Governance &amp; Controls
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-4 rounded-xl border bg-card p-4">
              <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">Academic Calendar Sync</p>
                <p className="text-xs text-muted-foreground">Align UniPal MIT's timeline with departmental calendar.</p>
              </div>
              <Button variant="outline" size="sm">Configure</Button>
            </div>
            <div className="flex items-center gap-4 rounded-xl border bg-card p-4">
              <Shield className="w-5 h-5 text-primary shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">Access Policies</p>
                <p className="text-xs text-muted-foreground">Review permissions across deans, coordinators, and students.</p>
              </div>
              <Button variant="outline" size="sm">Manage</Button>
            </div>
          </div>
        </section>

        <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
          <DialogContent className="w-full max-w-md sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Attendance QR Tools</DialogTitle>
              <DialogDescription>
                Generate secure QR codes for student check-ins.
              </DialogDescription>
            </DialogHeader>
            {selectedQREvent && (
              <QRCodeGenerator
                eventId={selectedQREvent.id}
                eventTitle={selectedQREvent.title}
                startDate={selectedQREvent.startDate}
                endDate={selectedQREvent.endDate}
              />
            )}
          </DialogContent>
        </Dialog>

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
