export const ROLES = Object.freeze({ ADMIN: 'admin', EXHIBITOR: 'exhibitor', ATTENDEE: 'attendee' });
export const ROLE_LIST = Object.values(ROLES);

export const EXPO_STATUS = ['draft', 'published', 'ongoing', 'completed', 'cancelled'];
export const BOOTH_STATUS = ['available', 'reserved', 'booked', 'blocked'];
export const BOOTH_SIZES = ['small', 'medium', 'large'];
export const APPLICATION_STATUS = ['pending', 'approved', 'rejected', 'withdrawn'];
export const SESSION_TYPES = ['keynote', 'talk', 'workshop', 'panel', 'networking'];
export const TICKET_STATUS = ['open', 'in_progress', 'resolved', 'closed'];
export const TICKET_PRIORITY = ['low', 'medium', 'high'];
export const INQUIRY_TYPES = ['inquiry', 'appointment'];
export const INQUIRY_STATUS = ['pending', 'accepted', 'declined', 'completed'];
export const FEEDBACK_TYPES = ['suggestion', 'issue', 'other'];
export const FEEDBACK_STATUS = ['new', 'reviewed', 'resolved'];
export const CATEGORIES = [
  'Technology', 'Healthcare', 'Manufacturing', 'Food & Beverage', 'Finance',
  'Education', 'Energy', 'Retail', 'Automotive', 'Media & Design', 'Other',
];

export const MAX_BOOTHS_PER_EXHIBITOR = 2;
export const MAX_FAILED_LOGINS = 5;
export const LOCK_MINUTES = 15;
export const REMINDER_OPTIONS = [5, 10, 15, 30, 60, 120, 1440];
