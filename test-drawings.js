'use strict';
const assert = require('node:assert/strict');
const Drawing = require('./drawing-layout.js');
function measure(text, fontSize) {
  return { width: String(text).length * fontSize * .54, height: fontSize };
}
function lineBounds(line) {
  const rotated = line.rotation === -90 || line.rotation === 90;
  const boxW = rotated ? line.height : line.width;
  const boxH = rotated ? line.width : line.height;
  return { x1:line.x-boxW/2, x2:line.x+boxW/2, y1:line.y-boxH/2, y2:line.y+boxH/2 };
}
function assertInBox(result, width, height, label) {
  assert.equal(result.type, 'inside', `${label}: labels must be inside the part`);
  assert.ok(Array.isArray(result.lines) && result.lines.length > 0, `${label}: in-box lines must exist`);
  const boxes=result.lines.map(lineBounds);
  for (const b of boxes) {
    assert.ok(b.x1 >= -1e-5, `${label}: text left stays inside`);
    assert.ok(b.x2 <= width + 1e-5, `${label}: text right stays inside`);
    assert.ok(b.y1 >= -1e-5, `${label}: text top stays inside`);
    assert.ok(b.y2 <= height + 1e-5, `${label}: text bottom stays inside`);
  }
  for(let i=0;i<boxes.length;i++) for(let j=i+1;j<boxes.length;j++) {
    const a=boxes[i],b=boxes[j];
    const overlapX=Math.min(a.x2,b.x2)-Math.max(a.x1,b.x1);
    const overlapY=Math.min(a.y2,b.y2)-Math.max(a.y1,b.y1);
    assert.ok(!(overlapX>0.01 && overlapY>0.01), `${label}: text lines ${i} and ${j} overlap`);
  }
}

// Legacy label helper remains available for callers/tests that still use it.
const legacy = Drawing.layoutPartLabel({reference:'A1',dimensionA:'120',dimensionB:'80',width:55,height:35,printScale:.16,measure});
assert.ok(['inside','callout'].includes(legacy.type));

const normal = Drawing.layoutOrientedPartLabel({
  reference:'18KB',horizontalDimension:'480',verticalDimension:'1200',
  lengthDimension:'1200',widthDimension:'480',lengthMm:1200,widthMm:480,
  width:480,height:1200,printScale:.114,measure
});
assertInBox(normal,480,1200,'regular large panel');
assert.equal(normal.oriented,true,'regular panel keeps separate edge-aligned labels when they fit');
assert.equal(normal.physicalPt,11.5,'regular label target is gently increased to 11.5 pt');
assert.equal(normal.lines[1].rotation,0,'width label follows horizontal edge');
assert.equal(normal.lines[2].rotation,-90,'length label follows vertical edge');
assert.equal(normal.referencePt,10,'reference must remain at its previous 10 pt size');
assert.equal(normal.lines[0].physicalPt,10,'reference line must not inherit the increased dimension font');
assert.ok(normal.lines.slice(1).every(line => Math.abs(line.fontSize * .114 / (25.4/72) - 11.5) < 1e-6), 'dimension labels use the 11.5 pt target when they fit');
assert.ok(normal.lines.every(line=>line.fontSize < 20*25.4/72/.114),'font remains moderate after the small increase');

const smallByWidth = Drawing.layoutOrientedPartLabel({
  reference:'SMALL-W',horizontalDimension:'89',verticalDimension:'500',
  lengthDimension:'500',widthDimension:'89',lengthMm:500,widthMm:89,
  width:89,height:500,printScale:.114,measure
});
assertInBox(smallByWidth,89,500,'small by width');
assert.equal(smallByWidth.smallPanel,true);
assert.equal(smallByWidth.combinedDimensions,'500 × 89');
assert.ok(smallByWidth.lines.some(line=>line.text==='500 × 89'));
assert.equal(smallByWidth.lines.find(line=>line.text==='SMALL-W').physicalPt,10,'small-panel reference keeps previous font size');

const smallByLength = Drawing.layoutOrientedPartLabel({
  reference:'SMALL-L',horizontalDimension:'180',verticalDimension:'80',
  lengthDimension:'80',widthDimension:'180',lengthMm:80,widthMm:180,
  width:180,height:80,printScale:.114,measure
});
assertInBox(smallByLength,180,80,'small by length');
assert.equal(smallByLength.smallPanel,true);
assert.equal(smallByLength.combinedDimensions,'80 × 180');
assert.ok(smallByLength.lines.some(line=>line.text==='80 × 180'));
assert.equal(smallByLength.lines.find(line=>line.text==='SMALL-L').physicalPt,10,'small-panel reference keeps previous font size');

