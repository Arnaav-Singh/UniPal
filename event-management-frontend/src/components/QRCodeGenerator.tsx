// Generates short-lived attendance QR codes for event check-ins.
// For multi-day events, provides a day selector to generate separate codes per day.
import { useState, useEffect, useCallback, useMemo } from 'react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Copy, Check, RefreshCcw, Timer, CalendarDays } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiService } from '@/services/api';

interface QRCodeGeneratorProps {
  eventId: string;
  eventTitle: string;
  startDate?: string;
  endDate?: string;
}

// Produce an array of date strings between start and end (inclusive).
function getDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const startDt = new Date(start);
  const endDt = new Date(end);
  
  // Normalise to midnight to ensure day-level comparison.
  startDt.setHours(0, 0, 0, 0);
  endDt.setHours(0, 0, 0, 0);
  
  if (isNaN(startDt.getTime()) || isNaN(endDt.getTime()) || endDt < startDt) return [];
  
  const cursor = new Date(startDt);
  while (cursor <= endDt) {
    dates.push(cursor.toISOString().split('T')[0]); // YYYY-MM-DD
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

export function QRCodeGenerator({ eventId, eventTitle, startDate, endDate }: QRCodeGeneratorProps) {
  const days = useMemo(() => {
    if (startDate && endDate) {
      const range = getDateRange(startDate, endDate);
      return range.length > 1 ? range : [];
    }
    return [];
  }, [startDate, endDate]);

  const isMultiDay = days.length > 1;

  const [selectedDay, setSelectedDay] = useState<string | undefined>(isMultiDay ? days[0] : undefined);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [attendanceUrl, setAttendanceUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [code, setCode] = useState<string>('');
  const { toast } = useToast();

  // Request a fresh attendance code and render it to a QR image.
  const generateQRCode = useCallback(async (dayDate?: string) => {
    setLoading(true);
    try {
      const result = await apiService.requestAttendanceCode(eventId, dayDate);
      setCode(result.code);
      setExpiresAt(result.expiresAt);
      const urlForQr = await apiService.generateQRCode(eventId, result.code);
      setAttendanceUrl(urlForQr);
      const url = await QRCode.toDataURL(urlForQr, {
        width: 300,
        margin: 2,
        color: {
          dark: '#1e40af',
          light: '#ffffff'
        }
      });
      setQrCodeUrl(url);
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast({
        title: "Error",
        description: "Failed to generate QR code",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [eventId, toast]);

  useEffect(() => {
    generateQRCode(selectedDay);
  }, [eventId, selectedDay, generateQRCode]);

  const downloadQRCode = () => {
    const link = document.createElement('a');
    link.href = qrCodeUrl;
    const safeCode = code ? `_${code.slice(0, 6)}` : '';
    const dayLabel = selectedDay ? `_${selectedDay}` : '';
    link.download = `${eventTitle.replace(/\s+/g, '_')}${dayLabel}${safeCode}_QR.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Download Complete",
      description: "QR code has been downloaded successfully"
    });
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(attendanceUrl || `${window.location.origin}/attendance/${eventId}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      
      toast({
        title: "Copied!",
        description: "Attendance URL copied to clipboard"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy URL",
        variant: "destructive"
      });
    }
  };

  const formatDayLabel = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <Card className="bg-gradient-card shadow-card">
      <CardHeader>
        <CardTitle className="text-center">
          QR Code for {eventTitle}
          {isMultiDay && selectedDay && (
            <span className="block text-sm font-normal text-muted-foreground mt-1">
              Day: {formatDayLabel(selectedDay)}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center space-y-4">
        {/* Multi-day selector */}
        {isMultiDay && (
          <div className="w-full">
            <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
              <CalendarDays className="w-4 h-4" />
              <span>Select day</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {days.map((day) => (
                <Button
                  key={day}
                  variant={selectedDay === day ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedDay(day)}
                  className="text-xs"
                >
                  {formatDayLabel(day)}
                </Button>
              ))}
            </div>
          </div>
        )}

        {qrCodeUrl && (
          <div className="bg-white p-4 rounded-lg shadow-inner">
            <img src={qrCodeUrl} alt="QR Code" className="w-64 h-64" />
          </div>
        )}
        {loading && !qrCodeUrl && (
          <p className="text-sm text-muted-foreground">Generating secure attendance code…</p>
        )}
        
        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            Students can scan this QR code to mark attendance
          </p>
          <code className="text-xs bg-muted px-2 py-1 rounded break-all">
            {attendanceUrl || `${window.location.origin}/attendance/${eventId}`}
          </code>
          {expiresAt && (
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Timer className="w-3 h-3" />
              <span>Expires at {new Date(expiresAt).toLocaleTimeString()}</span>
            </div>
          )}
        </div>
        
        <div className="flex gap-2 w-full">
          <Button 
            onClick={downloadQRCode} 
            variant="default"
            className="flex-1 gap-2"
          >
            <Download className="w-4 h-4" />
            Download
          </Button>
          <Button 
            onClick={copyToClipboard} 
            variant="secondary"
            className="flex-1 gap-2"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy URL'}
          </Button>
          <Button
            onClick={() => generateQRCode(selectedDay)}
            variant="outline"
            className="flex-1 gap-2"
            disabled={loading}
          >
            <RefreshCcw className="w-4 h-4" />
            Refresh Code
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
