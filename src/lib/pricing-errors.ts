// Plain helper (not a Server Action) — kept out of the "use server" action
// files since those may only export async functions.
export function describePricingError(message: string): string {
  if (message.includes("BELOW_MINIMUM_PAGES")) {
    const min = message.match(/BELOW_MINIMUM_PAGES:(\d+)/)?.[1];
    return min
      ? `This service requires a minimum of ${min} pages.`
      : "This service has a minimum page requirement that hasn't been met.";
  }
  if (message.includes("INVALID_PAGE_COUNT")) {
    return "Enter a whole number of pages, at least 1.";
  }
  if (message.includes("NO_PRICING_RULE")) {
    return "Pricing isn't configured for this service yet — please choose another.";
  }
  return "Unable to calculate a price for this combination.";
}
