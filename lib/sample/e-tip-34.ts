// interface Layer {
//   layout: FillLayout | LineLayout | PointLayout;
//   paint: FillPaint | LinePaint | PointPaint;
// }

interface FillLayer {
  type: "fill";
  layout: FillLayout;
  paint: FillPaint;
}

interface LineLayer {
  type: "line";
  layout: LineLayout;
  paint: LinePaint;
}

interface PaintLayer {
  type: "paint";
  layout: PaintLayout;
  paint: PaintPaint;
}
type Layer = FillLayer | LineLayer | PaintLayer;
