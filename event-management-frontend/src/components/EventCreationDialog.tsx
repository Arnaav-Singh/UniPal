import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CalendarDays,
  Clock,
  Loader2,
  Plus,
  Search,
  Trash2,
  Building2,
  GraduationCap,
  Users,
  MapPin,
  Sparkles,
  AlertTriangle
} from 'lucide-react';
import { apiService } from '@/services/api';
import { useToast } from '@/hooks/use-toast';
import { getAllSchools, getBranchesForSchool, DEFAULT_SCHOOL } from '@/lib/schools';
import { User, Event } from '@/types';

const SDG_GOALS = [
  'SDG1: No Poverty', 'SDG2: Zero Hunger', 'SDG3: Good Health and Well-being',
  'SDG4: Quality Education', 'SDG5: Gender Equality', 'SDG6: Clean Water and Sanitation',
  'SDG7: Affordable and Clean Energy', 'SDG8: Decent Work and Economic Growth',
  'SDG9: Industry, Innovation and Infrastructure', 'SDG10: Reduced Inequalities',
  'SDG11: Sustainable Cities and Communities', 'SDG12: Responsible Consumption and Production',
  'SDG13: Climate Action', 'SDG14: Life Below Water', 'SDG15: Life on Land',
  'SDG16: Peace, Justice and Strong Institutions', 'SDG17: Partnerships for the Goals'
];

interface EventCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  userRole: 'dean' | 'coordinator' | 'superadmin' | 'student';
  userSchool?: string;
  userDepartment?: string;
}

interface EventFormState {
  title: string;
  description: string;
  date: string;
  startDate: string;
  endDate: string;
  time: string;
  location: string;
  school: string;
  department: string;
  invitationMode: 'invite-only' | 'open';
  coordinatorIds: string[];
  category: string;
  isMultiDay: boolean;
  sdg: string[];
  guestSpeakers: string;
  tags: string;
  sponsors: string;
}

