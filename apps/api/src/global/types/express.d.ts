import { Principal } from '@sharptalk/types';

/** Augment Express Request with the authenticated principal set by JwtAuthGuard. */
declare global {
  namespace Express {
    interface Request {
      user?: Principal;
    }
  }
}

export {};
