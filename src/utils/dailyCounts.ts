import type { Model, PipelineStage } from "mongoose";

/** Daily bucket counts for the last `days` days, oldest first, with no gaps
 * (a day with zero events still gets a 0 entry — charts don't like holes). */
export async function dailyCounts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: Model<any>,
  days: number,
  match: Record<string, unknown> = {},
  dateField = "createdAt"
): Promise<{ date: string; count: number }[]> {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const pipeline: PipelineStage[] = [
    { $match: { ...match, [dateField]: { $gte: since } } },
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: `$${dateField}` } }, count: { $sum: 1 } } },
  ];
  const rows = await model.aggregate<{ _id: string; count: number }>(pipeline);
  const byDate = new Map(rows.map((r) => [r._id, r.count]));

  const out: { date: string; count: number }[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, count: byDate.get(key) ?? 0 });
  }
  return out;
}
