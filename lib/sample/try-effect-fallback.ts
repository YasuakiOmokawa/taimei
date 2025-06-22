import { Effect, Console } from "effect";

const success = Effect.succeed("success");
const failure = Effect.fail("failure");
const fallback = Effect.succeed("fallback");

// use orElse
const successProgram = Effect.orElse(success, () => fallback);
const fallbackProgram = Effect.orElse(failure, () => fallback);
Effect.runPromise(Effect.all([successProgram, fallbackProgram])).then(
  console.log
);

// use or else fail
const validate = (age: number): Effect.Effect<number, string> => {
  if (age < 0) {
    return Effect.fail("negative age error");
  } else if (age < 18) {
    return Effect.fail("illegal age error");
  } else {
    return Effect.succeed(age);
  }
};
const orElseFailProgram = Effect.orElseFail(validate(-1), () => "invalid age");
Effect.runPromiseExit(orElseFailProgram).then(console.log);

// use or else succeed
const orElseSuccessProgram = Effect.orElseSucceed(validate(-1), () => 18);
Effect.runPromiseExit(orElseSuccessProgram).then(console.log);

// use first success of
interface Config {
  host: string;
  port: number;
  apiKey: string;
}

const makeConfig = (name: string): Config => ({
  host: `${name}.example.com`,
  port: 8080,
  apiKey: "123-456-789",
});

const remoteConfig = (name: string): Effect.Effect<Config, Error> =>
  Effect.gen(function* () {
    if (name === "node3") {
      yield* Console.log(`Config for ${name} found`);
      return makeConfig(name);
    } else {
      yield* Console.log(`unavailable config for ${name}`);
      return yield* Effect.fail(new Error(`Config not found ${name}`));
    }
  });

const masterConfig = remoteConfig("master");
const nodeConfigs = ["node1", "node2", "node3", "node4"].map(remoteConfig);
const config = Effect.firstSuccessOf([masterConfig, ...nodeConfigs]);
const result = Effect.runSync(config);
console.log(result);
