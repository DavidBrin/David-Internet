"use client";

/**
 * Bottom strip: CrossDetection.py, a deeper cross-teaching pair (detection, not
 * segmentation) that was written but never trained or run. Explanation and
 * visualization only - no live data backs this card.
 */
export default function DetectorCard() {
  return (
    <div className="ctADetector">
      <h3 className="ctADetectorTitle">The deeper pair that never ran</h3>
      <div className="ctADetectorBody">
        <svg
          className="ctADetectorSvg"
          viewBox="0 0 280 96"
          role="img"
          aria-label="A Faster R-CNN detector and a ViT detection head exchanging a dashed pseudo bounding box"
        >
          <defs>
            <marker id="ctAArrowHead" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" className="ctADetArrowHead" />
            </marker>
          </defs>

          <rect x="6" y="20" width="88" height="56" rx="6" className="ctADetBox ctADetBoxA" />
          <text x="50" y="46" textAnchor="middle" className="ctADetLabel">
            <tspan x="50" dy="0">Faster R-CNN</tspan>
            <tspan x="50" dy="14">ResNet-50 FPN</tspan>
          </text>

          <rect x="186" y="20" width="88" height="56" rx="6" className="ctADetBox ctADetBoxB" />
          <text x="230" y="46" textAnchor="middle" className="ctADetLabel">
            <tspan x="230" dy="0">ViT detection head</tspan>
            <tspan x="230" dy="14">cls + bbox / patch</tspan>
          </text>

          <rect x="118" y="36" width="44" height="24" rx="2" className="ctADetBoxDashed" />
          <text x="140" y="51" textAnchor="middle" className="ctADetBoxDashedLabel">box</text>

          <line x1="94" y1="42" x2="116" y2="42" className="ctADetArrow" markerEnd="url(#ctAArrowHead)" />
          <line x1="164" y1="54" x2="186" y2="54" className="ctADetArrow" markerEnd="url(#ctAArrowHead)" />
        </svg>

        <div className="ctADetectorText">
          <p className="ctADetectorPara">
            The same repo also holds <span className="ctMono">CrossDetection.py</span>: cross-teaching rebuilt for
            object detection instead of segmentation - a torchvision Faster R-CNN with a ResNet-50 FPN backbone
            exchanging pseudo-boxes with a custom ViT detection head (a per-patch classifier plus a bounding-box
            regressor) over the 37 Oxford-Pet breeds.
          </p>
          <blockquote className="ctADetectorQuote">
            &quot;We never got to testing, training, or even proofreading this code.&quot;
          </blockquote>
          <p className="ctADetectorPara ctADetectorNote">
            This card is explanation and visualization only - the sketch above is static, no checkpoint backs it, and
            the pair was never trained or evaluated. Read the untouched code in the CrossDetection.py tab of the
            Source drawer above.
          </p>
        </div>
      </div>
    </div>
  );
}
