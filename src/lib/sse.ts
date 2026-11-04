import { eventChannel } from "./realtime";
import { newRedisConnection } from "./redis";

/**
 * Streams an event's realtime channel as Server-Sent Events.
 * Sends a comment every 20 s so proxies and venue routers don't close an idle connection.
 */
export function eventStream(eventId: string, signal: AbortSignal, initial?: () => Promise<unknown>) {
  return channelStream(eventChannel(eventId), signal, initial);
}

export function channelStream(channel: string, signal: AbortSignal, initial?: () => Promise<unknown>) {
  const encoder = new TextEncoder();
  const sub = newRedisConnection();
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: string) => {
        try { controller.enqueue(encoder.encode(data)); } catch { /* closed */ }
      };
      const close = () => {
        clearInterval(heartbeat);
        sub.disconnect();
        try { controller.close(); } catch { /* already closed */ }
      };
      signal.addEventListener("abort", close);
      send("retry: 3000\n\n");
      if (initial) send(`event: snapshot\ndata: ${JSON.stringify(await initial())}\n\n`);
      sub.on("message", (_ch, message) => send(`data: ${message}\n\n`));
      await sub.subscribe(channel);
      heartbeat = setInterval(() => send(`: ping ${Date.now()}\n\n`), 20_000);
    },
    cancel() {
      clearInterval(heartbeat);
      sub.disconnect();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
