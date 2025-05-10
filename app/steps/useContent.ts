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

  // 前段のステップがすべて終わってなければ完了ボタンを押せないようにしたい
  const isInactiveStep = useCallback(
    (currentStep: StepKey) => {
      const prevSteps = stepProgresses.filter(
        (_, index) =>
          index < stepProgresses.findIndex((step) => step.key === currentStep)
      );
      return prevSteps.some((step) => step.isDone === false);
    },
    [stepProgresses]
  );

  return {
    handleClickStep,
    getStepProgress,
    isInactiveStep,
  };
};
