// Generates short-lived attendance QR codes for event check-ins.
import { useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Copy, Check, RefreshCcw, Timer } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiService } from '@/services/api';

interface QRCodeGeneratorProps {
  eventId: string;
  eventTitle: string;
}

export function QRCodeGenerator({ eventId, eventTitle }: QRCodeGeneratorProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [attendanceUrl, setAttendanceUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [code, setCode] = useState<string>('');
  const { toast } = useToast();

  // Request a fresh attendance code and render it to a QR image.
  const generateQRCode = useCallback(async () => {
    setLoading(true);
    try {
      const { code, expiresAt } = await apiService.requestAttendanceCode(eventId);
      setCode(code);
      setExpiresAt(expiresAt);
      const urlForQr = await apiService.generateQRCode(eventId, code);
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
    generateQRCode();
  }, [eventId, generateQRCode]);

  const downloadQRCode = () => {
    const link = document.createElement('a');
    link.href = qrCodeUrl;
    const safeCode = code ? `_${code.slice(0, 6)}` : '';
    link.download = `${eventTitle.replace(/\s+/g, '_')}${safeCode}_QR.png`;
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

  return (
    <Card className="bg-gradient-card shadow-card">
      <CardHeader>
        <CardTitle className="text-center">QR Code for {eventTitle}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center space-y-4">
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
            onClick={generateQRCode}
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
