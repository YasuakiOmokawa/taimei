type Person = {
  name: string;
  age: number;
  job?: string;
};
interface PersonSpan extends Person {
  birth: Date;
  death?: Date;
}
interface WorkerSpan extends Omit<Person, "job"> {
  job: string;
}
