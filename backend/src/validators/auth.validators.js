import { z } from 'zod';
import { ROLE_LIST } from '../config/constants.js';
import { email, password, reqStr, optStr, clearableUpload } from './common.js';

export const register = z.object({
  name: reqStr(80),
  email,
  password,
  role: z.enum(ROLE_LIST).default('attendee'),
  company: optStr(120),
  phone: optStr(30),
  organizerCode: optStr(100),
  consent: z.literal(true, { error: 'You must accept the terms and privacy policy' }),
  marketingConsent: z.boolean().optional(),
});

export const login = z.object({
  email,
  password: z.string().min(1, 'Required').max(72),
  role: z.enum(ROLE_LIST).optional(),
});

export const forgot = z.object({ email });

export const reset = z.object({
  token: z.string().min(20).max(200),
  password,
});

export const updateMe = z.object({
  name: reqStr(80).optional(),
  phone: optStr(30),
  company: optStr(120),
  avatar: clearableUpload,
  marketingConsent: z.boolean().optional(),
});

export const changePassword = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: password,
});

export const deleteAccount = z.object({ password: z.string().min(1).max(72) });
