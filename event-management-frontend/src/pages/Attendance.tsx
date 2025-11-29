// Attendance entry page for participants scanning QR codes.
import { useEffect, useState, useRef, useCallback } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiService } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, PenLine, RotateCcw } from 'lucide-react';

export default function AttendancePage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [registrationId, setRegistrationId] = useState(user?.registration_id ?? '');
  const [signatureData, setSignatureData] = useState('');
  const [hasSignature, setHasSignature] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const hasDrawnRef = useRef(false);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle');
  const [error, setError] = useState('');
  const qrCodeParam = searchParams.get('code') || '';
  const isCodeLocked = Boolean(qrCodeParam);

  useEffect(() => {
    if (qrCodeParam) {
      setCode(qrCodeParam);
    }
  }, [qrCodeParam]);

  useEffect(() => {
    if (!registrationId && user?.registration_id) {
      setRegistrationId(user.registration_id);
    }
  }, [registrationId, user?.registration_id]);

  const initialiseCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    const width = parent?.clientWidth ?? 600;
    const height = parent?.clientHeight ?? 220;
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

  useEffect(() => {
    initialiseCanvas();
  }, [initialiseCanvas]);

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
    if (!canvas) {
      return { x: 0, y: 0 };
    }
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const persistSignature = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    setSignatureData(dataUrl);
    setHasSignature(true);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!contextRef.current) return;
    event.preventDefault();
    const { x, y } = getRelativePoint(event);
    contextRef.current.beginPath();
    contextRef.current.moveTo(x, y);
    setIsDrawing(true);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch (_) {
      // Pointer capture not supported on this device.
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !contextRef.current) return;
    event.preventDefault();
    const { x, y } = getRelativePoint(event);
    contextRef.current.lineTo(x, y);
    contextRef.current.stroke();
    if (!hasDrawnRef.current) {
      hasDrawnRef.current = true;
    }
  };

  const finishDrawing = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !contextRef.current) return;
    event.preventDefault();
    setIsDrawing(false);
    contextRef.current.closePath();
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch (_) {
      // Ignore release failures
    }
    if (hasDrawnRef.current) {
      persistSignature();
    }
    hasDrawnRef.current = false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId) return;
    if (!code.trim()) {
      setError('Please enter the attendance code from the coordinator.');
      return;
    }
    if (!registrationId.trim()) {
      setError('Please enter your college registration number.');
      return;
    }
    if (!signatureData) {
      setError('Please sign inside the box before submitting.');
      return;
    }
    setStatus('submitting');
    setError('');
    try {
      await apiService.checkInWithCode(eventId, {
        code: code.trim(),
        registrationId: registrationId.trim(),
        signature: signatureData,
      });
      setStatus('success');
      toast({
        title: 'Attendance marked',
        description: 'Your attendance has been recorded for this event.',
      });
      clearSignature();
      navigate('/');
    } catch (err) {
      setStatus('idle');
      setError(err instanceof Error ? err.message : 'Unable to mark attendance');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4 py-10">
      <Card className="w-full max-w-xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-center">Mark Attendance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!user && (
            <p className="text-sm text-muted-foreground text-center">
              Please <Link to="/login" className="text-primary underline">log in</Link> before marking attendance.
            </p>
          )}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="attendanceCode">Attendance Code</Label>
              <Input
                id="attendanceCode"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Enter the 16-character code from the QR"
                required
                readOnly={isCodeLocked}
              />
              <p className="text-xs text-muted-foreground">
                {isCodeLocked
                  ? 'Code auto-filled from the scanned QR — just review and submit.'
                  : 'Ask the coordinator for the latest code if it is not pre-filled.'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="registrationId">College Registration Number</Label>
              <Input
                id="registrationId"
                value={registrationId}
                onChange={(e) => setRegistrationId(e.target.value.toUpperCase())}
                placeholder="e.g. 21BCS1234"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium">
                <PenLine className="h-4 w-4 text-muted-foreground" />
                Signature
              </Label>
              <p className="text-xs text-muted-foreground">
                Use your finger or mouse to sign inside the box. Signature is required for reports.
              </p>
              <div className="rounded-md border bg-white">
                <canvas
                  ref={canvasRef}
                  className="h-48 w-full touch-none rounded-md"
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={finishDrawing}
                  onPointerLeave={finishDrawing}
                  onPointerCancel={finishDrawing}
                />
              </div>
              <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <span>{hasSignature ? 'Signature captured. Submit to finish.' : 'Signature is saved automatically when you lift your finger.'}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={clearSignature}
                  disabled={status === 'submitting'}
                >
                  <RotateCcw className="h-4 w-4" />
                  Clear signature
                </Button>
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full gap-2" disabled={status === 'submitting'}>
              {status === 'submitting' && <Loader2 className="h-4 w-4 animate-spin" />}
              {status === 'submitting' ? 'Marking attendance…' : 'Mark Attendance'}
            </Button>
          </form>
          {eventId && (
            <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
              <p>Tip: If the QR didn’t load, ask the coordinator to regenerate it.</p>
              <p className="flex items-center gap-2">
                <span className="font-medium text-foreground">Coordinator View:</span>
                <span>They can open the QR from the dashboard.</span>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