export function EventCreationDialog({
  open,
  onOpenChange,
  onSuccess,
  userRole,
  userSchool,
  userDepartment
}: EventCreationDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [coordinators, setCoordinators] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [coordinatorsLoading, setCoordinatorsLoading] = useState(false);

  const initialSchool = userSchool || DEFAULT_SCHOOL;
  const initialDept = userDepartment || (getBranchesForSchool(initialSchool)[0] ?? '');

  const [form, setForm] = useState<EventFormState>({
    title: '',
    description: '',
    date: '',
    startDate: '',
    endDate: '',
    time: '',
    location: '',
    school: initialSchool,
    department: initialDept,
    invitationMode: 'open',
    coordinatorIds: [],
    category: 'guest-lecture',
    isMultiDay: false,
    sdg: [],
    guestSpeakers: '',
    tags: '',
    sponsors: '',
  });

  const isDean = userRole === 'dean' || userRole === 'superadmin';

  // Fetch all coordinators for assignment
  useEffect(() => {
    if (open) {
      const fetchCoordinators = async () => {
        setCoordinatorsLoading(true);
        try {
          const list = await apiService.getCoordinators();
          setCoordinators(list);
        } catch (error) {
          console.error('Failed to fetch coordinators:', error);
        } finally {
          setCoordinatorsLoading(false);
        }
      };
      fetchCoordinators();
    }
  }, [open]);

  const schoolOptions = useMemo(() => getAllSchools(), []);
  const branchOptions = useMemo(() => {
    const branches = getBranchesForSchool(form.school);
    return branches.length > 0 ? branches : ['General'];
  }, [form.school]);

  const handleFormChange = (field: keyof EventFormState, value: any) => {
    setForm(prev => {
      if (field === 'school') {
        const branches = getBranchesForSchool(value);
        return {
          ...prev,
          school: value,
          department: branches[0] ?? ''
        };
      }
      return { ...prev, [field]: value };
    });
  };

  const handleSDGToggle = (goal: string) => {
    setForm(prev => {
      const current = prev.sdg || [];
      const updated = current.includes(goal)
        ? current.filter(g => g !== goal)
        : [...current, goal];
      return { ...prev, sdg: updated };
    });
  };

  const toggleCoordinator = (id: string) => {
    setForm(prev => {
      const current = prev.coordinatorIds || [];
      const updated = current.includes(id)
        ? current.filter(c => c !== id)
        : [...current, id];
      return { ...prev, coordinatorIds: updated };
    });
  };

  const filteredCoordinators = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return coordinators;
    return coordinators.filter(c => 
      c.name.toLowerCase().includes(query) || 
      c.email.toLowerCase().includes(query) ||
      c.department?.toLowerCase().includes(query)
    );
  }, [coordinators, searchQuery]);

  const handleSubmit = async () => {
    const hasDate = form.isMultiDay ? !!form.startDate : !!form.date;
    if (!form.title.trim() || !hasDate || !form.time || !form.location.trim()) {
      toast({
        title: 'Missing details',
        description: 'Please fill in all required fields marked with *',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const isoDate = form.isMultiDay
        ? new Date(`${form.startDate}T${form.time}`).toISOString()
        : new Date(`${form.date}T${form.time}`).toISOString();

      const tagList = form.tags.split(',').map(t => t.trim()).filter(Boolean);
      const sponsorList = form.sponsors.split(',').map(s => s.trim()).filter(Boolean);
      const speakerList = form.guestSpeakers.split('\n').map(s => s.trim()).filter(Boolean);

      // Dean events are auto-approved; coordinator events require approval
      const requiresApproval = !isDean;

      await apiService.createEvent({
        title: form.title.trim(),
        description: form.description.trim(),
        date: isoDate,
        startDate: form.isMultiDay ? form.startDate : undefined,
        endDate: form.isMultiDay ? form.endDate : undefined,
        location: form.location.trim(),
        school: form.school,
        department: form.department,
        invitation_mode: form.invitationMode,
        coordinatorIds: form.coordinatorIds,
        category: form.category,
        sdg: form.sdg,
        guest_speakers: speakerList,
        tags: tagList,
        sponsors: sponsorList,
        requires_approval: requiresApproval,
      });

      toast({
        title: isDean ? 'Event Created & Approved' : 'Event Submitted',
        description: isDean 
          ? `${form.title} is now live and assigned.` 
          : `${form.title} has been sent for dean approval.`,
      });
      
      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create event',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      title: '',
      description: '',
      date: '',
      startDate: '',
      endDate: '',
      time: '',
      location: '',
      school: initialSchool,
      department: initialDept,
      invitationMode: 'open',
      coordinatorIds: [],
      category: 'guest-lecture',
      isMultiDay: false,
      sdg: [],
      guestSpeakers: '',
      tags: '',
      sponsors: '',
    });
    setSearchQuery('');
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { if(!val) resetForm(); onOpenChange(val); }}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto p-0 border-none shadow-2xl">
        {/* Header with Role-Specific Branding */}
        <div className="relative overflow-hidden rounded-t-lg px-6 py-6" style={{ background: 'var(--gradient-primary)' }}>
          <div className="relative z-10 flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="bg-white/20 p-1.5 rounded-lg backdrop-blur-sm">
                  <CalendarDays className="w-5 h-5 text-white" />
                </div>
                <DialogTitle className="text-xl font-bold text-white tracking-tight">
                  {isDean ? 'Create & Authorize Event' : 'Propose New Event'}
                </DialogTitle>
              </div>
              <DialogDescription className="text-sm text-white/80 max-w-md">
                {isDean 
                  ? 'As a Dean, events you create are automatically approved and listed on the platform.'
                  : 'Your event proposal will be reviewed by the dean before being published to the community.'}
              </DialogDescription>
            </div>
            {isDean && (
              <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-success/20 border border-success/30 rounded-full backdrop-blur-md">
                <Sparkles className="w-3.5 h-3.5 text-success-foreground" />
                <span className="text-[10px] font-bold text-white uppercase tracking-widest">Auto-Approve</span>
              </div>
            )}
          </div>
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full opacity-10 bg-white" />
        </div>

        <div className="p-6 space-y-8 bg-background">
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Left Column — Primary Details */}
            <div className="space-y-8">
              {/* Basic Info */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b pb-2">
                  <div className="h-4 w-1 rounded-full bg-primary" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">General Information</h3>
                </div>
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title" className="text-sm font-semibold">Event Title <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <Input
                        id="title"
                        value={form.title}
                        onChange={(e) => handleFormChange('title', e.target.value)}
                        placeholder="Give your event a memorable name..."
                        className="pl-9 h-11 border-muted-foreground/20 focus:border-primary transition-all shadow-sm"
                      />
                      <Sparkles className="absolute left-3 top-3 w-4 h-4 text-muted-foreground/50" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Institute</Label>
                      <Select value={form.school} onValueChange={(v) => handleFormChange('school', v)}>
                        <SelectTrigger className="h-11 border-muted-foreground/20 shadow-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {schoolOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Branch</Label>
                      <Select value={form.department} onValueChange={(v) => handleFormChange('department', v)}>
                        <SelectTrigger className="h-11 border-muted-foreground/20 shadow-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {branchOptions.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Schedule */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-1 rounded-full bg-accent" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Schedule</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor="multi-day" className="text-xs font-medium text-muted-foreground">Multi-day event</Label>
                    <input
                      type="checkbox"
                      id="multi-day"
                      checked={form.isMultiDay}
                      onChange={(e) => handleFormChange('isMultiDay', e.target.checked)}
                      className="h-4 w-4 rounded border-muted-foreground/30 text-primary"
                    />
                  </div>
                </div>
                <div className="grid gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    {form.isMultiDay ? (
                      <>
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold">Start Date <span className="text-destructive">*</span></Label>
                          <Input type="date" value={form.startDate} onChange={(e) => handleFormChange('startDate', e.target.value)} className="h-10" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-semibold">End Date</Label>
                          <Input type="date" value={form.endDate} onChange={(e) => handleFormChange('endDate', e.target.value)} className="h-10" />
                        </div>
                      </>
                    ) : (
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold">Event Date <span className="text-destructive">*</span></Label>
                        <Input type="date" value={form.date} onChange={(e) => handleFormChange('date', e.target.value)} className="h-10" />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">Start Time <span className="text-destructive">*</span></Label>
                      <Input type="time" value={form.time} onChange={(e) => handleFormChange('time', e.target.value)} className="h-10" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Venue / Location <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <Input
                        value={form.location}
                        onChange={(e) => handleFormChange('location', e.target.value)}
                        placeholder="e.g. Conference Hall B or Zoom Link"
                        className="pl-9 h-10"
                      />
                      <MapPin className="absolute left-3 top-3 w-4 h-4 text-muted-foreground/50" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Detailed Description</Label>
                <Textarea
                  value={form.description}
                  onChange={(e) => handleFormChange('description', e.target.value)}
                  placeholder="What is this event about? Mention agenda, prerequisites, or why people should attend..."
                  className="min-h-[120px] resize-none"
                />
              </div>
            </div>

            {/* Right Column — Administration & Settings */}
            <div className="space-y-8 p-6 rounded-2xl bg-muted/30 border border-muted-foreground/10">
              {/* Event Managers Selection */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Assign Coordinators</h3>
                </div>
                <div className="space-y-3">
                  <div className="relative">
                    <Input
                      placeholder="Search by name or department..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 h-10 bg-background"
                    />
                    <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground/50" />
                  </div>
                  
                  <div className="rounded-xl border bg-background overflow-hidden">
                    <ScrollArea className="h-[180px]">
                      {coordinatorsLoading ? (
                        <div className="flex flex-col items-center justify-center h-full p-4 space-y-2 opacity-50">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span className="text-xs">Loading faculty list...</span>
                        </div>
                      ) : filteredCoordinators.length > 0 ? (
                        <div className="divide-y">
                          {filteredCoordinators.map(coord => {
                            const isSelected = form.coordinatorIds.includes(coord.id);
                            return (
                              <button
                                key={coord.id}
                                type="button"
                                onClick={() => toggleCoordinator(coord.id)}
                                className={`w-full flex items-center justify-between p-3 text-left transition-colors hover:bg-muted/50 ${isSelected ? 'bg-primary/5' : ''}`}
                              >
                                <div className="space-y-0.5">
                                  <p className="text-sm font-semibold">{coord.name}</p>
                                  <p className="text-[11px] text-muted-foreground">{coord.department || 'General'} · {coord.email}</p>
                                </div>
                                <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'}`}>
                                  {isSelected && <Plus className="w-3 h-3 text-white rotate-45" />}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-8 text-center text-xs text-muted-foreground">
                          No coordinators matching your search.
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                  
                  {form.coordinatorIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {form.coordinatorIds.map(id => {
                        const name = coordinators.find(c => c.id === id)?.name || 'Unknown';
                        return (
                          <Badge key={id} variant="secondary" className="px-2 py-0.5 text-[10px] flex items-center gap-1 group">
                            {name}
                            <Plus className="w-3 h-3 cursor-pointer rotate-45 hover:text-destructive transition-colors" onClick={() => toggleCoordinator(id)} />
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Categorization */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-accent" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Categorization & SDGs</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Category</Label>
                    <Select value={form.category} onValueChange={(v) => handleFormChange('category', v)}>
                      <SelectTrigger className="h-10 bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="guest-lecture">Guest Lecture</SelectItem>
                        <SelectItem value="workshop">Workshop</SelectItem>
                        <SelectItem value="seminar">Seminar</SelectItem>
                        <SelectItem value="hackathon">Hackathon</SelectItem>
                        <SelectItem value="department-meeting">Dept. Meeting</SelectItem>
                        <SelectItem value="class-committee-meeting">Class Comm. Meeting</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Access</Label>
                    <Select value={form.invitationMode} onValueChange={(v: 'open'|'invite-only') => handleFormChange('invitationMode', v)}>
                      <SelectTrigger className="h-10 bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">🌐 Open to All</SelectItem>
                        <SelectItem value="invite-only">🔒 Invite Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    Sustainable Development Goals <Badge variant="outline" className="text-[9px] h-4">Optional</Badge>
                  </Label>
                  <ScrollArea className="h-32 rounded-xl border bg-background p-3">
                    <div className="flex flex-wrap gap-1.5">
                      {SDG_GOALS.map((goal) => {
                        const isSelected = form.sdg?.includes(goal);
                        return (
                          <button
                            key={goal}
                            type="button"
                            onClick={() => handleSDGToggle(goal)}
                            className={`rounded-full px-2.5 py-1 text-[10px] font-medium border transition-all ${isSelected ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-background text-muted-foreground border-border hover:border-primary/40'}`}
                          >
                            {goal}
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              </div>

              {/* Guest Speakers */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  Guest Speakers <Badge variant="outline" className="text-[9px] h-4">Separated by line</Badge>
                </Label>
                <Textarea
                  value={form.guestSpeakers}
                  onChange={(e) => handleFormChange('guestSpeakers', e.target.value)}
                  placeholder="Dr. John Watson, Head of AI @ Google&#10;Ms. Sherlock Holmes, Senior Scientist"
                  className="h-20 bg-background text-xs"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-6 py-4 border-t bg-muted/30">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {isDean ? (
              <>
                <Sparkles className="w-3.5 h-3.5 text-success" />
                <span className="font-medium text-success-foreground/80">Direct approval active.</span>
              </>
            ) : (
              <>
                <Clock className="w-3.5 h-3.5" />
                <span>Approval will be requested from your department head.</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="flex-1 sm:flex-none h-11 px-6 font-medium"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 sm:flex-none h-11 px-8 font-bold shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: 'var(--gradient-primary)' }}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : isDean ? (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Create & Launch
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Submit Proposal
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
