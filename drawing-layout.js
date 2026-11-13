/* Print-scale-aware part-label fitting shared by the SVG drawing UI and tests. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.CutPlanDrawing=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const PT_TO_MM=25.4/72;
  // A part uses combined Length × Width labels when either source dimension is
  // strictly below 90 mm. This rule is based on the part dimensions, not print scale.
  const SMALL_PANEL_DIMENSION_THRESHOLD_MM=90;
  function isSmallPanelByDimension(length,width,threshold=SMALL_PANEL_DIMENSION_THRESHOLD_MM){
    const l=Number(length),w=Number(width),limit=Number(threshold)||SMALL_PANEL_DIMENSION_THRESHOLD_MM;
    return Number.isFinite(l)&&Number.isFinite(w)&&l>0&&w>0&&(l<limit||w<limit);
  }
  function dimensionValue(value){
    const match=String(value??'').trim().replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);
    return match?Number(match[0]):NaN;
  }
  function fallbackMeasure(text,fontSize){
    return {width:String(text).length*fontSize*.54,height:fontSize};
  }
  function layoutPartLabel(options={}){
    const w=Number(options.width)||0,h=Number(options.height)||0;
    const ref=String(options.reference??''),dimA=String(options.dimensionA??''),dimB=String(options.dimensionB??'');
    const scale=Math.max(Number(options.printScale)||0.1,0.0001);
    const measure=typeof options.measure==='function'?options.measure:fallbackMeasure;
    const minPt=Number(options.minReadablePt)||6,targetPt=Number(options.targetPt)||10;
    const patterns=[
      [ref,`${dimA} × ${dimB}`],
      [`${dimA} × ${dimB}`,ref],
      [ref,dimA,dimB],
      [dimA,ref,dimB],
      [dimA,dimB,ref]
    ];
    const padBase=Math.max(.5,Math.min(2,Math.min(w,h)*.08));
    for(let pt=targetPt;pt>=minPt-1e-6;pt-=.5){
      const fontSize=pt*PT_TO_MM/scale;
      for(let pi=0;pi<patterns.length;pi++){
        const lines=patterns[pi];
        const metrics=lines.map(text=>({text,...measure(text,fontSize)}));
        const gap=fontSize*.16;
        const totalHeight=metrics.reduce((sum,m)=>sum+m.height,0)+gap*(metrics.length-1);
        const pad=Math.min(padBase,Math.max(.2,(Math.min(w,h)-totalHeight)*.1));
        if(totalHeight>h-2*pad+1e-6) continue;
        const positions=[
          {anchor:'middle',x:w/2,y:(h-totalHeight)/2},
          {anchor:'middle',x:w*.38,y:(h-totalHeight)/2},
          {anchor:'middle',x:w*.62,y:(h-totalHeight)/2},
          {anchor:'start',x:pad,y:(h-totalHeight)/2},
          {anchor:'end',x:w-pad,y:(h-totalHeight)/2},
          {anchor:'middle',x:w/2,y:pad},
          {anchor:'middle',x:w/2,y:h-pad-totalHeight}
        ];
        for(let oi=0;oi<positions.length;oi++){
          const pos=positions[oi];
          if(metrics.some(m=>m.width>w-2*pad+1e-6)) continue;
          const minX=pos.anchor==='middle'?pos.x-Math.max(...metrics.map(m=>m.width))/2:pos.anchor==='start'?pos.x:pos.x-Math.max(...metrics.map(m=>m.width));
          const maxX=pos.anchor==='middle'?pos.x+Math.max(...metrics.map(m=>m.width))/2:pos.anchor==='start'?pos.x+Math.max(...metrics.map(m=>m.width)):pos.x;
          if(minX<pad-1e-6||maxX>w-pad+1e-6) continue;
          let cursor=pos.y;
          const fitted=metrics.map(m=>{
            const y=cursor+m.height/2; cursor+=m.height+gap;
            return {text:m.text,x:pos.x,y,anchor:pos.anchor,fontSize,width:m.width,height:m.height};
          });
          const top=fitted[0].y-fitted[0].height/2,bottom=fitted.at(-1).y+fitted.at(-1).height/2;
          if(top<pad-1e-6||bottom>h-pad+1e-6) continue;
          return {type:'inside',lines:fitted,fontSize,physicalPt:pt,pattern:pi,position:oi};
        }
      }
    }
    return {type:'callout',marker:null,markerLayout:fitMarker(options.marker||'1',w,h,scale,measure)};
  }

  /* In-box axis-oriented labels with collision-aware placement.
     References keep the previous 10 pt target; dimension numbers use 11.5 pt
     when space permits. Every candidate is measured and checked as a real
     rotated/unrotated bounding box before it is returned. */
  function layoutOrientedPartLabel(options={}){
    const w=Number(options.width)||0,h=Number(options.height)||0;
    const ref=String(options.reference??'').trim();
    const horizontal=String(options.horizontalDimension??'').trim();
    const vertical=String(options.verticalDimension??'').trim();
    const scale=Math.max(Number(options.printScale)||0.1,0.0001);
    const measure=typeof options.measure==='function'?options.measure:fallbackMeasure;
    const targetDimPt=Number(options.targetPt)||11.5;
    const targetRefPt=Math.min(targetDimPt,Number(options.referencePt)||10);
    const minPt=Math.min(targetRefPt,Math.max(.75,Number(options.minReadablePt)||4.5));
    const pad=Math.max(.16,Math.min(1.25,Math.min(w,h)*.055));
    const gapMm=Math.max(.75,Math.min(1.6,Math.min(w,h)*.012));
    // Canvas gives glyph-only ascent/descent, while SVG's dominant-baseline
    // rendering occupies a taller line box. Use the full line box for height
    // checks and a small width margin to avoid browser/PDF edge collisions.
    const WIDTH_SAFETY=1.02, LINE_HEIGHT_FACTOR=1.15;
    const stripUnit=value=>String(value??'').trim().replace(/\s*mm\s*$/i,'').trim();
    const length=stripUnit(options.lengthDimension??vertical);
    const width=stripUnit(options.widthDimension??horizontal);
    const lengthMm=Number.isFinite(Number(options.lengthMm))?Number(options.lengthMm):dimensionValue(length);
    const widthMm=Number.isFinite(Number(options.widthMm))?Number(options.widthMm):dimensionValue(width);
    const smallPanel=isSmallPanelByDimension(lengthMm,widthMm,options.smallPanelThresholdMm||SMALL_PANEL_DIMENSION_THRESHOLD_MM);
    const combinedDimensions=length&&width?`${length} × ${width}`:`${length||width}`;
    const sizeFor=pt=>pt*PT_TO_MM/scale;
    const makeLine=(text,pt,x,y,rotation=0,anchor='middle')=>{
      const fontSize=sizeFor(pt),m=measure(text,fontSize);
      return {text,x,y,anchor,fontSize,width:m.width*WIDTH_SAFETY,height:Math.max(m.height,fontSize*LINE_HEIGHT_FACTOR),rotation,physicalPt:pt};
    };
    const bounds=line=>{
      const bw=line.rotation===0?line.width:line.height;
      const bh=line.rotation===0?line.height:line.width;
      let x1=line.x-bw/2,x2=line.x+bw/2;
      if(line.anchor==='start'){x1=line.x;x2=line.x+bw;}
      if(line.anchor==='end'){x1=line.x-bw;x2=line.x;}
      return {x1,y1:line.y-bh/2,x2,y2:line.y+bh/2};
    };
    const inside=(b)=>b.x1>=pad-1e-5&&b.y1>=pad-1e-5&&b.x2<=w-pad+1e-5&&b.y2<=h-pad+1e-5;
    const noCollision=(lines)=>{
      const boxes=lines.map(bounds);
      if(boxes.some(b=>!inside(b))) return false;
      for(let i=0;i<boxes.length;i++) for(let j=i+1;j<boxes.length;j++){
        const a=boxes[i],b=boxes[j];
        const overlapX=Math.min(a.x2,b.x2)-Math.max(a.x1,b.x1);
        const overlapY=Math.min(a.y2,b.y2)-Math.max(a.y1,b.y1);
        if(overlapX>-.0001&&overlapY>-.0001) return false;
        // Keep a small visual gutter even when glyph boxes do not intersect.
        const separatedX=a.x2+gapMm<=b.x1||b.x2+gapMm<=a.x1;
        const separatedY=a.y2+gapMm<=b.y1||b.y2+gapMm<=a.y1;
        if(!separatedX&&!separatedY) return false;
      }
      return true;
    };
    const points=(fractions)=>fractions;

    // Small panels always use one combined Length × Width line, not two
    // dimension labels placed along separate edges.
    // Regular panels first try edge labels. A collision triggers alternative
    // positions inside the rectangle; only then do we use combined notation.
    if(!smallPanel&&ref&&horizontal&&vertical){
      const hX=[.5,.33,.67];
      const hYOrder=['bottom','top','lower','upper'];
      const vY=[.5,.33,.67];
      const vXOrder=['left','right','innerLeft','innerRight'];
      const refPoints=[
        [.5,.5],[.5,.32],[.5,.68],[.32,.5],[.68,.5],
        [.32,.32],[.68,.32],[.32,.68],[.68,.68]
      ];
      const dimPts=[];
      for(let pt=targetDimPt;pt>minPt;pt-=.5) dimPts.push(pt);
      dimPts.push(minPt);
      const refPts=[];
      for(let pt=targetRefPt;pt>=minPt-1e-6;pt-=.5) refPts.push(pt);
      if(!refPts.length||Math.abs(refPts.at(-1)-minPt)>.01) refPts.push(minPt);
      for(const dimPt of dimPts){
        const hFs=sizeFor(dimPt),vFs=hFs;
        const hm=measure(horizontal,hFs),vm=measure(vertical,vFs);
        const hTextHeight=Math.max(hm.height,hFs*LINE_HEIGHT_FACTOR),vTextHeight=Math.max(vm.height,vFs*LINE_HEIGHT_FACTOR);
        const hCandidates=[];
        for(const edge of hYOrder){
          const y=edge==='bottom'?h-pad-hTextHeight/2:edge==='top'?pad+hTextHeight/2:edge==='lower'?h*.76:h*.24;
          for(const fx of hX) hCandidates.push(makeLine(horizontal,dimPt,w*fx,y,0));
        }
        const vCandidates=[];
        for(const edge of vXOrder){
          const x=edge==='left'?pad+vTextHeight/2:edge==='right'?w-pad-vTextHeight/2:edge==='innerLeft'?w*.28:w*.72;
          for(const fy of vY) vCandidates.push(makeLine(vertical,dimPt,x,h*fy,-90));
        }
        for(const hl of hCandidates){
          for(const vl of vCandidates){
            if(!noCollision([hl,vl])) continue;
            for(const refPt of refPts){
              for(const rotation of [0,-90]){
                const found=refPoints.map(([fx,fy])=>makeLine(ref,refPt,w*fx,h*fy,rotation)).find(rl=>noCollision([hl,vl,rl]));
                if(found) return {type:'inside',oriented:true,smallPanel:false,physicalPt:dimPt,referencePt:found.physicalPt,lines:[found,hl,vl],placement:'collision-checked-edges'};
              }
            }
          }
        }
      }
    }

    // Combined block: reference stays at its previous 10 pt target and the
    // dimensions get the larger target where the actual panel has room.
    const refPtValues=[];
    for(let pt=targetRefPt;pt>minPt;pt-=.5) refPtValues.push(pt);
    refPtValues.push(minPt);
    const dimPtValues=[];
    for(let pt=targetDimPt;pt>minPt;pt-=.5) dimPtValues.push(pt);
    dimPtValues.push(minPt);
    const orientations=w>=h?[0,-90]:[-90,0];
    for(const rotation of orientations){
      for(const dimPt of dimPtValues){
        const dimLine=makeLine(combinedDimensions,dimPt,0,0,0);
        for(const refPt of refPtValues){
          const refLine=makeLine(ref,refPt,0,0,0);
          if(rotation===0){
            const totalHeight=refLine.height+dimLine.height+gapMm;
            if(refLine.width>w-2*pad||dimLine.width>w-2*pad||totalHeight>h-2*pad) continue;
            const y0=(h-totalHeight)/2;
            const lines=[
              makeLine(ref,refPt,w/2,y0+refLine.height/2,0),
              makeLine(combinedDimensions,dimPt,w/2,y0+refLine.height+gapMm+dimLine.height/2,0)
            ];
            if(noCollision(lines)) return {type:'inside',smallPanel,combinedFallback:!smallPanel,combinedDimensions,physicalPt:dimPt,referencePt:refPt,lines,placement:'combined-horizontal'};
          }else{
            const totalAcross=refLine.height+dimLine.height+gapMm;
            if(totalAcross>w-2*pad||refLine.width>h-2*pad||dimLine.width>h-2*pad) continue;
            const x0=(w-totalAcross)/2;
            const lines=[
              makeLine(ref,refPt,x0+refLine.height/2,h/2,-90),
              makeLine(combinedDimensions,dimPt,x0+refLine.height+gapMm+dimLine.height/2,h/2,-90)
            ];
            if(noCollision(lines)) return {type:'inside',smallPanel,combinedFallback:!smallPanel,combinedDimensions,physicalPt:dimPt,referencePt:refPt,lines,placement:'combined-vertical'};
          }
        }
      }
    }

    // Last resort for very narrow/small pieces: compress a single combined
    // line to the inner long side. The reference uses 10 pt or smaller; it is
    // never enlarged to the dimension target size.
    const text=ref&&combinedDimensions?`${ref} · ${combinedDimensions}`:(ref||combinedDimensions||'');
    const horizontalOrientation=w>=h;
    const longSide=Math.max(.05,(horizontalOrientation?w:h)-2*pad);
    const shortSide=Math.max(.05,(horizontalOrientation?h:w)-2*pad);
    const refFs=sizeFor(minPt),dimFs=sizeFor(minPt);
    const lineMetrics=measure(text,Math.min(refFs,dimFs));
    const fs=Math.max(.05,Math.min(sizeFor(minPt),shortSide*.62));
    return {type:'inside',smallPanel,combinedFallback:!smallPanel,combinedDimensions,physicalPt:fs*scale/PT_TO_MM,compressed:true,lines:[{
      text,x:w/2,y:h/2,anchor:'middle',fontSize:fs,width:longSide,height:Math.min(shortSide,Math.max(lineMetrics.height,fs*LINE_HEIGHT_FACTOR)),rotation:horizontalOrientation?0:-90,textLength:longSide
    }]};
  }
  function fitMarker(marker,w,h,scale,measure=fallbackMeasure){
    const pad=Math.max(.1,Math.min(.8,Math.min(w,h)*.06));
    for(let pt=8;pt>=4;pt-=.5){
      const fontSize=pt*PT_TO_MM/Math.max(scale,.0001),m=measure(String(marker),fontSize);
      if(m.width<=w-2*pad&&m.height<=h-2*pad) return {text:String(marker),x:w/2,y:h/2,anchor:'middle',fontSize,width:m.width,height:m.height,physicalPt:pt};
    }
    // For exceptionally thin slivers, fit the biggest contained marker even if
    // it drops below the nominal 4 pt minimum; the external schedule remains authoritative.
    const maxFont=Math.max(.15,Math.min((w-2*pad)/Math.max(1,String(marker).length*.6),(h-2*pad)));
    const m=measure(String(marker),maxFont);
    return {text:String(marker),x:w/2,y:h/2,anchor:'middle',fontSize:maxFont,width:m.width,height:m.height,physicalPt:maxFont*scale/PT_TO_MM};
  }
  return {layoutPartLabel,layoutOrientedPartLabel,fitMarker,isSmallPanelByDimension,SMALL_PANEL_DIMENSION_THRESHOLD_MM};
});
