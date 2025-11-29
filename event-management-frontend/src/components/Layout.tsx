// Shared dashboard layout with gradient chrome and role-aware header.
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LogOut, Calendar } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  title: string;
}

export function Layout({ children, title }: LayoutProps) {
  const { user, logout } = useAuth();

  // Theme badges to match the user's current role.
  const getRoleColor = (role: string) => {
    switch (role) {
      case 'dean':
      case 'superadmin':
        return 'bg-gradient-to-r from-amber-500 to-orange-500 text-black';
      case 'coordinator':
        return 'bg-warning text-warning-foreground';
      case 'student':
        return 'bg-success text-success-foreground';
      case 'admin':
        return 'bg-destructive text-destructive-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -left-20 h-72 w-72 rounded-full bg-primary/18 blur-[140px]" />
        <div className="absolute -top-48 right-0 h-80 w-80 rounded-full bg-warning/18 blur-[160px]" />
        <div className="absolute bottom-0 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 translate-y-1/3 rounded-full bg-accent/14 blur-[220px]" />
      </div>

      <header className="relative bg-card/70 backdrop-blur-xl border-b border-white/40 dark:border-white/10 shadow-card sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex flex-col gap-4 sm:h-16 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <div className="w-11 h-11 bg-gradient-primary rounded-xl flex items-center justify-center shadow-glow">
              <Calendar className="w-5 h-5 text-white drop-shadow-md" />
            </div>
            <div>
              <h1 className="text-xl font-semibold bg-gradient-primary bg-clip-text text-transparent tracking-tight">
                UniPal MIT
              </h1>
              <p className="text-xs text-muted-foreground">Manipal Institute of Technology · {title}</p>
            </div>
          </div>
          
          {user && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex items-center gap-3 sm:justify-end">
                <div className="text-center sm:text-right">
                  <p className="text-sm font-medium">{user.name}</p>
                  <div className="mt-1 flex flex-wrap items-center justify-center gap-2 sm:justify-end">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getRoleColor(user.role)}`}>
                      {user.role === 'dean' || user.role === 'superadmin'
                        ? 'Dean'
                        : user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </span>
                    {user.school && (
                      <Badge variant="outline" className="text-[10px] tracking-wide uppercase">
                        {user.school}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={logout}
                className="gap-2 shadow-button transition-all duration-300 hover:-translate-y-0.5 hover:shadow-glow"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </Button>
            </div>
          )}
        </div>
      </header>

      <main className="relative z-10 container mx-auto px-3 py-6 sm:px-4 sm:py-10">
        {children}
      </main>
    </div>
  );
}
