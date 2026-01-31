import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, Trophy, Bell, BellOff } from 'lucide-react';
import { Button } from '@/components/common';
import { useAuthStore } from '@/store';
import { api } from '@/services/api';

const DISMISS_KEY = 'event_notification_dismissed';
const DISMISS_UNTIL_KEY = 'event_notification_dismissed_until';

interface ActiveEvent {
  id: string;
  title: string;
  type: string;
  pointsReward: number;
}

export function EventNotification() {
  const { isAuthenticated } = useAuthStore();
  const [events, setEvents] = useState<ActiveEvent[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissedForever, setIsDismissedForever] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Check if permanently dismissed
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed === 'true') {
      setIsDismissedForever(true);
      return;
    }

    // Check if temporarily dismissed (until next login/session)
    const dismissedUntil = localStorage.getItem(DISMISS_UNTIL_KEY);
    if (dismissedUntil) {
      const sessionStart = sessionStorage.getItem('session_start');
      if (sessionStart && dismissedUntil === sessionStart) {
        return; // Already dismissed for this session
      }
    }

    // Set session start time
    if (!sessionStorage.getItem('session_start')) {
      sessionStorage.setItem('session_start', Date.now().toString());
    }

    // Fetch active events
    fetchEvents();
  }, [isAuthenticated]);

  const fetchEvents = async () => {
    try {
      const result = await api.events.list('active');

      // Filter events user hasn't participated in
      const availableEvents: ActiveEvent[] = [];

      for (const event of result.slice(0, 3)) { // Check up to 3 events
        try {
          const detail = await api.events.get(event.id);
          if (!detail.participated) {
            availableEvents.push({
              id: event.id,
              title: event.title,
              type: event.type,
              pointsReward: event.pointsReward,
            });
          }
        } catch {
          // Skip if error
        }
      }

      if (availableEvents.length > 0) {
        setEvents(availableEvents);
        setIsVisible(true);
      }
    } catch (error) {
      console.error('Failed to fetch events:', error);
    }
  };

  const handleDismiss = () => {
    // Dismiss for this session only
    const sessionStart = sessionStorage.getItem('session_start');
    if (sessionStart) {
      localStorage.setItem(DISMISS_UNTIL_KEY, sessionStart);
    }
    setIsVisible(false);
  };

  const handleDismissForever = () => {
    localStorage.setItem(DISMISS_KEY, 'true');
    setIsDismissedForever(true);
    setIsVisible(false);
  };

  const handleEnableNotifications = () => {
    localStorage.removeItem(DISMISS_KEY);
    localStorage.removeItem(DISMISS_UNTIL_KEY);
    setIsDismissedForever(false);
    fetchEvents();
  };

  // Show "enable notifications" button if permanently dismissed
  if (isDismissedForever) {
    return (
      <button
        onClick={handleEnableNotifications}
        className="fixed bottom-4 right-4 z-40 p-3 bg-gray-100 hover:bg-gray-200 rounded-full shadow-lg transition-all group"
        title="이벤트 알림 켜기"
      >
        <BellOff className="w-5 h-5 text-gray-500 group-hover:text-gray-700" />
      </button>
    );
  }

  if (!isVisible || events.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm w-full mx-4 animate-slide-up">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary-500 to-secondary-500 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Bell className="w-5 h-5" />
            <span className="font-semibold">참여 가능한 이벤트!</span>
          </div>
          <button
            onClick={handleDismiss}
            className="text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Events */}
        <div className="p-4 space-y-3">
          {events.map((event) => (
            <Link
              key={event.id}
              to="/events"
              onClick={handleDismiss}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                event.type === 'quiz'
                  ? 'bg-purple-100 text-purple-600'
                  : event.type === 'first_come'
                  ? 'bg-yellow-100 text-yellow-600'
                  : 'bg-blue-100 text-blue-600'
              }`}>
                <Trophy className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{event.title}</p>
                <p className="text-sm text-primary-600 font-medium">
                  {event.pointsReward}P 획득 기회!
                </p>
              </div>
            </Link>
          ))}
        </div>

        {/* Actions */}
        <div className="px-4 pb-4 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDismissForever}
            className="flex-1 text-xs"
          >
            <BellOff className="w-3 h-3 mr-1" />
            다시 보지 않기
          </Button>
          <Link to="/events" onClick={handleDismiss} className="flex-1">
            <Button size="sm" fullWidth className="text-xs">
              이벤트 보기
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default EventNotification;
