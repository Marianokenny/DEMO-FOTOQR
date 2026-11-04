import type { ScreenItem } from "@/lib/projection";

export type PlayOrder = "newest_first" | "chronological" | "random";

/**
 * Decides what plays next. Newly approved items jump the line (in arrival order);
 * otherwise it cycles through everything approved, following the configured order.
 */
export class Playlist {
  private items: ScreenItem[] = [];
  private priority: string[] = [];
  private cursor = -1;
  private bag: string[] = [];
  private lastId: string | null = null;

  constructor(public order: PlayOrder) {}

  get size() {
    return this.items.length;
  }

  has(id: string) {
    return this.items.some((i) => i.id === id);
  }

  /** Replaces the item list; ids not seen before are queued as priority. Returns the new ids. */
  sync(next: ScreenItem[], { prioritizeNew = true } = {}) {
    const known = new Set(this.items.map((i) => i.id));
    const sorted = [...next].sort((a, b) => a.approvedAt.localeCompare(b.approvedAt));
    const fresh = sorted.filter((i) => !known.has(i.id)).map((i) => i.id);
    this.items = sorted;
    const ids = new Set(sorted.map((i) => i.id));
    this.priority = this.priority.filter((id) => ids.has(id));
    this.bag = this.bag.filter((id) => ids.has(id));
    if (prioritizeNew && known.size > 0) this.priority.push(...fresh.filter((id) => !this.priority.includes(id)));
    return fresh;
  }

  remove(id: string) {
    this.sync(this.items.filter((i) => i.id !== id), { prioritizeNew: false });
  }

  /** Puts an item at the front of the line (organizer's "pasar ahora"). */
  playNext(id: string) {
    if (!this.has(id)) return false;
    this.priority = [id, ...this.priority.filter((x) => x !== id)];
    return true;
  }

  /** Best guess of what comes after the current item, without advancing. */
  peek(): ScreenItem | null {
    if (!this.items.length) return null;
    const byId = (id: string) => this.items.find((i) => i.id === id) ?? null;
    for (const id of this.priority) { const it = byId(id); if (it) return it; }
    if (this.order === "random") return this.bag.length ? byId(this.bag[0]) : null;
    const list = this.order === "newest_first" ? [...this.items].reverse() : this.items;
    return list[(this.cursor + 1) % list.length] ?? null;
  }

  next(): ScreenItem | null {
    if (!this.items.length) return null;
    const byId = (id: string) => this.items.find((i) => i.id === id) ?? null;
    let pick: ScreenItem | null = null;
    while (!pick && this.priority.length) pick = byId(this.priority.shift()!);
    if (!pick) {
      if (this.order === "random") {
        if (!this.bag.length) {
          this.bag = this.items.map((i) => i.id).sort(() => Math.random() - 0.5);
          if (this.bag.length > 1 && this.bag[0] === this.lastId) this.bag.push(this.bag.shift()!);
        }
        pick = byId(this.bag.shift()!);
      } else {
        const list = this.order === "newest_first" ? [...this.items].reverse() : this.items;
        this.cursor = (this.cursor + 1) % list.length;
        pick = list[this.cursor];
      }
    }
    this.lastId = pick?.id ?? null;
    return pick;
  }
}
