// interface Layer {
//   layout: FillLayout | LineLayout | PointLayout;
//   paint: FillPaint | LinePaint | PointPaint;
// }

interface FillLayout {
  name: string;
}
interface FillPaint {
  name: string;
}
interface LineLayout {
  name: string;
}
interface LinePaint {
  name: string;
}
interface PaintLayout {
  name: string;
}
interface PaintPaint {
  name: string;
}

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

// interface Person {
//   name: string;
//   birth?: {
//     place: string;
//     date: Date;
//   };
// }

interface Name {
  name: string;
}

interface PersonWithBirth extends Name {
  placeOfBirth: string;
  dateObBirth: Date;
}

type Person = Name | PersonWithBirth;
