"use client";

import { useCallback, useState } from "react";

export type StepKey = "one" | "two" | "three";

type stepProgress = {
  key: StepKey;
  isDone: boolean;
};

export const useContent = () => {
  const [stepProgresses, setStepProgress] = useState<stepProgress[]>([
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
  ]);

  const handleClickStep = useCallback(
    (step: StepKey, state: boolean) => {
      setStepProgress(
        stepProgresses.map((prevVal) =>
          prevVal.key === step ? { key: prevVal.key, isDone: state } : prevVal
        )
      );
    },
    [stepProgresses]
  );

  const getStepProgress = useCallback(
    (step: StepKey) => {
      return stepProgresses.find((value) => value.key === step)?.isDone;
    },
    [stepProgresses]
  );

  // 前段のステップが完了してなければ完了ボタンを押せないようにしたい
  const isInactiveStep = useCallback(
    (currentStep: StepKey) => {
      const stepProgressStatus = [stepOneDone, stepTwoDone, stepThreeDone];
      const stepIndex: Record<StepKey, number> = {
        one: 0,
        two: 1,
        three: 2,
      };

      const prevSteps = stepProgressStatus.filter(
        (_, index) => index < stepIndex[currentStep]
      );
      return prevSteps.some((isDone) => isDone === false);
    },
    [stepOneDone, stepThreeDone, stepTwoDone]
  );

  return {
    handleClickStep,
    getStepProgress,
    isInactiveStep,
  };
};
