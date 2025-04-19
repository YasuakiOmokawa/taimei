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
