import { MessageCircle } from "lucide-react";
import { buildWhatsAppUrl } from "@/lib/data/site-settings";

export function WhatsAppButton({
  number,
  message,
  ariaLabel = "Chat on WhatsApp",
}: {
  number: string;
  message?: string;
  ariaLabel?: string;
}) {
  return (
    <a
      href={buildWhatsAppUrl(number, message)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel}
      className="fixed bottom-5 right-5 z-50 flex size-14 items-center justify-center rounded-full bg-success text-success-foreground shadow-lg shadow-success/20 transition-transform hover:scale-105 sm:bottom-6 sm:right-6"
    >
      <MessageCircle className="size-6" />
    </a>
  );
}
