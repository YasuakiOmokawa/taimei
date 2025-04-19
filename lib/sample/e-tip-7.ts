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
