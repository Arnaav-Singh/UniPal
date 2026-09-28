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
        <div className="absolute -top-40 -left-20 h-96 w-96 rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute -top-48 right-0 h-96 w-96 rounded-full bg-warning/10 blur-[120px]" />
        <div className="absolute bottom-0 left-1/2 h-[32rem] w-[32rem] -translate-x-1/2 translate-y-1/3 rounded-full bg-accent/10 blur-[150px]" />
      </div>

      <header className="relative bg-card/60 backdrop-blur-md border-b border-border/40 sticky top-0 z-50 transition-all duration-300">
        <div className="container mx-auto px-4 py-3 flex flex-col gap-4 sm:h-16 sm:flex-row sm:items-center sm:justify-between sm:py-0">
          <div className="flex items-center justify-between sm:justify-start gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 bg-gradient-primary rounded-xl flex items-center justify-center shadow-glow shrink-0">
                <Calendar className="w-5 h-5 text-white drop-shadow-md" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-semibold bg-gradient-primary bg-clip-text text-transparent tracking-tight">
                  UniPal MIT
                </h1>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Manipal Institute of Technology · {title}</p>
              </div>
            </div>
            {/* Mobile Logout Shortcut could go here if needed, but keeping it simple for now */}
          </div>

          {user && (
            <div className="flex items-center justify-between sm:justify-end gap-3 border-t pt-3 sm:border-t-0 sm:pt-0">
              <div className="flex items-center gap-3">
                <div className="text-left sm:text-right">
                  <p className="text-sm font-medium leading-none">{user.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 sm:justify-end">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${getRoleColor(user.role)}`}>
                      {user.role === 'dean' || user.role === 'superadmin'
                        ? 'Dean'
                        : user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                    </span>
                    {user.school && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 tracking-wide uppercase hidden xs:inline-flex">
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
                className="h-8 gap-2 shadow-button transition-all duration-300 hover:-translate-y-0.5 hover:shadow-glow shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="sr-only sm:not-sr-only">Logout</span>
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
