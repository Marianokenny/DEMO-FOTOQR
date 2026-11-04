import { Briefcase, Cake, Crown, Gem, PartyPopper, Sparkles } from "lucide-react";
import type { EventType } from "@prisma/client";

const ICONS = { quince: Crown, wedding: Gem, birthday: Cake, party: PartyPopper, corporate: Briefcase, other: Sparkles };

export function EventTypeIcon({ type, className }: { type: EventType; className?: string }) {
  const Icon = ICONS[type];
  return <Icon className={className} />;
}
