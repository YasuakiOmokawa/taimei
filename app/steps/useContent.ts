"use client";

import { useCallback, useState } from "react";

export type StepKey = "one" | "two" | "three";

export const useContent = () => {
  const [stepOneDone, setStepOneDone] = useState(false);
  const [stepTwoDone, setStepTwoDone] = useState(false);
  const [stepThreeDone, setStepThreeDone] = useState(false);

  const setStepState = useCallback((step: StepKey, state: boolean) => {
    switch (step) {
      case "one":
        setStepOneDone(state);
        break;
      case "two":
        setStepTwoDone(state);
        break;
      case "three":
        setStepThreeDone(state);
        break;
      default:
        throw new Error(`unexpected step: ${step satisfies never}`);
    }
  }, []);

  const getStepState = useCallback(
    (step: StepKey) => {
      switch (step) {
        case "one":
          return stepOneDone;
        case "two":
          return stepTwoDone;
        case "three":
          return stepThreeDone;
        default:
          throw new Error(`unexpected step: ${step satisfies never}`);
      }
    },
    [stepOneDone, stepThreeDone, stepTwoDone]
  );

  return {
    setStepState,
    getStepState,
    stepOneDone,
    stepTwoDone,
    stepThreeDone,
  };
};
