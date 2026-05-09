"use client";

import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { StepKey, useContent } from "./useContent";

const STEPS: { key: StepKey; label: string }[] = [
  { key: "one", label: "ステップ1" },
  { key: "two", label: "ステップ2" },
  { key: "three", label: "ステップ3" },
];

export default function StepForm() {
  const { handleClickStep, getStepProgress, isInactiveStep } = useContent();

  const renderStepButton = useCallback(
    (step: StepKey) => {
      return getStepProgress(step) ? (
        <Button
          className="bg-black"
          onClick={() => handleClickStep(step, false)}
        >
          未完了に戻る
        </Button>
      ) : (
        <Button
          className="ml-4"
          onClick={() => handleClickStep(step, true)}
          disabled={isInactiveStep(step)}
        >
          完了
        </Button>
      );
    },
    [getStepProgress, isInactiveStep, handleClickStep],
  );

  return (
    <>
      {STEPS.map(({ key, label }) => (
        <Card key={key}>
          <CardHeader>
            <CardTitle>{label}</CardTitle>
          </CardHeader>
          <CardFooter>{renderStepButton(key)}</CardFooter>
        </Card>
      ))}
    </>
  );
}
