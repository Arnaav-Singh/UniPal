// Feedback submission page for participants scanning QR codes.
import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiService } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Star } from 'lucide-react';

export default function FeedbackPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [rating, setRating] = useState<number>(5);
  const [comments, setComments] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle');
  const [error, setError] = useState('');
  const qrCodeParam = searchParams.get('code') || '';
  const isCodeLocked = Boolean(qrCodeParam);

  useEffect(() => {
    if (qrCodeParam) {
      setCode(qrCodeParam);
    }
  }, [qrCodeParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId) return;
    if (!code.trim()) {
      setError('Please enter the feedback code from the coordinator.');
      return;
    }
    if (rating < 1 || rating > 5) {
      setError('Please select a rating between 1 and 5.');
      return;
    }
    setStatus('submitting');
    setError('');
    try {
      await apiService.submitFeedback({
        event_id: eventId,
        rating,
        comments: comments.trim(),
        code: code.trim(),
      });
      setStatus('success');
      toast({
        title: 'Feedback submitted',
        description: 'Thank you for your feedback!',
      });
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (err) {
      setStatus('idle');
      setError(err instanceof Error ? err.message : 'Unable to submit feedback');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 px-4 py-10">
      <Card className="w-full max-w-xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-center">Submit Feedback</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!user && (
            <p className="text-sm text-muted-foreground text-center">
              Please <Link to="/login" className="text-primary underline">log in</Link> before submitting feedback.
            </p>
          )}
          {status === 'success' ? (
            <div className="text-center space-y-4 py-8">
              <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <Star className="w-8 h-8 text-green-600 fill-green-600" />
              </div>
              <div>
                <p className="text-lg font-semibold text-green-600">Thank you!</p>
                <p className="text-sm text-muted-foreground">Your feedback has been submitted successfully.</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="feedbackCode">Feedback Code</Label>
                <input
                  id="feedbackCode"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter the code from the QR"
                  required
                  readOnly={isCodeLocked}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <p className="text-xs text-muted-foreground">
                  {isCodeLocked
                    ? 'Code auto-filled from the scanned QR — just review and submit.'
                    : 'Ask the coordinator for the latest code if it is not pre-filled.'}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Rating</Label>
                <div className="flex gap-2 justify-center">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRating(value)}
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                        rating >= value
                          ? 'bg-yellow-400 text-yellow-900'
                          : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                      }`}
                    >
                      <Star className={`w-6 h-6 ${rating >= value ? 'fill-current' : ''}`} />
                    </button>
                  ))}
                </div>
                <p className="text-xs text-center text-muted-foreground">
                  {rating === 5 && 'Excellent'}
                  {rating === 4 && 'Very Good'}
                  {rating === 3 && 'Good'}
                  {rating === 2 && 'Fair'}
                  {rating === 1 && 'Poor'}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="comments">Comments (optional)</Label>
                <Textarea
                  id="comments"
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Share your thoughts about the event..."
                  rows={4}
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" className="w-full" disabled={status === 'submitting'}>
                {status === 'submitting' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Feedback'
                )}
              </Button>
            </form>
          )}
          {eventId && (
            <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
              <p>Tip: If the QR didn't load, ask the coordinator to regenerate it.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


