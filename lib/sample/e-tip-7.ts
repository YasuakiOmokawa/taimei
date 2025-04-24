import { number, string } from "zod";

type Person = {
  name: string;
  age: number;
  job?: string;
};
interface _PersonSpan extends Person {
  birth: Date;
  death?: Date;
}
interface _WorkerSpan extends Omit<Person, "job"> {
  job: string;
}

interface NullyStudent {
  name: string;
  ageYears: number | null;
}
interface _Student extends NullyStudent {
  ageYears: number;
}

type MasterIndex = {
  itemKey: string;
  masterId: number | null;
};

const metas: Record<string, unknown>[] = [
  { item_key: undefined, master_id: 0 },
  { item_key: "", master_id: null },
  { item_key: "a", master_id: null },
  { item_key: "", master_id: 1 },
  { item_key: "aa", master_id: "9" },
  { item_key2: "b", master_id: "a" },
  { item_key: "", master_id2: 3 },
];

const masterIndexes: MasterIndex[] = metas.map((meta) => ({
  itemKey: typeof meta.item_key === "string" ? meta.item_key : "",
  masterId: typeof meta.master_id === "number" ? meta.master_id : null,
}));
console.log("masterIndexes:");
console.table(masterIndexes);

const uniqueMasterIndexes = masterIndexes.filter(
  (masterIndex, index) =>
    index ===
    masterIndexes.findIndex(
      (other) =>
        masterIndex.itemKey === other.itemKey &&
        masterIndex.masterId === other.masterId
    )
);
console.log("uniqueMasterIndexes:");
console.table(uniqueMasterIndexes);

const buildUniqueMasterIndexes = (
  metas: Record<string, unknown>[]
): MasterIndex[] => {
  const masterIndexes: MasterIndex[] = metas.map((meta) => ({
    itemKey: typeof meta.item_key === "string" ? meta.item_key : "",
    masterId: typeof meta.master_id === "number" ? meta.master_id : null,
  }));
  return masterIndexes.filter(
    (masterIndex, index) =>
      index ===
      masterIndexes.findIndex(
        (other) =>
          masterIndex.itemKey === other.itemKey &&
          masterIndex.masterId === other.masterId
      )
  );
};

console.table(buildUniqueMasterIndexes(metas));
