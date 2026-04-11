import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Search, Menu, X, Shield } from 'lucide-react';

export default function Navbar() {
  const { user, isAdmin, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-background/95 to-transparent backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link to="/" className="text-2xl font-bold text-primary tracking-tight">
              PlexStream
            </Link>
            <div className="hidden md:flex items-center gap-6">
              <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Home</Link>
              <Link to="/browse" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Browse</Link>
              <Link to="/requests" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Requests</Link>
              {isAdmin && (
                <Link to="/admin" className="text-sm text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
                  <Shield className="w-4 h-4" />
                  Admin
                </Link>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/browse')}>
              <Search className="w-5 h-5" />
            </Button>
            {user ? (
              <div className="flex items-center gap-3">
                <span className="hidden sm:inline text-sm text-muted-foreground">{user.email}</span>
                <Button variant="outline" size="sm" onClick={signOut}>Sign Out</Button>
              </div>
            ) : (
              <Button variant="default" size="sm" onClick={() => navigate('/auth')}>Sign In</Button>
            )}
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden bg-card/95 backdrop-blur-md border-b border-border">
          <div className="px-4 py-3 space-y-2">
            <Link to="/" className="block py-2 text-muted-foreground hover:text-foreground" onClick={() => setMenuOpen(false)}>Home</Link>
            <Link to="/browse" className="block py-2 text-muted-foreground hover:text-foreground" onClick={() => setMenuOpen(false)}>Browse</Link>
            <Link to="/requests" className="block py-2 text-muted-foreground hover:text-foreground" onClick={() => setMenuOpen(false)}>Requests</Link>
            {isAdmin && (
              <Link to="/admin" className="block py-2 text-primary" onClick={() => setMenuOpen(false)}>Admin Panel</Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
