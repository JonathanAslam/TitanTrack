import mockData from '../../../../packages/scraper/src/mock-data.json';
import type { Course, Term } from '../types';

// Hand-written stand-in for real CSUF data until the scraper (README §1) is built.
export const terms = mockData.terms as Term[];
export const courses = mockData.courses as Course[];
