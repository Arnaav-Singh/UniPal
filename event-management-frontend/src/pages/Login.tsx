// Login experience leveraging the shared auth context and toast feedback.
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Calendar, LogIn, UserPlus } from 'lucide-react';

export default function Login() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Authenticate and redirect users toward their dashboards.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(email, password);
      toast({
        title: "Welcome!",
        description: "Successfully logged in to UniPal MIT."
      });
      // Redirect to dashboard after successful login
      navigate('/', { replace: true });
    } catch (error) {
      toast({
        title: "Login Failed",
        description: "Invalid email or password. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const demoAccounts = [
    
  ];

  const fillDemo = (email: string, password: string) => {
    setEmail(email);
    setPassword(password);
  };

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  if (user) {
    return null;
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-48 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/25 blur-3xl" />
        <div className="absolute -bottom-40 left-8 h-72 w-72 rounded-full bg-warning/20 blur-[140px]" />
        <div className="absolute -right-24 top-1/3 h-80 w-80 rounded-full bg-accent/20 blur-[150px]" />
      </div>

      <div className="relative w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="w-20 h-20 bg-gradient-primary rounded-[28px] flex items-center justify-center mx-auto mb-5 shadow-glow">
            <Calendar className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            UniPal MIT
          </h1>
          <p className="text-muted-foreground">
            The event companion for MAHE's Manipal Institute of Technology
          </p>
        </div>

        <Card className="hover:-translate-y-1 hover:shadow-glow">
          <CardHeader>
            <CardTitle>Sign In</CardTitle>
            <CardDescription>
              Enter your credentials to access your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
              </div>
              <Button 
                type="submit" 
                className="w-full gap-2 shadow-button transition-all duration-300 hover:-translate-y-0.5 hover:shadow-glow" 
                disabled={loading}
              >
                <LogIn className="w-4 h-4" />
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="hover:-translate-y-1 hover:shadow-glow">
          <CardContent className="pt-6">
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Don't have an account?
              </p>
              <Button asChild variant="outline" className="w-full gap-2">
                <Link to="/signup">
                  <UserPlus className="w-4 h-4" />
                  Create Account
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
