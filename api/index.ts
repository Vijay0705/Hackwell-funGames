// @ts-ignore
import app from './server.cjs';

export default function handler(req: any, res: any) {
  return app(req, res);
}
