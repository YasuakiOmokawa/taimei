import { number } from "zod";

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

type NullyStudent2 = {
  name: string;
  ageYears: number | null;
};
type _Student2 = Omit<NullyStudent2, "ageYears"> & {
  ageYears: number;
};
