"use client";

import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/app/ui/button";
import { useState } from "react";

export default function StepForm() {
  const [stepOneDone, setStepOneDone] = useState(false);
  const [stepTwoDone, setStepTwoDone] = useState(false);
  const [stepThreeDone, setStepThreeDone] = useState(false);

  type StepKey = "one" | "two" | "three";
  const stepIndex: Record<StepKey, number> = {
    one: 0,
    two: 1,
    three: 2,
  };

  const stepProgressStatus = [stepOneDone, stepTwoDone, stepThreeDone];

  const isInactiveStep = (currentStep: StepKey) => {
    const prevSteps = stepProgressStatus.filter(
      (_step, index) => index < stepIndex[currentStep]
    );
    return prevSteps.some((isDone) => isDone === false);
  };

  const getStepState = (step: StepKey) => {
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
  };

  const setStepState = (step: StepKey, state: boolean) => {
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
  };

  const renderStepButton = (step: StepKey) => {
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
  };

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
