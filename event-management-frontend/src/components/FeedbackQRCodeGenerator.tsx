// Generates short-lived feedback QR codes for event feedback submission.
import { useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Download, Copy, Check, RefreshCcw, Timer } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiService } from '@/services/api';

interface FeedbackQRCodeGeneratorProps {
  eventId: string;
  eventTitle: string;
}

export function FeedbackQRCodeGenerator({ eventId, eventTitle }: FeedbackQRCodeGeneratorProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [feedbackUrl, setFeedbackUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [code, setCode] = useState<string>('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const { toast } = useToast();

  // Request a fresh feedback code and render it to a QR image.
  const generateQRCode = useCallback(async () => {
    setLoading(true);
    try {
      const { code, expiresAt } = await apiService.requestFeedbackCode(eventId);
      setCode(code);
      setExpiresAt(expiresAt);
      const urlForQr = await apiService.generateFeedbackQRCode(eventId, code, isAnonymous);
      setFeedbackUrl(urlForQr);
      const url = await QRCode.toDataURL(urlForQr, {
        width: 300,
        margin: 2,
        color: {
          dark: '#059669',
          light: '#ffffff'
        }
      });
      setQrCodeUrl(url);
    } catch (error) {
      console.error('Error generating feedback QR code:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate feedback QR code",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [eventId, isAnonymous, toast]);

  useEffect(() => {
    generateQRCode();
  }, [eventId, isAnonymous, generateQRCode]);

  const downloadQRCode = () => {
    const link = document.createElement('a');
    link.href = qrCodeUrl;
    const safeCode = code ? `_${code.slice(0, 6)}` : '';
    link.download = `${eventTitle.replace(/\s+/g, '_')}_Feedback${safeCode}_QR.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Download Complete",
      description: "Feedback QR code has been downloaded successfully"
    });
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(feedbackUrl || `${window.location.origin}/feedback/${eventId}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      
      toast({
        title: "Copied!",
        description: "Feedback URL copied to clipboard"
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
        <CardTitle className="text-center">Feedback QR Code for {eventTitle}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center space-y-4">
        
        <div className="flex items-center space-x-2 bg-muted/50 p-2 rounded-md border text-sm w-full justify-center">
          <Switch id="anonymous-mode" checked={isAnonymous} onCheckedChange={setIsAnonymous} />
          <Label htmlFor="anonymous-mode" className="cursor-pointer font-medium">Accept Anonymous Feedback</Label>
        </div>

        {qrCodeUrl && (
          <div className="bg-white p-4 rounded-lg shadow-inner">
            <img src={qrCodeUrl} alt="Feedback QR Code" className="w-64 h-64" />
          </div>
        )}
        {loading && !qrCodeUrl && (
          <p className="text-sm text-muted-foreground">Generating secure feedback code…</p>
        )}
        
        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            Students can scan this QR code to submit feedback
          </p>
          <code className="text-xs bg-muted px-2 py-1 rounded break-all">
            {feedbackUrl || `${window.location.origin}/feedback/${eventId}`}
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


