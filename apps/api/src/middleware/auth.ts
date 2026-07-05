// =============================================================================
// Authentication Middleware
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { supabaseAdmin } from '../utils/supabase.js';
import { env } from '../config/index.js';
import type { UserRole } from '@vpay/types';

// Supabase signs access tokens with project-specific asymmetric JWT signing keys (ES256),
// not the legacy shared HS256 secret — verify against the project's published JWKS instead.
const JWKS = createRemoteJWKSet(new URL(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`));

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: UserRole;
  };
}

export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: 'No authentication token provided' });
      return;
    }

    const token = authHeader.split(' ')[1];

    // Verify Supabase JWT against the project's JWKS (ES256 signing keys — jose caches
    // and auto-refreshes the key set, so this doesn't round-trip on every request).
    let userId: string;
    try {
      const { payload } = await jwtVerify(token, JWKS, {
        issuer: `${env.SUPABASE_URL}/auth/v1`,
        audience: 'authenticated',
      });
      userId = payload.sub as string;
    } catch {
      res.status(401).json({ success: false, error: 'Invalid or expired token' });
      return;
    }

    // Fetch role and status in one DB query (no extra auth-server call)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, email, role, status')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      res.status(401).json({ success: false, error: 'User profile not found' });
      return;
    }

    if (profile.status === 'suspended') {
      res.status(403).json({ success: false, error: 'Account suspended. Contact support.' });
      return;
    }

    if (profile.status === 'closed') {
      res.status(403).json({ success: false, error: 'Account closed.' });
      return;
    }

    req.user = { id: userId, email: profile.email, role: profile.role as UserRole };
    next();
  } catch (err) {
    res.status(401).json({ success: false, error: 'Authentication failed' });
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ success: false, error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}

export const requireAdmin = requireRole('super_admin', 'staff');
export const requireSuperAdmin = requireRole('super_admin');
export const requireAgent = requireRole('super_admin', 'staff', 'agent');
