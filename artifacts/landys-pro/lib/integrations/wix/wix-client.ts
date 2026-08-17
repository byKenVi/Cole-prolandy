const WIX_QUERY_URL = "https://www.wixapis.com/wix-data/v2/items/query";
const DEFAULT_PAGE_SIZE = 50;

export type WixQueryResponse = {
  dataItems?: Array<{ id?: string; data?: Record<string, unknown> }>;
  pagingMetadata?: { count?: number; offset?: number; total?: number; hasNext?: boolean };
};

export function getWixConfig() {
  const siteId = process.env.WIX_SITE_ID?.trim();
  const authorization = process.env.WIX_API_AUTHORIZATION?.trim();
  const collectionId = process.env.WIX_CONTRACTOR_COLLECTION_ID?.trim() || "AllContractors";
  if (!siteId || !authorization) return null;
  return { siteId, authorization, collectionId };
}

export async function queryWixContractors(params: {
  offset?: number;
  limit?: number;
  updatedAfter?: Date;
}): Promise<WixQueryResponse> {
  const config = getWixConfig();
  if (!config) throw new Error("Wix API is not configured.");

  const filter =
    params.updatedAfter != null
      ? {
          _updatedDate: { $gt: params.updatedAfter.toISOString() },
        }
      : undefined;

  const response = await fetch(WIX_QUERY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: config.authorization,
      "wix-site-id": config.siteId,
    },
    body: JSON.stringify({
      dataCollectionId: config.collectionId,
      query: {
        filter,
        paging: {
          limit: params.limit ?? DEFAULT_PAGE_SIZE,
          offset: params.offset ?? 0,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Wix query failed with status ${response.status}.`);
  }
  return (await response.json()) as WixQueryResponse;
}

export async function fetchAllWixContractors(updatedAfter?: Date) {
  const items: Record<string, unknown>[] = [];
  let offset = 0;
  const limit = DEFAULT_PAGE_SIZE;

  while (true) {
    const page = await queryWixContractors({ offset, limit, updatedAfter });
    const batch = (page.dataItems ?? []).map((entry) => ({
      _id: entry.id ?? (entry.data?._id as string | undefined),
      ...entry.data,
    }));
    items.push(...batch.filter((item) => item._id));

    const hasNext = page.pagingMetadata?.hasNext;
    const count = page.pagingMetadata?.count ?? batch.length;
    if (hasNext === false || batch.length < limit) break;
    offset += count;
    if (count === 0) break;
  }

  return items;
}
