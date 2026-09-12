/**
 * Shared course-data schema for TitanTrack.
 * The scraper (or hand-written mock data) produces data in this shape;
 * the API serves it and the frontend consumes it — one source of truth.
 */

export type Day = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export type SeatStatus = 'open' | 'closed' | 'waitlist';

export interface Term {
  /** e.g. "2261" (PeopleSoft strm) or a human slug like "fall-2026" */
  id: string;
  name: string;
}

export interface Meeting {
  days: Day[];
  /** 24h "HH:MM" */
  startTime: string;
  endTime: string;
  /** e.g. "MH-101" or "ONLINE" */
  location: string;
}

export interface Section {
  id: string;
  sectionNumber: string;
  instructor: string;
  meetings: Meeting[];
  seatsTotal: number;
  seatsTaken: number;
  waitlistTotal: number;
  waitlistTaken: number;
  status: SeatStatus;
}

export interface Course {
  id: string;
  termId: string;
  subject: string;
  courseNumber: string;
  title: string;
  units: number;
  geCategories: string[];
  description?: string;
  sections: Section[];
}
