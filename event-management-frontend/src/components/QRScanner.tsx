// Provides QR scanning UI with manual entry fallback for attendance.
import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Camera, Type } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface QRScannerProps {
  onScanSuccess: (payload: { eventId: string; code?: string }) => void;
}

export function QRScanner({ onScanSuccess }: QRScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Request camera access and stream it into the preview element.
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsScanning(true);
      }
    } catch (error) {
      toast({
        title: "Camera Error",
        description: "Unable to access camera. Please allow camera permissions.",
        variant: "destructive"
      });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  };

  // Parse manual URLs or identifiers into event/code pairs.
  const handleManualSubmit = () => {
    const input = manualInput.trim();
    if (!input) return;

    let eventId = input;
    let code: string | undefined;

    try {
      if (input.startsWith('http')) {
        const url = new URL(input);
        const parts = url.pathname.split('/');
        const idFromPath = parts[parts.indexOf('attendance') + 1];
        if (idFromPath) {
          eventId = idFromPath;
        }
        const codeParam = url.searchParams.get('code');
        if (codeParam) {
          code = codeParam;
        }
      } else if (input.includes('/attendance/')) {
        const [_, slug] = input.split('/attendance/');
        if (slug) {
          const [idPart, query] = slug.split('?');
          eventId = idPart;
          if (query) {
            const params = new URLSearchParams(query);
            code = params.get('code') || undefined;
          }
        }
      }
    } catch (_) {
      // fallback to direct input
    }

    onScanSuccess({ eventId, code });
    setManualInput('');
  };

  // Simulated QR detection (in real app, you'd use a proper QR scanning library)
  const simulateQRScan = () => {
    const mockEventId = 'demo-event-id';
    const mockCode = 'samplecode1234';
    onScanSuccess({ eventId: mockEventId, code: mockCode });
    stopCamera();
    toast({
      title: "Attendance Marked!",
      description: "Successfully scanned QR code and marked attendance."
    });
  };

  return (
    <Card className="bg-gradient-card shadow-card">
      <CardHeader>
        <CardTitle className="text-center">Scan QR Code</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="aspect-square bg-muted rounded-lg flex items-center justify-center relative overflow-hidden">
          {isScanning ? (
            <>
              <video 
                ref={videoRef}
                autoPlay 
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 border-2 border-accent/50 rounded-lg">
                <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-accent"></div>
                <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-accent"></div>
                <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-accent"></div>
                <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-accent"></div>
              </div>
            </>
          ) : (
            <div className="text-center text-muted-foreground">
              <Camera className="w-16 h-16 mx-auto mb-2" />
              <p>Camera view will appear here</p>
            </div>
          )}
        </div>

        <div className="space-y-2">
          {!isScanning ? (
            <Button onClick={startCamera} className="w-full gap-2">
              <Camera className="w-4 h-4" />
              Start Camera
            </Button>
          ) : (
            <div className="space-y-2">
              <Button onClick={simulateQRScan} className="w-full">
                Simulate QR Scan (Demo)
              </Button>
              <Button onClick={stopCamera} variant="outline" className="w-full">
                Stop Camera
              </Button>
            </div>
          )}
        </div>

        <div className="border-t pt-4">
          <p className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
            <Type className="w-4 h-4" />
            Or enter event code manually:
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="Enter attendance URL or event ID"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleManualSubmit()}
            />
            <Button onClick={handleManualSubmit} variant="secondary">
              Submit
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