const threshold90 = Drawing.layoutOrientedPartLabel({
  reference:'AT-90',horizontalDimension:'90',verticalDimension:'600',
  lengthDimension:'600',widthDimension:'90',lengthMm:600,widthMm:90,
  width:90,height:600,printScale:.114,measure
});
assertInBox(threshold90,90,600,'exactly 90 mm');
assert.equal(threshold90.smallPanel,false,'exactly 90 mm is a regular panel');
assert.equal(Drawing.isSmallPanelByDimension(89,600),true);
assert.equal(Drawing.isSmallPanelByDimension(600,89),true);
assert.equal(Drawing.isSmallPanelByDimension(90,600),false);
assert.equal(Drawing.isSmallPanelByDimension(600,90),false);

const tiny = Drawing.layoutOrientedPartLabel({
  reference:'TINY-A',horizontalDimension:'50',verticalDimension:'80',
  lengthDimension:'80',widthDimension:'50',lengthMm:80,widthMm:50,
  width:80,height:50,printScale:.114,measure
});
assertInBox(tiny,80,50,'tiny panel');
assert.equal(tiny.smallPanel,true);
assert.ok(tiny.lines.some(line=>line.text.includes('80 × 50') || line.text.includes('80 × 50')));

// Extremely small printed parts still get a compressed label clipped to the
// rectangle's measured inner width; no marker or external schedule is emitted.
const sliver = Drawing.layoutOrientedPartLabel({
  reference:'S9',horizontalDimension:'5',verticalDimension:'12',
  lengthDimension:'12',widthDimension:'5',lengthMm:12,widthMm:5,
  width:12,height:5,printScale:.114,measure
});
assertInBox(sliver,12,5,'tiny sliver');
assert.equal(sliver.compressed,true,'unusually small parts use an in-box compressed line');
assert.equal(sliver.lines.length,1);
assert.ok(sliver.lines[0].text.includes('S9') && sliver.lines[0].text.includes('12 × 5'));
assert.ok(sliver.lines[0].textLength <= 12);

// Regression for the prior overlap bug: the previous code compared a reference Y
// coordinate against a vertical dimension X coordinate and accepted collisions.
const moved = Drawing.layoutOrientedPartLabel({
  reference:'BOUNDARY-A',horizontalDimension:'90',verticalDimension:'600',
  lengthDimension:'600',widthDimension:'90',lengthMm:600,widthMm:90,
  width:90,height:600,printScale:.114,measure,targetPt:11.5,referencePt:10
});
assertInBox(moved,90,600,'narrow regular panel');
assert.equal(moved.lines[0].physicalPt,10,'long reference remains at the previous size');
assert.equal(moved.lines[0].rotation,-90,'long reference rotates to use the long in-box axis');

// A broad mix of aspect ratios must keep every pair of text boxes separate.
for(const sample of [
  ['NARROW-REF-01',600,90,90,600],['NARROW-REF-02',900,95,95,900],
  ['WIDE-REF-03',520,120,520,120],['LARGE-04',1200,480,480,1200],
  ['SMALL-05',500,89,89,500],['SMALL-06',80,180,180,80],
  ['TINY-07',40,20,20,40],['SLIVER-08',12,5,5,12]
]) {
  const [reference,lengthMm,widthMm,width,height]=sample;
  const result=Drawing.layoutOrientedPartLabel({reference,horizontalDimension:String(widthMm),verticalDimension:String(lengthMm),lengthDimension:String(lengthMm),widthDimension:String(widthMm),lengthMm,widthMm,width,height,printScale:.114,measure,targetPt:11.5,referencePt:10});
  assertInBox(result,width,height,reference);
  if(lengthMm<90||widthMm<90) assert.ok(result.lines.some(line=>line.text.includes(`${lengthMm} × ${widthMm}`)),`${reference}: small part must use combined Length × Width`);
}

// No oriented panel should use the old external-callout result.
const samples = [
  {reference:'P1',lengthMm:1200,widthMm:480,width:480,height:1200},
  {reference:'P2',lengthMm:600,widthMm:89,width:89,height:600},
  {reference:'P3',lengthMm:80,widthMm:180,width:180,height:80},
  {reference:'P4',lengthMm:40,widthMm:20,width:40,height:20},
  {reference:'P5',lengthMm:10,widthMm:6,width:10,height:6}
];
for (const sample of samples) {
  const result = Drawing.layoutOrientedPartLabel({
    reference:sample.reference,horizontalDimension:String(sample.widthMm),verticalDimension:String(sample.lengthMm),
    lengthDimension:String(sample.lengthMm),widthDimension:String(sample.widthMm),
    lengthMm:sample.lengthMm,widthMm:sample.widthMm,width:sample.width,height:sample.height,
    printScale:.114,measure
  });
  assertInBox(result,sample.width,sample.height,sample.reference);
  assert.notEqual(result.type,'callout');
}

console.log('Drawing label tests passed: 10 pt references, 11.5 pt dimension target, collision-free movable labels, small-panel Length × Width, adaptive in-box fallback, strict 90 mm boundary, and no external callouts.');
