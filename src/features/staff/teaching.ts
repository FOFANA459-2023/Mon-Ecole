export type Teaching = {
  homeroom_class_ids: number[];
  subjects: { class_group: number | null; subject: number | null }[];
};

export const emptyTeaching = (): Teaching => ({ homeroom_class_ids: [], subjects: [] });

/** Only complete rows are sent. */
export function teachingPayload(teaching: Teaching) {
  return {
    homeroom_class_ids: teaching.homeroom_class_ids,
    subjects: teaching.subjects
      .filter((row) => row.class_group !== null && row.subject !== null)
      .map((row) => ({ class_group: row.class_group!, subject: row.subject! })),
  };
}
