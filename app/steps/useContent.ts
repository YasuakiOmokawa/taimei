"use client";

import { useAtom } from "jotai/react";
import { useCallback } from "react";
import { stepsAtom } from "./atoms";

export type StepKey = "one" | "two" | "three";

export type StepProgress = {
  key: StepKey;
  isDone: boolean;
};

export const useContent = () => {
  const [stepProgresses, setStepProgress] = useAtom(stepsAtom);

  const handleClickStep = useCallback(
    (step: StepKey, state: boolean) => {
      const newProgress = stepProgresses.map((prevVal) =>
        prevVal.key === step
          ? {
              key: prevVal.key,
              isDone: state,
            }
          : prevVal,
      );
      setStepProgress(newProgress);
    },
    [setStepProgress, stepProgresses],
  );

  const getStepProgress = useCallback(
    (step: StepKey) => {
      return stepProgresses.find((value) => value.key === step)?.isDone;
    },
    [stepProgresses],
  );

  // 前段のステップがすべて終わってなければ完了ボタンを押せないようにしたい
  const isInactiveStep = useCallback(
    (currentStep: StepKey) => {
      const currentStepIndex = stepProgresses.findIndex(
        (step) => step.key === currentStep,
      );
      const prevSteps = stepProgresses.filter(
        (_, index) => index < currentStepIndex,
      );
      return prevSteps.some((step) => step.isDone === false);
    },
    [stepProgresses],
  );

  return {
    handleClickStep,
    getStepProgress,
    isInactiveStep,
  };
};
