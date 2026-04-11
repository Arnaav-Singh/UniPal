// Compact event summary card with coordinator action shortcuts.
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Event } from '@/types';
import { Calendar, MapPin, QrCode, Users, FileText, UserPlus, XCircle, Trash2, Lock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface EventCardProps {
  event: Event;
  onViewDetails?: () => void;
  onGenerateQR?: () => void;
  onGenerateGoogleFormQR?: () => void;
  onViewAttendance?: () => void;
  onManageInvites?: () => void;
  onCancelEvent?: () => void;
  onDeleteEvent?: () => void;
}

export function EventCard({ event, onViewDetails, onGenerateQR, onGenerateGoogleFormQR, onViewAttendance, onManageInvites, onCancelEvent, onDeleteEvent }: EventCardProps) {
  const { user } = useAuth();

  // Present event dates in a readable multi-part format, including the stored time when available.
  const formatDate = (dateString: string, time?: string) => {
    const dateTimeString = time ? `${dateString}T${time}` : `${dateString}T00:00`;
    return new Date(dateTimeString).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isUpcoming = new Date(event.date) > new Date();
  const awaitingApproval = event.approval_status !== 'approved';
  const isCancelled = event.status === 'cancelled';
  const isCoordinatorOrDean = user?.role === 'coordinator' || user?.role === 'dean';

  return (
    <Card className={`group bg-gradient-card shadow-card hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border border-border/50 ${isCancelled ? 'opacity-60' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <CardTitle className="text-lg font-semibold text-foreground line-clamp-2">
            {event.title}
          </CardTitle>
          <div className="flex flex-row flex-wrap items-center gap-2 sm:flex-col sm:items-end">
            {isCancelled ? (
              <Badge variant="destructive" className="w-fit">
                Cancelled
              </Badge>
            ) : (
              <Badge variant={isUpcoming ? 'default' : 'secondary'} className="w-fit">
                {isUpcoming ? 'Upcoming' : 'Past'}
              </Badge>
            )}
            <Badge variant={awaitingApproval ? 'outline' : 'secondary'} className="capitalize w-fit">
              {event.approval_status}
            </Badge>
            {event.attendance_closed && !isCancelled && (
              <Badge variant="outline" className="text-orange-600 border-orange-300 w-fit">
                <Lock className="w-3 h-3 mr-1" />
                Attendance Closed
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm line-clamp-3">
          {event.description}
        </p>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-accent" />
            <span>{formatDate(event.date, (event as { time?: string }).time)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-accent" />
            <span>{event.location}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline" className="capitalize">{event.category.replace('-', ' ')}</Badge>
            <Badge variant="outline" className="capitalize">{event.delivery_mode.replace('-', ' ')}</Badge>
            <Badge variant="outline">{event.invitation_mode === 'invite-only' ? 'Invite-only' : 'Open'}</Badge>
            {!isCancelled && <Badge variant="outline" className="capitalize">{event.status}</Badge>}
            {event.tags.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="secondary">#{tag}</Badge>
            ))}
          </div>
        </div>

        {/* Approval lockout warning */}
        {awaitingApproval && isCoordinatorOrDean && !isCancelled && (
          <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-xs text-amber-800 flex items-center gap-2">
            <Lock className="w-3 h-3 shrink-0" />
            <span>Actions locked until the dean approves this event.</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 pt-2 sm:flex sm:flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={onViewDetails}
            className="col-span-2 sm:col-span-1 sm:flex-1 min-w-24"
          >
            View Details
          </Button>

          {user?.role === 'coordinator' && !isCancelled && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onManageInvites}
                className="gap-1"
                disabled={awaitingApproval}
              >
                <UserPlus className="w-4 h-4" />
                Invite
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={onGenerateQR}
                className="gap-1"
                disabled={awaitingApproval}
              >
                <QrCode className="w-4 h-4" />
                QR Code
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onGenerateGoogleFormQR}
                className="gap-1"
                disabled={awaitingApproval}
              >
                <FileText className="w-4 h-4" />
                Form QR
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={onViewAttendance}
                className="gap-1"
                disabled={awaitingApproval}
              >
                <Users className="w-4 h-4" />
                Attendance
              </Button>
            </>
          )}

          {/* Cancel button — coordinator/dean can cancel approved, non-cancelled events */}
          {isCoordinatorOrDean && onCancelEvent && !isCancelled && (
            <Button
              variant="outline"
              size="sm"
              onClick={onCancelEvent}
              className="gap-1 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
              disabled={awaitingApproval}
            >
              <XCircle className="w-4 h-4" />
              Cancel
            </Button>
          )}

          {/* Delete button — only for cancelled events */}
          {isCoordinatorOrDean && onDeleteEvent && isCancelled && (
            <Button
              variant="destructive"
              size="sm"
              onClick={onDeleteEvent}
              className="gap-1"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
