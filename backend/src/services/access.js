import { Expo } from '../models/index.js';
import { ROLES } from '../config/constants.js';
import { ApiError } from '../utils/ApiError.js';
import { assertObjectId } from '../utils/helpers.js';

export const PUBLIC_EXPO_STATUSES = ['published', 'ongoing', 'completed'];

/** Loads an expo the organizer owns (admin-only management actions). */
export async function loadOwnedExpo(expoId, user) {
  assertObjectId(expoId, 'expo id');
  const expo = await Expo.findById(expoId);
  if (!expo) throw ApiError.notFound('Expo not found');
  if (user.role !== ROLES.ADMIN || String(expo.organizer) !== String(user._id)) throw ApiError.forbidden('You do not manage this expo');
  return expo;
}

/** Loads an expo visible to the requester: published expos for everyone, drafts only for the owner. */
export async function loadVisibleExpo(expoId, user) {
  assertObjectId(expoId, 'expo id');
  const expo = await Expo.findById(expoId);
  if (!expo) throw ApiError.notFound('Expo not found');
  const owner = user?.role === ROLES.ADMIN && String(expo.organizer) === String(user._id);
  if (!owner && !PUBLIC_EXPO_STATUSES.includes(expo.status)) throw ApiError.notFound('Expo not found');
  return { expo, isOwner: owner };
}
