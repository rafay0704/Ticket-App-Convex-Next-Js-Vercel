// helpers.ts
import { Id } from "./_generated/dataModel";
import { ctx } from "./_generated/server";
import { TICKET_STATUS, WAITING_LIST_STATUS, DURATIONS } from "./constants";
import { internal } from "./_generated/api";

/**
 * Check how many tickets are available for an event
 */
export async function getAvailableSpots(ctx, eventId: Id<"events">) {
  const event = await ctx.db.get(eventId);
  if (!event) throw new Error("Event not found");

  const purchasedCount = await ctx.db
    .query("tickets")
    .withIndex("by_event", (q) => q.eq("eventId", eventId))
    .collect()
    .then(
      (tickets) =>
        tickets.filter(
          (t) =>
            t.status === TICKET_STATUS.VALID ||
            t.status === TICKET_STATUS.USED
        ).length
    );

  const now = Date.now();
  const activeOffers = await ctx.db
    .query("waitingList")
    .withIndex("by_event_status", (q) =>
      q.eq("eventId", eventId).eq("status", WAITING_LIST_STATUS.OFFERED)
    )
    .collect()
    .then(
      (entries) => entries.filter((e) => (e.offerExpiresAt ?? 0) > now).length
    );

  return event.totalTickets - (purchasedCount + activeOffers);
}

/**
 * Offer tickets to users in waiting list
 */
export async function offerTickets(ctx, eventId: Id<"events">, spots: number) {
  if (spots <= 0) return;

  const waitingUsers = await ctx.db
    .query("waitingList")
    .withIndex("by_event_status", (q) =>
      q.eq("eventId", eventId).eq("status", WAITING_LIST_STATUS.WAITING)
    )
    .order("asc")
    .take(spots);

  const now = Date.now();

  for (const user of waitingUsers) {
    await ctx.db.patch(user._id, {
      status: WAITING_LIST_STATUS.OFFERED,
      offerExpiresAt: now + DURATIONS.TICKET_OFFER,
    });

    await ctx.scheduler.runAfter(
      DURATIONS.TICKET_OFFER,
      internal.waitingList.expireOffer,
      {
        waitingListId: user._id,
        eventId,
      }
    );
  }
}
