export const API_BASE: string = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

// http -> ws and https -> wss, so a deployed (https) site never tries an insecure socket
export const WS_BASE = API_BASE.replace(/^http/, 'ws');
