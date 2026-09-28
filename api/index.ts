// @ts-ignore
import serverModule from './server.cjs';

const app = typeof serverModule === 'function'
  ? serverModule
  : (serverModule?.default?.default || serverModule?.default || serverModule);

export default function handler(req: any, res: any) {
  if (typeof app === 'function') {
    return app(req, res);
  }
  return res.status(500).json({ error: 'Express application handler failed to load.' });
}
