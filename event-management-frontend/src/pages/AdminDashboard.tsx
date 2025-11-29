// Admin dashboard offering event creation and system metrics.
import { useState, useEffect, useCallback } from 'react';
import { Layout } from '@/components/Layout';
import { EventCard } from '@/components/EventCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Calendar, Users, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Event, User } from '@/types';
import { apiService } from '@/services/api';

export default function AdminDashboard() {
  const [events, setEvents] = useState<Event[]>([]);
  const [coordinators, setCoordinators] = useState<User[]>([]);
  const [stats, setStats] = useState({
    totalEvents: 0,
    totalUsers: 0,
    totalCoordinators: 0,
    thisMonthEvents: 0
  });
  const [isCreating, setIsCreating] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    date: '',
    location: '',
    assigned_coordinator: '',
    google_form_url: ''
  });
  const { toast } = useToast();

  // Load events, available coordinators, and overview stats.
  const loadData = useCallback(async () => {
    try {
      const [eventsData, coordinatorsData, statsData] = await Promise.all([
        apiService.getEvents(),
        apiService.getCoordinators(),
        apiService.getAdminStats()
      ]);
      setEvents(eventsData);
      setCoordinators(coordinatorsData);
      setStats(statsData);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load dashboard data",
        variant: "destructive"
      });
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Create an event on behalf of administrators and refresh stats.
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const event = await apiService.createEvent(newEvent);
      setEvents([event, ...events]);
      setNewEvent({ title: '', description: '', date: '', location: '', assigned_coordinator: '', google_form_url: '' });
      setIsCreating(false);
      
      toast({
        title: "Event Created",
        description: `${event.title} has been created successfully.`
      });

      // Refresh stats
      const updatedStats = await apiService.getAdminStats();
      setStats(updatedStats);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create event",
        variant: "destructive"
      });
    }
  };

  const statsDisplay = [
    { label: 'Total Events', value: stats.totalEvents, icon: Calendar, color: 'bg-primary' },
    { label: 'This Month', value: stats.thisMonthEvents, icon: Clock, color: 'bg-accent' },
    { label: 'Coordinators', value: stats.totalCoordinators, icon: Users, color: 'bg-success' }
  ];

  return (
    <Layout title="Admin Dashboard">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">Manage events and coordinators</p>
          </div>
          <Dialog open={isCreating} onOpenChange={setIsCreating}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Create Event
              </Button>
            </DialogTrigger>
            <DialogContent className="w-full max-w-md sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Create New Event</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateEvent} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Event Title</Label>
                  <Input
                    id="title"
                    value={newEvent.title}
                    onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                    placeholder="Enter event title"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newEvent.description}
                    onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                    placeholder="Enter event description"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date">Date & Time</Label>
                  <Input
                    id="date"
                    type="datetime-local"
                    value={newEvent.date}
                    onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={newEvent.location}
                    onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                    placeholder="Enter event location"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="coordinator">Assign Coordinator</Label>
                  <Select value={newEvent.assigned_coordinator} onValueChange={(value) => setNewEvent({ ...newEvent, assigned_coordinator: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select coordinator" />
                    </SelectTrigger>
                    <SelectContent>
                      {coordinators.map((coord) => (
                        <SelectItem key={coord.id} value={coord.id}>
                          {coord.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="googleFormUrl">Google Form URL (Optional)</Label>
                  <Input
                    id="googleFormUrl"
                    type="url"
                    value={newEvent.google_form_url}
                    onChange={(e) => setNewEvent({ ...newEvent, google_form_url: e.target.value })}
                    placeholder="https://docs.google.com/forms/d/..."
                  />
                  <p className="text-xs text-muted-foreground">
                    Add a Google Form URL to generate QR codes for attendee feedback and registration
                  </p>
                </div>
                <div className="flex flex-col gap-2 pt-4 sm:flex-row">
                  <Button type="submit" className="w-full sm:flex-1">Create Event</Button>
                  <Button type="button" variant="outline" onClick={() => setIsCreating(false)} className="w-full sm:flex-1">Cancel</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {statsDisplay.map((stat) => (
            <Card key={stat.label} className="bg-gradient-card shadow-card border-0">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-lg ${stat.color} flex items-center justify-center`}>
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="bg-gradient-card shadow-card border-0">
          <CardHeader>
            <CardTitle>All Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {events.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  onViewDetails={() => console.log('View details:', event.id)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
