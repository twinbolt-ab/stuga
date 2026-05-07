// Per-cover Stuga overrides for direction (`inverted`) and the user's preferred
// "fully closed" position (`closedPrc`, 0-100 in HA convention after inversion).
//
// HA convention: 0 = closed, 100 = open. Some integrations (e.g. IKEA Tradfri)
// report direction inconsistently and `inverted` lets the user fix it inside
// Stuga without reconfiguring HA. `closedPrc` lets users who've calibrated
// their blind to stop at, say, HA 30% map that to the slider's 0%.

export interface CoverSettings {
  inverted: boolean
  /** HA position (0-100, after inversion) the user calls fully closed. 0 = no remap. */
  closedPrc: number
}

export const DEFAULT_COVER_SETTINGS: CoverSettings = { inverted: false, closedPrc: 0 }

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/** Convert raw HA position to the value Stuga should display (0-100). */
export function haToUserPosition(haPos: number, settings: CoverSettings): number {
  const effective = settings.inverted ? 100 - haPos : haPos
  if (settings.closedPrc <= 0) return clamp(Math.round(effective), 0, 100)
  if (effective <= settings.closedPrc) return 0
  const span = 100 - settings.closedPrc
  return clamp(Math.round(((effective - settings.closedPrc) / span) * 100), 0, 100)
}

/** Convert a user-supplied position (0-100) back to the HA value to send. */
export function userToHaPosition(userPos: number, settings: CoverSettings): number {
  const clamped = clamp(userPos, 0, 100)
  const effective =
    settings.closedPrc <= 0
      ? clamped
      : settings.closedPrc + (clamped / 100) * (100 - settings.closedPrc)
  const ha = settings.inverted ? 100 - effective : effective
  return clamp(Math.round(ha), 0, 100)
}

/**
 * True if the cover should be considered closed in user view.
 *
 * Position-based detection is preferred when settings are non-default (the
 * whole point is that HA's `is_closed` may not match user expectations).
 * Otherwise, fall back to the caller-supplied HA-derived flag.
 */
export function isClosedForUser(
  haPosition: number | undefined,
  haIsClosed: boolean,
  settings: CoverSettings
): boolean {
  if (typeof haPosition === 'number') {
    return haToUserPosition(haPosition, settings) === 0
  }
  return settings.inverted ? !haIsClosed : haIsClosed
}
