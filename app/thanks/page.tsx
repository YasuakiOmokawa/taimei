"use client";

import { emailAtom, nameAtom } from "@/app/atoms/form";
import { useSetAtom } from "jotai/react";
import { RESET } from "jotai/utils";

export default function Page() {
  useSetAtom(emailAtom)(RESET);
  useSetAtom(nameAtom)(RESET);

  return <p>thanks!</p>;
}
