import type { Metadata, Viewport } from "next";
import { GuestUploader } from "@/components/guest/guest-uploader";
import { readableOn } from "@/lib/color";
import { formatDate } from "@/lib/dates";
import { LinkError } from "@/lib/links";
import { getGuestEvent } from "@/lib/uploads";

export const viewport: Viewport = { themeColor: "#f3ece0", width: "device-width", initialScale: 1, viewportFit: "cover" };

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  try {
    const { event } = await getGuestEvent((await params).token);
    return { title: `Subí tus fotos · ${event.name}`, robots: { index: false } };
  } catch {
    return { title: "Enlace no disponible", robots: { index: false } };
  }
}

export default async function GuestPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let data;
  try {
    data = await getGuestEvent(token);
  } catch (e) {
    if (!(e instanceof LinkError)) throw e;
    return (
      <main className="grid min-h-dvh place-items-center bg-paper px-6 text-center text-on-paper">
        <div>
          <p className="eyebrow text-on-paper-muted">Enlace no disponible</p>
          <h1 className="display mt-4 text-5xl">Ups, <em className="text-primary">este QR</em> ya no funciona</h1>
          <p className="mt-4 text-on-paper-muted">{e.message}</p>
        </div>
      </main>
    );
  }
  const { event, settings } = data;
  return (
    <GuestUploader
      token={token}
      event={{
        name: event.name,
        date: formatDate(event.date, { weekday: "long", day: "numeric", month: "long" }),
        color: event.brandColor,
        colorText: readableOn(event.brandColor),
      }}
      limits={{
        allowVideos: settings.allowVideos, maxPhotoMb: settings.maxPhotoMb, maxVideoMb: settings.maxVideoMb,
        maxVideoSeconds: settings.maxVideoSeconds, maxFiles: settings.maxFilesPerGuest,
      }}
    />
  );
}
