type UnitSystem = "metric" | "imperial";
interface InputAppConfig {
  darkMode: boolean;
  unitSystem?: UnitSystem;
}
interface AppConfig extends InputAppConfig {
  unitSystem: UnitSystem;
}
// type AppConfig2 = Required<InputAppConfig>;
function normalizeAppConfig(inputConfig: InputAppConfig): AppConfig {
  return {
    ...inputConfig,
    unitSystem: inputConfig.unitSystem ?? "metric",
  };
}
interface FormattedValue {
  value: number;
  units: string;
  unitSystem: UnitSystem;
}
function formatValue(value: FormattedValue) {
  return value.value;
}

interface Hike {
  miles: number;
  hours: number;
}
function formatHike({ miles, hours }: Hike, config: AppConfig) {
  const { unitSystem } = config;
  const distanceDisplay = formatValue({
    value: miles,
    units: "miles",
    unitSystem,
  });
  const paceDisplay = formatValue({
    value: miles / hours,
    units: "mph",
    unitSystem,
  });
  return `${distanceDisplay} at ${paceDisplay} by ${unitSystem}`;
}

console.log(
  formatHike(
    { miles: 1, hours: 1 },
    normalizeAppConfig({ darkMode: true, unitSystem: "imperial" })
  )
);

interface Vector2D {
  x: number;
  y: number;
}
function calculateLength(v: Vector2D) {
  return Math.sqrt(v.x ** 2 + v.y ** 2);
}
interface Vector3D {
  x: number;
  y: number;
  z: number;
}
function normalize(v: Vector3D) {
  const length = calculateLength(v);
  return {
    x: v.x / length,
    y: v.y / length,
    z: v.z / length,
  };
}

console.log(normalize({ x: 3, y: 4, z: 5 }));

function calculateLengthL1(v: Vector3D) {
  const keys = ["x", "y", "z"] as const;
  let length = 0;
  for (const k of keys) {
    const coord = v[k];
    length += Math.abs(coord);
  }
  return length;
}
const vec3D = { x: 3, y: 4, z: 5, address: "saitama" };
console.log(calculateLengthL1(vec3D));

import { ok, err, Result } from "neverthrow";

const myResult = ok({ myData: "test" });
console.log(myResult.isOk());
console.log(myResult.isErr());

const myError = err("no");
console.log(myError.isOk());
console.log(myError.isErr());

const sq = (n: number): Result<number, number> => ok(n ** 2);
console.log(ok(2).andThen(sq).andThen(sq)); // 16
console.log(ok(2).andThen(sq).andThen(err)); // 4
console.log(ok(5).andThen(sq).andThrough(err)); // 4
