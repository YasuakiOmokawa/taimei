"use client";

import { useSetAtom } from "jotai/react";
import { RESET } from "jotai/utils";
import { emailAtom, nameAtom } from "@/app/lib/atoms/atoms";

export default function Page() {
  useSetAtom(emailAtom)(RESET);
  useSetAtom(nameAtom)(RESET);

  return <p>thanks!</p>;
}
