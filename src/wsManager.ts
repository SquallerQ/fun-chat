import { WebSocket } from './browserTypes';
let ws: WebSocket | null = null;

export function getWS(): WebSocket {
  if (!ws || ws.readyState === WebSocket.CLOSED) {
    ws = new WebSocket('ws://localhost:4000');
  }
  return ws;
}

export function setWS(newWS: WebSocket): void {
  ws = newWS;
}

export function closeWS(): void {
  if (ws) {
    ws.close();
    ws = null;
  }
}
