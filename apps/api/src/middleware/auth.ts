// =============================================================================
// Authentication Middleware
// =============================================================================

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../utils/supabase.js';
import { env } from '../config/index.js';
import type { UserRole } from '@vpay/types';

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

    // Verify Supabase JWT locally — avoids a remote network round-trip on every request.
    // SUPABASE_JWT_SECRET is the same secret Supabase signs all access tokens with.
    let userId: string;
    try {
      const payload = jwt.verify(token, env.SUPABASE_JWT_SECRET, { algorithms: ['HS256'] }) as { sub: string };
      userId = payload.sub;
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
