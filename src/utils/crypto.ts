/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Computes a deterministic SHA-256 hex string of a normalized email address.
 * Matches ^[a-zA-Z0-9_\-]+$ for valid Firestore document IDs.
 */
export async function hashEmail(email: string): Promise<string> {
  const clean = email.trim().toLowerCase();
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const msgUint8 = new TextEncoder().encode(clean);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Fallback hash
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash << 5) - hash + clean.charCodeAt(i);
    hash |= 0;
  }
  return 'h_' + Math.abs(hash).toString(16);
}
