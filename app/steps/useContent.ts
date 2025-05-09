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

  return { setStepState, stepOneDone, stepTwoDone, stepThreeDone };
};
