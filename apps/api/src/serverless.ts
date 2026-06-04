// Vercel serverless entry — exports the Express app as the default handler.
// Vercel's @vercel/node builder wraps it; app.listen() in index.ts is only
// called in the local dev / Railway path, not here.
import { app } from './app.js';
export default app;
