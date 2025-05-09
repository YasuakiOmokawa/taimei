"use client";

import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/app/ui/button";
import { useCallback } from "react";
import { StepKey, useContent } from "./useContent";

export default function StepForm() {
  const {
    stepOneDone,
    stepTwoDone,
    stepThreeDone,
    setStepState,
    getStepState,
  } = useContent();

  const isInactiveStep = useCallback(
    (currentStep: StepKey) => {
      const stepProgressStatus = [stepOneDone, stepTwoDone, stepThreeDone];
      const stepIndex: Record<StepKey, number> = {
        one: 0,
        two: 1,
        three: 2,
      };

      const prevSteps = stepProgressStatus.filter(
        (_step, index) => index < stepIndex[currentStep]
      );
      return prevSteps.some((isDone) => isDone === false);
    },
    [stepOneDone, stepThreeDone, stepTwoDone]
  );

  const renderStepButton = useCallback(
    (step: StepKey) => {
      return getStepState(step) ? (
        <Button className="bg-black" onClick={() => setStepState(step, false)}>
          未完了に戻る
        </Button>
      ) : (
        <Button
          className="ml-4"
          onClick={() => setStepState(step, true)}
          disabled={isInactiveStep(step)}
        >
          完了
        </Button>
      );
    },
    [getStepState, isInactiveStep, setStepState]
  );

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>ステップ1</CardTitle>
        </CardHeader>
        <CardFooter>{renderStepButton("one")} </CardFooter>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>ステップ2</CardTitle>
        </CardHeader>
        <CardFooter>{renderStepButton("two")} </CardFooter>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>ステップ3</CardTitle>
        </CardHeader>
        <CardFooter>{renderStepButton("three")} </CardFooter>
      </Card>
    </>
  );
}
