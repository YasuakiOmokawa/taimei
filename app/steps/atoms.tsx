import { atomWithStorage } from "jotai/utils";
import { StepProgress } from "./useContent";

export const stepsAtom = atomWithStorage<StepProgress[]>(
  "contractSetupSteps",
  [
    {
      key: "one",
      isDone: false,
    },
    {
      key: "two",
      isDone: false,
    },
    {
      key: "three",
      isDone: false,
    },
  ],
  undefined,
  {
    getOnInit: true,
  }
);
