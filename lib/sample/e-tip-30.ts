// tip 30
interface LngLat {
  lng: number;
  lat: number;
}
type LngLatLike = LngLat | { lon: number; lat: number } | [number, number];
interface Camera {
  center: LngLat;
  zoom: number;
  bearing: number;
  pitch: number;
}
interface CameraOptions extends Omit<Partial<Camera>, "center"> {
  center?: LngLatLike;
}
type LngLatBounds =
  | { northeast: LngLatLike; southeast: LngLatLike }
  | [LngLatLike, LngLatLike]
  | [number, number, number, number];

declare function _setCamera(camera: CameraOptions): void;
declare function _viewportForBounds(bounds: LngLatBounds): Camera;

function sum(xs: Iterable<number>): number {
  let sum = 0;
  for (const x of xs) {
    sum += x;
  }
  return sum;
}

console.log(sum([1, 2, 3]));

function* range(limit: number) {
  for (let i = 0; i < limit; i++) {
    yield i;
  }
}
console.log(sum(range(10)));

interface ABC {
  a: string;
  b: string;
  c: string;
}

type FooType = (abc: ABC) => void;
const loopFoo: FooType = (abc: ABC) => {
  for (const kStr in abc) {
    const k = kStr as keyof typeof abc;
    const v = abc[k];
    console.log(v);
  }
};

loopFoo({ a: "a", b: "b", c: "c" });
