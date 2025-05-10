"use client";

import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/app/ui/button";
import { useCallback } from "react";
import { StepKey, useContent } from "./useContent";

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
    [getStepProgress, isInactiveStep, handleClickStep]
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
