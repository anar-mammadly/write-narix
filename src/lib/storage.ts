export const ORDER_FILES_BUCKET = "order-files";

export function buildStoragePath(orderId: string, category: string, fileName: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `orders/${orderId}/${category}/${crypto.randomUUID()}-${safeName}`;
}
