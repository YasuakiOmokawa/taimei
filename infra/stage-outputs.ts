import { stageOf, stageOutputs } from "./stages";

console.log(stageOutputs(stageOf(process.argv[2] ?? "")));
