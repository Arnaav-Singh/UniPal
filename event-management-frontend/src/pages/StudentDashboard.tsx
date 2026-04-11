
// Student dashboard surfacing invites, attendance history, and QR check-in.
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Layout } from '@/components/Layout';
import { EventCard } from '@/components/EventCard';
import { QRScanner } from '@/components/QRScanner';
import type { QRScanType } from '@/components/QRScanner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  CalendarDays, CheckCircle, QrCode, Search,
  Download,
  CalendarPlus,
  Filter, Star, Loader2, PenLine, RotateCcw, MessageSquare
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Event, EventInvitation } from '@/types';
import { apiService } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

// Scanned QR result pending user action
interface ScanResult {
  eventId: string;
  code?: string;
  type: QRScanType;
  isAnonymous?: boolean;
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [attendedEvents, setAttendedEvents] = useState<Event[]>([]);
  const [invitations, setInvitations] = useState<EventInvitation[]>([]);
  const [feedbackDialogOpen, setFeedbackDialogOpen] = useState(false);
  const [pendingFeedbackEvent, setPendingFeedbackEvent] = useState<Event | null>(null);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackComments, setFeedbackComments] = useState('');
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // --- QR scan workflow state ---
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  // Attendance inline form
  const [attendanceSubmitting, setAttendanceSubmitting] = useState(false);
  const [attendanceError, setAttendanceError] = useState('');
  const [attendanceSuccess, setAttendanceSuccess] = useState(false);
  // Signature
  const [signatureData, setSignatureData] = useState('');
  const [hasSignature, setHasSignature] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const hasDrawnRef = useRef(false);
  // Feedback inline form
  const [scanFeedbackRating, setScanFeedbackRating] = useState(5);
  const [scanFeedbackComments, setScanFeedbackComments] = useState('');
  const [scanFeedbackSubmitting, setScanFeedbackSubmitting] = useState(false);
  const [scanFeedbackError, setScanFeedbackError] = useState('');
  const [scanFeedbackSuccess, setScanFeedbackSuccess] = useState(false);

  // Filter events based on search and category
  const filteredEvents = useMemo(() => {
    return upcomingEvents.filter(event => {
      const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || event.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [upcomingEvents, searchTerm, categoryFilter]);

  const handleDownloadCalendar = (event: Event) => {
    const startTime = event.date.replace(/-|:|\.\d\d\d/g, "");
    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      `DTSTART:${startTime} `,
      `SUMMARY:${event.title} `,
      `DESCRIPTION:${event.description} `,
      `LOCATION:${event.location} `,
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\n");

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${event.title.replace(/\s+/g, '_')}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  const dismissedFeedbackRef = useRef<Set<string>>(new Set());
  const feedbackClosedBySubmitRef = useRef(false);
  const [stats, setStats] = useState({
    attendedEvents: 0,
    upcomingEvents: 0,
    feedbackGiven: 0
  });
  const { toast } = useToast();

  // Pull upcoming events, tracked attendance, and pending invites.
  const loadData = useCallback(async () => {
    if (!user) return;

    try {
      const [allEvents, attendanceData, statsData, invitationData] = await Promise.all([
        apiService.getEvents(),
        apiService.getStudentAttendance(user.id),
        apiService.getStudentStats(user.id),
        apiService.getMyInvitations(),
      ]);

      const now = new Date();
      const upcoming = allEvents.filter(event => new Date(event.date) > now && event.approval_status === 'approved' && event.status !== 'cancelled');

      setUpcomingEvents(upcoming);
      setAttendedEvents(attendanceData.events);
      setStats(statsData);
      setInvitations(invitationData.filter((inv) => inv.status === 'pending'));
    } catch (error) {
      console.error('Failed to load student data:', error);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, loadData]);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      loadData();
    }, 60000);
    return () => clearInterval(interval);
  }, [user, loadData]);

  useEffect(() => {
    const pendingIds = new Set(
      attendedEvents
        .filter(
          (event) =>
            event.status === 'completed' &&
            event.feedback_open &&
            !event.feedback_submitted
        )
        .map((event) => event.id)
    );
    const toRemove: string[] = [];
    dismissedFeedbackRef.current.forEach((id) => {
      if (!pendingIds.has(id)) {
        toRemove.push(id);
      }
    });
    toRemove.forEach((id) => dismissedFeedbackRef.current.delete(id));
    if (feedbackDialogOpen) return;
    const next = attendedEvents.find(
      (event) =>
        event.status === 'completed' &&
        event.feedback_open &&
        !event.feedback_submitted &&
        !dismissedFeedbackRef.current.has(event.id)
    );
    if (next) {
      setPendingFeedbackEvent(next);
      setFeedbackDialogOpen(true);
    }
  }, [attendedEvents, feedbackDialogOpen]);

  // --- Signature canvas helpers ---
  const initialiseCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    const width = parent?.clientWidth ?? 600;
    const height = parent?.clientHeight ?? 180;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = 2.5;
    context.strokeStyle = '#0f172a';
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    contextRef.current = context;
    hasDrawnRef.current = false;
  }, []);

  // Re-initialise whenever we switch to the attendance form view
  useEffect(() => {
    if (scanResult?.type === 'attendance' && !attendanceSuccess) {
      // small timeout so DOM has rendered the canvas
      const t = setTimeout(initialiseCanvas, 100);
      return () => clearTimeout(t);
    }
  }, [scanResult, attendanceSuccess, initialiseCanvas]);

  const clearSignature = useCallback(() => {
    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    setSignatureData('');
    setHasSignature(false);
    hasDrawnRef.current = false;
  }, []);

  const getRelativePoint = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const persistSignature = () => {
    if (!canvasRef.current) return;
    setSignatureData(canvasRef.current.toDataURL('image/png'));
    setHasSignature(true);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!contextRef.current) return;
    event.preventDefault();
    const { x, y } = getRelativePoint(event);
    contextRef.current.beginPath();
    contextRef.current.moveTo(x, y);
    setIsDrawing(true);
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch (_) {}
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !contextRef.current) return;
    event.preventDefault();
    const { x, y } = getRelativePoint(event);
    contextRef.current.lineTo(x, y);
    contextRef.current.stroke();
    if (!hasDrawnRef.current) hasDrawnRef.current = true;
  };

  const finishDrawing = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !contextRef.current) return;
    event.preventDefault();
    setIsDrawing(false);
    contextRef.current.closePath();
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch (_) {}
    if (hasDrawnRef.current) persistSignature();
    hasDrawnRef.current = false;
  };

  // --- QR scan handler ---
  const handleQRScanSuccess = useCallback(({ eventId, code, type, isAnonymous }: { eventId: string; code?: string; type: QRScanType; isAnonymous?: boolean }) => {
    if (!user) return;
    if (!code) {
      toast({
        title: 'Code required',
        description: 'Please scan the official QR code generated by the coordinator.',
        variant: 'destructive'
      });
      return;
    }
    // Show the inline form instead of immediately processing
    setScanResult({ eventId, code, type, isAnonymous });
    // Reset form states
    setAttendanceSubmitting(false);
    setAttendanceError('');
    setAttendanceSuccess(false);
    setSignatureData('');
    setHasSignature(false);
    setScanFeedbackRating(5);
    setScanFeedbackComments('');
    setScanFeedbackSubmitting(false);
    setScanFeedbackError('');
    setScanFeedbackSuccess(false);
  }, [user, toast]);

  // Submit attendance from inline form
  const handleInlineAttendanceSubmit = async () => {
    if (!scanResult || !user) return;
    if (!signatureData) {
      setAttendanceError('Please sign inside the box before submitting.');
      return;
    }
    setAttendanceSubmitting(true);
    setAttendanceError('');
    try {
      await apiService.checkInWithCode(scanResult.eventId, {
        code: scanResult.code!,
        signature: signatureData,
      });
      setAttendanceSuccess(true);
      toast({
        title: 'Attendance marked!',
        description: 'Your attendance has been recorded for this event.',
      });
      loadData();
    } catch (err) {
      setAttendanceError(err instanceof Error ? err.message : 'Unable to mark attendance');
      setAttendanceSubmitting(false);
    }
  };

  // Submit feedback from inline form
  const handleInlineFeedbackSubmit = async () => {
    if (!scanResult) return;
    if (scanFeedbackRating < 1 || scanFeedbackRating > 5) {
      setScanFeedbackError('Please select a rating between 1 and 5.');
      return;
    }
    setScanFeedbackSubmitting(true);
    setScanFeedbackError('');
    try {
      await apiService.submitFeedback({
        event_id: scanResult.eventId,
        rating: scanFeedbackRating,
        comments: scanFeedbackComments.trim(),
        code: scanResult.code!,
        isAnonymous: scanResult.isAnonymous,
      });
      setScanFeedbackSuccess(true);
      toast({
        title: 'Feedback submitted',
        description: 'Thank you for your feedback!',
      });
      loadData();
    } catch (err) {
      setScanFeedbackError(err instanceof Error ? err.message : 'Unable to submit feedback');
      setScanFeedbackSubmitting(false);
    }
  };

  // Reset the scan flow to allow rescanning
  const handleScanAgain = () => {
    setScanResult(null);
    setAttendanceSuccess(false);
    setScanFeedbackSuccess(false);
  };

  // Accept or decline coordinator invitations directly from the dashboard.
  const handleInvitationResponse = async (invitation: EventInvitation, decision: 'accepted' | 'declined') => {
    try {
      await apiService.respondToInvitation(invitation.id, decision);
      toast({
        title: decision === 'accepted' ? 'Invitation accepted' : 'Invitation declined',
        description: decision === 'accepted'
          ? 'Great! You are confirmed for the event.'
          : 'The coordinator has been notified of your decision.'
      });
      loadData();
    } catch (error) {
      toast({
        title: 'Unable to update invitation',
        description: error instanceof Error ? error.message : 'Please try again later.',
        variant: 'destructive'
      });
    }
  };

  const statsDisplay = [
    { label: 'Upcoming Events', value: stats.upcomingEvents, icon: CalendarDays, color: 'bg-primary' },
    { label: 'Events Attended', value: stats.attendedEvents, icon: CheckCircle, color: 'bg-success' },
    { label: 'Feedback Given', value: stats.feedbackGiven, icon: Star, color: 'bg-accent' }
  ];

  const handleFeedbackDialogChange = (open: boolean) => {
    setFeedbackDialogOpen(open);
    if (!open) {
      if (!feedbackClosedBySubmitRef.current && pendingFeedbackEvent) {
        dismissedFeedbackRef.current.add(pendingFeedbackEvent.id);
      }
      setPendingFeedbackEvent(null);
      setFeedbackComments('');
      setFeedbackRating(5);
      feedbackClosedBySubmitRef.current = false;
    }
  };

  const handleSubmitFeedback = async () => {
    if (!pendingFeedbackEvent) return;
    setFeedbackSubmitting(true);
    try {
      await apiService.submitFeedback({
        event_id: pendingFeedbackEvent.id,
        rating: feedbackRating,
        comments: feedbackComments.trim(),
      });
      toast({
        title: 'Feedback submitted',
        description: `Thanks for sharing feedback for ${pendingFeedbackEvent.title}.`,
      });
      feedbackClosedBySubmitRef.current = true;
      dismissedFeedbackRef.current.add(pendingFeedbackEvent.id);
      setFeedbackDialogOpen(false);
      setPendingFeedbackEvent(null);
      setFeedbackComments('');
      setFeedbackRating(5);
      loadData();
    } catch (error) {
      toast({
        title: 'Unable to submit feedback',
        description: error instanceof Error ? error.message : 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  // Render the inline attendance form after a successful scan
  const renderAttendanceForm = () => {
    if (attendanceSuccess) {
      return (
        <div className="text-center space-y-4 py-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <div>
            <p className="text-lg font-semibold text-green-600">Attendance Marked!</p>
            <p className="text-sm text-muted-foreground">Your attendance has been recorded.</p>
          </div>
          <Button variant="outline" onClick={handleScanAgain} className="gap-2">
            <QrCode className="w-4 h-4" />
            Scan Another
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
          <p className="text-sm font-medium text-blue-800">Attendance QR Detected</p>
          <p className="text-xs text-blue-600 mt-1">Sign below and submit to mark your attendance.</p>
        </div>

        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-sm">
            <Label className="flex items-center gap-2 font-medium">
              <PenLine className="h-4 w-4 text-muted-foreground" />
              Signature
            </Label>
            {user?.registration_id && (
              <span className="text-muted-foreground font-medium my-1 sm:my-0">
                Student ID: <span className="text-foreground">{user.registration_id}</span>
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Use your finger or mouse to sign inside the box.
          </p>
          <div className="rounded-md border bg-white">
            <canvas
              ref={canvasRef}
              className="h-44 w-full touch-none rounded-md"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={finishDrawing}
              onPointerLeave={finishDrawing}
              onPointerCancel={finishDrawing}
            />
          </div>
          <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>{hasSignature ? 'Signature captured.' : 'Sign above to continue.'}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={clearSignature}
              disabled={attendanceSubmitting}
            >
              <RotateCcw className="h-4 w-4" />
              Clear
            </Button>
          </div>
        </div>

        {attendanceError && <p className="text-sm text-destructive">{attendanceError}</p>}

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleScanAgain}
            disabled={attendanceSubmitting}
            className="flex-1"
          >
            Back
          </Button>
          <Button
            onClick={handleInlineAttendanceSubmit}
            disabled={attendanceSubmitting || !hasSignature}
            className="flex-1 gap-2"
          >
            {attendanceSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Mark Attendance
          </Button>
        </div>
      </div>
    );
  };

  // Render the inline feedback form after a successful scan
  const renderFeedbackForm = () => {
    if (scanFeedbackSuccess) {
      return (
        <div className="text-center space-y-4 py-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <Star className="w-8 h-8 text-green-600 fill-green-600" />
          </div>
          <div>
            <p className="text-lg font-semibold text-green-600">Thank you!</p>
            <p className="text-sm text-muted-foreground">Your feedback has been submitted successfully.</p>
          </div>
          <Button variant="outline" onClick={handleScanAgain} className="gap-2">
            <QrCode className="w-4 h-4" />
            Scan Another
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
          <p className="text-sm font-medium text-emerald-800">Feedback QR Detected</p>
          <p className="text-xs text-emerald-600 mt-1">Rate your experience and share your thoughts.</p>
        </div>

        <div className="space-y-2">
          <Label>Rating</Label>
          <div className="flex gap-2 justify-center">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setScanFeedbackRating(value)}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                  scanFeedbackRating >= value
                    ? 'bg-yellow-400 text-yellow-900'
                    : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                }`}
              >
                <Star className={`w-6 h-6 ${scanFeedbackRating >= value ? 'fill-current' : ''}`} />
              </button>
            ))}
          </div>
          <p className="text-xs text-center text-muted-foreground">
            {scanFeedbackRating === 5 && 'Excellent'}
            {scanFeedbackRating === 4 && 'Very Good'}
            {scanFeedbackRating === 3 && 'Good'}
            {scanFeedbackRating === 2 && 'Fair'}
            {scanFeedbackRating === 1 && 'Poor'}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="scanFeedbackComments">Comments (optional)</Label>
          <Textarea
            id="scanFeedbackComments"
            value={scanFeedbackComments}
            onChange={(e) => setScanFeedbackComments(e.target.value)}
            placeholder="Share your thoughts about the event..."
            rows={3}
          />
        </div>

        {scanFeedbackError && <p className="text-sm text-destructive">{scanFeedbackError}</p>}

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleScanAgain}
            disabled={scanFeedbackSubmitting}
            className="flex-1"
          >
            Back
          </Button>
          <Button
            onClick={handleInlineFeedbackSubmit}
            disabled={scanFeedbackSubmitting}
            className="flex-1 gap-2"
          >
            {scanFeedbackSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit Feedback
          </Button>
        </div>
      </div>
    );
  };

  return (
    <>
      <Layout title="Student Dashboard">
        <div className="space-y-6">
          {/* Page title + QR scanner button */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold">Student Dashboard</h1>
              <p className="text-muted-foreground">Discover and attend college events</p>
            </div>
            <Dialog
              open={showQRScanner}
              onOpenChange={(open) => {
                setShowQRScanner(open);
                if (!open) {
                  setScanResult(null);
                  setAttendanceSuccess(false);
                  setScanFeedbackSuccess(false);
                }
              }}
            >
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <QrCode className="w-4 h-4" />
                  Scan QR Code
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[95vw] max-w-md sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>
                    {scanResult
                      ? scanResult.type === 'attendance'
                        ? 'Mark Attendance'
                        : 'Submit Feedback'
                      : 'Scan QR Code'}
                  </DialogTitle>
                </DialogHeader>
                {!scanResult ? (
                  <QRScanner onScanSuccess={handleQRScanSuccess} />
                ) : scanResult.type === 'attendance' ? (
                  renderAttendanceForm()
                ) : (
                  renderFeedbackForm()
                )}
              </DialogContent>
            </Dialog>
          </div>

          {/* Hero welcome banner */}
          <div className="relative overflow-hidden rounded-2xl p-6 sm:p-8" style={{ background: 'var(--gradient-primary)' }}>
            <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-white space-y-1">
                <p className="text-sm font-medium opacity-80 uppercase tracking-wider">Welcome back</p>
                <h2 className="text-2xl sm:text-3xl font-bold">{user?.name?.split(' ')[0] ?? 'Student'} 👋</h2>
                <p className="text-sm opacity-75">{user?.school || 'UniPal MIT'}{user?.department ? ' · ' + user.department : ''}</p>
              </div>
              <div className="flex gap-6 text-white">
                <div className="text-center">
                  <p className="text-3xl font-bold">{stats.attendedEvents}</p>
                  <p className="text-xs opacity-75 mt-1">Attended</p>
                </div>
                <div className="w-px bg-white/20" />
                <div className="text-center">
                  <p className="text-3xl font-bold">{upcomingEvents.length}</p>
                  <p className="text-xs opacity-75 mt-1">Upcoming</p>
                </div>
                <div className="w-px bg-white/20" />
                <div className="text-center">
                  <p className="text-3xl font-bold">{invitations.length}</p>
                  <p className="text-xs opacity-75 mt-1">Invites</p>
                </div>
              </div>
            </div>
            <div className="absolute -top-8 -right-8 w-48 h-48 rounded-full opacity-10" style={{ background: 'hsl(var(--university-gold))' }} />
            <div className="absolute -bottom-12 -left-8 w-56 h-56 rounded-full opacity-10" style={{ background: 'hsl(var(--primary))' }} />
          </div>

          {/* Pending Invitations */}
          {invitations.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-warning animate-pulse" />
                Pending Invitations
                <Badge variant="secondary">{invitations.length}</Badge>
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {invitations.map((invitation) => {
                  const matchingEvent = [...upcomingEvents, ...attendedEvents].find((e) => e.id === invitation.event_id);
                  return (
                    <div key={invitation.id} className="flex flex-col gap-3 rounded-xl border bg-card shadow-sm p-4">
                      <div>
                        <p className="font-semibold leading-tight">{matchingEvent?.title || 'Event invitation'}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Invited as <span className="font-medium capitalize">{invitation.role_at_event === 'coordinator' ? 'Coordinator' : 'Attendee'}</span>
                        </p>
                        {matchingEvent && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(matchingEvent.date).toLocaleDateString(undefined, { dateStyle: 'medium' })} · {matchingEvent.location}
                          </p>
                        )}
                        {invitation.message && <p className="text-xs mt-2 italic text-muted-foreground">"{invitation.message}"</p>}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" variant="outline" className="flex-1 text-xs h-8" onClick={() => handleInvitationResponse(invitation, 'declined')}>Decline</Button>
                        <Button size="sm" className="flex-1 text-xs h-8" onClick={() => handleInvitationResponse(invitation, 'accepted')}>Accept</Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Upcoming Events */}
          <section>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
              <h2 className="text-lg font-semibold">Upcoming Events</h2>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input placeholder="Search events..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 h-8 text-sm w-48" />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[130px] h-8 text-xs">
                    <Filter className="w-3 h-3 mr-1.5" />
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="seminar">Seminar</SelectItem>
                    <SelectItem value="workshop">Workshop</SelectItem>
                    <SelectItem value="hackathon">Hackathon</SelectItem>
                    <SelectItem value="guest-lecture">Guest Lecture</SelectItem>
                    <SelectItem value="department-meeting">Dept Meeting</SelectItem>
                    <SelectItem value="class-committee-meeting">Class Committee</SelectItem>
                    <SelectItem value="management-meeting">Management</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {filteredEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/30 py-16 text-center">
                <CalendarDays className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="font-medium text-muted-foreground">No events found</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Try adjusting your filters</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredEvents.map((event) => {
                  const eventDate = new Date(event.date);
                  const daysUntil = Math.ceil((eventDate.getTime() - Date.now()) / 86400000);
                  const categoryColors: Record<string, string> = {
                    seminar: 'bg-blue-100 text-blue-800',
                    workshop: 'bg-purple-100 text-purple-800',
                    hackathon: 'bg-orange-100 text-orange-800',
                    'guest-lecture': 'bg-green-100 text-green-800',
                    'department-meeting': 'bg-pink-100 text-pink-800',
                    'class-committee-meeting': 'bg-yellow-100 text-yellow-800',
                  };
                  const catColor = categoryColors[event.category] ?? 'bg-secondary text-secondary-foreground';
                  return (
                    <div key={event.id} className="group flex flex-col rounded-2xl border bg-card shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
                      <div className="h-1 w-full" style={{ background: 'var(--gradient-primary)' }} />
                      <div className="flex flex-col flex-1 p-4 gap-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm leading-tight line-clamp-2">{event.title}</p>
                            <p className="text-xs text-muted-foreground mt-1 truncate">{event.location}</p>
                          </div>
                          <button
                            className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg hover:bg-muted"
                            onClick={() => handleDownloadCalendar(event)}
                            title="Add to Calendar"
                          >
                            <Download className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${catColor}`}>
                            {event.category.replace(/-/g, ' ')}
                          </span>
                          {event.delivery_mode !== 'in-person' && (
                            <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize">{event.delivery_mode}</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-auto pt-2 border-t">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CalendarDays className="w-3 h-3" />
                            <span>{eventDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                          </div>
                          <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${
                            daysUntil <= 1 ? 'bg-destructive/10 text-destructive' :
                            daysUntil <= 7 ? 'bg-warning/20 text-warning-foreground' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `${daysUntil}d away`}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Attended Events */}
          <section>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              Attended Events
              <Badge variant="secondary">{attendedEvents.length}</Badge>
            </h2>
            {attendedEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/30 py-10 text-center">
                <CheckCircle className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No events attended yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {attendedEvents.map((event) => (
                  <div key={event.id} className="flex items-center gap-4 rounded-xl border bg-card px-4 py-3 hover:bg-muted/40 transition-colors">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success/10">
                      <CheckCircle className="h-4 w-4 text-success" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight truncate">{event.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(event.date).toLocaleDateString(undefined, { dateStyle: 'medium' })} · {event.location}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {event.feedback_submitted && (
                        <span className="hidden sm:flex items-center gap-1 text-[11px] font-medium text-success bg-success/10 rounded-full px-2 py-0.5">
                          <Star className="w-3 h-3 fill-current" />
                          Feedback given
                        </span>
                      )}
                      {event.status === 'completed' && event.feedback_open && !event.feedback_submitted && (
                        <span className="flex items-center gap-1 text-[11px] font-medium text-warning-foreground bg-warning/20 rounded-full px-2 py-0.5">
                          <MessageSquare className="w-3 h-3" />
                          Review pending
                        </span>
                      )}
                      <Badge variant="secondary" className="capitalize text-[11px]">{event.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </Layout>
      <Dialog open={feedbackDialogOpen} onOpenChange={handleFeedbackDialogChange}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Share feedback</DialogTitle>
            {pendingFeedbackEvent && (
              <p className="text-sm text-muted-foreground">
                {pendingFeedbackEvent.title} • {new Date(pendingFeedbackEvent.date).toLocaleString()}
              </p>
            )}
          </DialogHeader>
          {pendingFeedbackEvent ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <p className="text-sm font-medium">Overall experience</p>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Button
                      key={value}
                      type="button"
                      variant={feedbackRating === value ? 'default' : 'outline'}
                      size="sm"
                      className="h-9 w-9 rounded-full p-0"
                      onClick={() => setFeedbackRating(value)}
                    >
                      {value}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">Highlights or suggestions</p>
                <Textarea
                  value={feedbackComments}
                  onChange={(e) => setFeedbackComments(e.target.value)}
                  rows={4}
                  placeholder="Share what went well and what can improve."
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading event info…</p>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleFeedbackDialogChange(false)}
              disabled={feedbackSubmitting}
              className="w-full sm:w-auto"
            >
              Maybe later
            </Button>
            <Button
              type="button"
              onClick={handleSubmitFeedback}
              disabled={feedbackSubmitting || !pendingFeedbackEvent}
              className="gap-2 w-full sm:w-auto"
            >
              {feedbackSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
