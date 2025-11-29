// Facilitates QR code generation for Google Form links tied to events.
import { useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, Copy, Check, ExternalLink, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface GoogleFormQRGeneratorProps {
  eventId: string;
  eventTitle: string;
  googleFormUrl?: string;
  onFormUrlChange?: (url: string) => void;
}

export function GoogleFormQRGenerator({ 
  eventId, 
  eventTitle, 
  googleFormUrl = '', 
  onFormUrlChange 
}: GoogleFormQRGeneratorProps) {
  const [formUrl, setFormUrl] = useState(googleFormUrl);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isValidUrl, setIsValidUrl] = useState(false);
  const { toast } = useToast();

  // Build a data URI for the QR code so it can be rendered or downloaded.
  const generateQRCode = useCallback(async (url: string) => {
    if (!url || !isValidGoogleFormUrl(url)) return;
    
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(url, {
        width: 300,
        margin: 2,
        color: {
          dark: '#1e40af',
          light: '#ffffff'
        }
      });
      setQrCodeUrl(qrCodeDataUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast({
        title: "Error",
        description: "Failed to generate QR code",
        variant: "destructive"
      });
    }
  }, [toast]);

  const isValidGoogleFormUrl = (url: string): boolean => {
    const googleFormRegex = /^https:\/\/docs\.google\.com\/forms\/d\/[a-zA-Z0-9_-]+\/.*$/;
    return googleFormRegex.test(url);
  };

  const handleUrlChange = (url: string) => {
    setFormUrl(url);
    setIsValidUrl(isValidGoogleFormUrl(url));
    onFormUrlChange?.(url);
  };

  useEffect(() => {
    if (formUrl && isValidUrl) {
      generateQRCode(formUrl);
    }
  }, [formUrl, isValidUrl, generateQRCode]);

  const downloadQRCode = () => {
    if (!qrCodeUrl) return;
    
    const link = document.createElement('a');
    link.href = qrCodeUrl;
    link.download = `${eventTitle.replace(/\s+/g, '_')}_GoogleForm_QR.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Download Complete",
      description: "Google Form QR code has been downloaded successfully"
    });
  };

  const copyToClipboard = async () => {
    if (!formUrl) return;
    
    try {
      await navigator.clipboard.writeText(formUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      
      toast({
        title: "Copied!",
        description: "Google Form URL copied to clipboard"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy URL",
        variant: "destructive"
      });
    }
  };

  const openFormInNewTab = () => {
    if (!formUrl) return;
    window.open(formUrl, '_blank');
  };

  return (
    <Card className="bg-gradient-card shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Google Form QR Code for {eventTitle}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="googleFormUrl">Google Form URL</Label>
          <div className="flex gap-2">
            <Input
              id="googleFormUrl"
              type="url"
              value={formUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://docs.google.com/forms/d/..."
              className={isValidUrl ? 'border-green-500' : formUrl ? 'border-red-500' : ''}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openFormInNewTab}
              disabled={!formUrl || !isValidUrl}
            >
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
          {formUrl && !isValidUrl && (
            <p className="text-sm text-red-500">
              Please enter a valid Google Form URL
            </p>
          )}
          {isValidUrl && (
            <p className="text-sm text-green-600">
              ✓ Valid Google Form URL
            </p>
          )}
        </div>

        {qrCodeUrl && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-lg shadow-inner flex justify-center">
              <img src={qrCodeUrl} alt="Google Form QR Code" className="w-64 h-64" />
            </div>
            
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Attendees can scan this QR code to access the Google Form
              </p>
              <div className="flex gap-2 justify-center">
                <code className="text-xs bg-muted px-2 py-1 rounded break-all max-w-xs">
                  {formUrl}
                </code>
              </div>
            </div>
            
            <div className="flex gap-2 w-full">
              <Button 
                onClick={downloadQRCode} 
                variant="default"
                className="flex-1 gap-2"
              >
                <Download className="w-4 h-4" />
                Download QR
              </Button>
              <Button 
                onClick={copyToClipboard} 
                variant="secondary"
                className="flex-1 gap-2"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy URL'}
              </Button>
            </div>
          </div>
        )}

        {!formUrl && (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Enter a Google Form URL to generate QR code</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
