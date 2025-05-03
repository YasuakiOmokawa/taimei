interface FormattedValue {
  value: number;
  units: string;
}
function formatValue(value: FormattedValue) {
  return value.value;
}

interface Hike {
  miles: number;
  hours: number;
}
function formatHike({ miles, hours }: Hike) {
  const distanceDisplay = formatValue({ value: miles, units: "miles" });
  const paceDisplay = formatValue({ value: miles / hours, units: "mph" });
  return `${distanceDisplay} at ${paceDisplay}`;
}

console.log(formatHike({ miles: 1, hours: 1 }));
