// Provides QR scanning UI with manual entry fallback for attendance.
import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Camera, Type, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';

interface QRScannerProps {
  onScanSuccess: (payload: { eventId: string; code?: string }) => void;
}

export function QRScanner({ onScanSuccess }: QRScannerProps) {
  const [manualInput, setManualInput] = useState('');
  const [scanError, setScanError] = useState<string | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Initialize scanner on mount
    const scanner = new Html5QrcodeScanner(
      "reader",
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        rememberLastUsedCamera: true,
        showTorchButtonIfSupported: true
      },
      /* verbose= */ false
    );

    scanner.render(onScanSuccessCallback, onScanFailureCallback);
    scannerRef.current = scanner;

    // Cleanup on unmount
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(error => {
          console.error("Failed to clear scanner", error);
        });
      }
    };
  }, []);

  const onScanSuccessCallback = (decodedText: string) => {
    // Stop scanning after success to prevent multiple triggers
    if (scannerRef.current) {
      scannerRef.current.pause();
    }
    handleScanResult(decodedText);
  };

  const onScanFailureCallback = (errorMessage: string) => {
    // Ignore scan errors as they happen frequently when no QR is in view
    // console.warn(`Code scan error = ${errorMessage}`);
  };

  const handleScanResult = (result: string) => {
    let eventId = result;
    let code: string | undefined;

    try {
      if (result.startsWith('http')) {
        const url = new URL(result);
        // Extract from path: /attendance/:eventId
        if (url.pathname.includes('/attendance/')) {
          const parts = url.pathname.split('/attendance/');
          if (parts[1]) {
            eventId = parts[1];
          }
        }
        // Extract query param: ?code=...
        const codeParam = url.searchParams.get('code');
        if (codeParam) {
          code = codeParam;
        }
      }
    } catch (e) {
      console.error("Error parsing QR result", e);
    }

    onScanSuccess({ eventId, code });
  };

  // Parse manual URLs or identifiers into event/code pairs.
  const handleManualSubmit = () => {
    const input = manualInput.trim();
    if (!input) return;
    handleScanResult(input);
    setManualInput('');
  };

  return (
    <Card className="bg-gradient-card shadow-card border-0">
      <CardHeader>
        <CardTitle className="text-center">Scan QR Code</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col items-center justify-center min-h-[300px] bg-black/5 rounded-lg overflow-hidden">
          <div id="reader" className="w-full"></div>
          {scanError && (
            <div className="p-4 text-destructive flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <p className="text-sm">{scanError}</p>
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
