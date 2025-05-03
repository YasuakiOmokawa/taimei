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
