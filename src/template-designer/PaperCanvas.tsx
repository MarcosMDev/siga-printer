import React, { useRef, useCallback, useState } from 'react';
import {
  View, Text, ScrollView, PanResponder,
  StyleSheet, TouchableOpacity, Platform,
} from 'react-native';

import type { DesignerBlock, DesignerBlockType, BlockGeometry } from './types';
import { BLOCK_META, estimateBlockHeightMm, mmToPx, pxToMm, snapToGrid } from './types';
import type { PrintOrientation } from '../types';

// ─────────────────────────────────────────────────────────────
//  PaperCanvas
//
//  The core canvas where blocks are positioned freely.
//  Uses PanResponder for drag handling — no external libs needed.
//
//  Coordinate system: mm from top-left of paper.
//  Blocks are rendered as absolutely-positioned views.
// ─────────────────────────────────────────────────────────────

interface PaperCanvasProps {
  blocks:          DesignerBlock[];
  selectedId:      string | null;
  paperWidth:      number;  // mm
  canvasHeightMm:  number;
  mmScale:         number;  // px per mm
  orientation:     PrintOrientation;
  showGrid:        boolean;
  snapEnabled:     boolean;
  gridMm:          number;
  onSelectBlock:   (id: string | null) => void;
  onUpdateGeometry:(id: string, geom: Partial<BlockGeometry>) => void;
  onAddBlock:      (type: DesignerBlockType) => void;
}

// Landscape canvas: paper feeds horizontally, so width = paper length (variable)
// For display we fix canvas width to paperWidth × scale and height to canvasHeight
// The labels at left/right edges show paper orientation

export function PaperCanvas({
  blocks, selectedId, paperWidth, canvasHeightMm,
  mmScale, orientation, showGrid, snapEnabled, gridMm,
  onSelectBlock, onUpdateGeometry, onAddBlock,
}: PaperCanvasProps) {
  const canvasPx = {
    w: mmToPx(paperWidth, mmScale),
    h: mmToPx(canvasHeightMm, mmScale),
  };

  // For landscape, rotate label but keep same canvas (paper rotated in rasterizer)
  const isLandscape = orientation === 'landscape';

  return (
    <ScrollView
      style={styles.outerScroll}
      contentContainerStyle={styles.outerContent}
      showsVerticalScrollIndicator
    >
      {/* Paper label */}
      <View style={styles.paperMeta}>
        <Text style={styles.paperMetaText}>
          {paperWidth}mm {isLandscape ? '↔ Paisagem' : '↕ Retrato'}
          {' '}• {canvasHeightMm}mm comprimento
        </Text>
      </View>

      {/* Paper shadow wrapper */}
      <View style={styles.canvasShadow}>
        {/* Paper surface */}
        <View
          style={[styles.paper, { width: canvasPx.w, height: canvasPx.h }]}
        >
          {/* Grid */}
          {showGrid && (
            <GridOverlay
              w={canvasPx.w}
              h={canvasPx.h}
              gridMm={gridMm}
              mmScale={mmScale}
            />
          )}

          {/* Paper edge markers */}
          <View style={[styles.edgeMarker, styles.edgeLeft]} />
          <View style={[styles.edgeMarker, styles.edgeRight]} />

          {/* Blocks */}
          {blocks.map(block => (
            <DraggableBlock
              key={block.id}
              block={block}
              isSelected={block.id === selectedId}
              mmScale={mmScale}
              paperWidthMm={paperWidth}
              canvasHeightMm={canvasHeightMm}
              snapEnabled={snapEnabled}
              gridMm={gridMm}
              onSelect={() => onSelectBlock(block.id)}
              onGeometryChange={geom => onUpdateGeometry(block.id, geom)}
            />
          ))}

          {/* Tap to deselect */}
          {selectedId && (
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              onPress={() => onSelectBlock(null)}
              activeOpacity={1}
            />
          )}

          {/* Empty state hint */}
          {blocks.length === 0 && (
            <View style={styles.emptyHint} pointerEvents="none">
              <Text style={styles.emptyHintIcon}>📄</Text>
              <Text style={styles.emptyHintText}>Canvas vazio</Text>
              <Text style={styles.emptyHintSub}>Adicione blocos pelo painel esquerdo</Text>
            </View>
          )}
        </View>

        {/* Ruler right side (mm marks) */}
        <RulerRight h={canvasPx.h} mmScale={mmScale} canvasHeightMm={canvasHeightMm} />
      </View>

      {/* Ruler bottom (mm marks) */}
      <RulerBottom w={canvasPx.w} mmScale={mmScale} paperWidthMm={paperWidth} />
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────
//  DraggableBlock
// ─────────────────────────────────────────────────────────────

interface DraggableBlockProps {
  block:            DesignerBlock;
  isSelected:       boolean;
  mmScale:          number;
  paperWidthMm:     number;
  canvasHeightMm:   number;
  snapEnabled:      boolean;
  gridMm:           number;
  onSelect:         () => void;
  onGeometryChange: (geom: Partial<BlockGeometry>) => void;
}

function DraggableBlock({
  block, isSelected, mmScale, paperWidthMm, canvasHeightMm,
  snapEnabled, gridMm, onSelect, onGeometryChange,
}: DraggableBlockProps) {
  const { geometry, data, locked } = block;
  const meta = BLOCK_META[data.type];

  // Current position as px (derived from mm geometry)
  const startPos = useRef({ x: 0, y: 0 });
  const startGeo = useRef({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  // Resize handle state
  const isResizing = useRef(false);
  const resizeStart = useRef({ x: 0, w: 0 });

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => !locked,
    onMoveShouldSetPanResponder:  (_, g) => !locked && (Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3),

    onPanResponderGrant: (evt) => {
      onSelect();
      startPos.current = { x: evt.nativeEvent.pageX, y: evt.nativeEvent.pageY };
      startGeo.current = { x: geometry.x, y: geometry.y };
      setDragging(true);
    },

    onPanResponderMove: (_, g) => {
      let newXmm = startGeo.current.x + pxToMm(g.dx, mmScale);
      let newYmm = startGeo.current.y + pxToMm(g.dy, mmScale);

      // Clamp to paper
      newXmm = Math.max(0, Math.min(paperWidthMm - geometry.w, newXmm));
      newYmm = Math.max(0, Math.min(canvasHeightMm - geometry.h, newYmm));

      // Snap to grid
      if (snapEnabled) {
        newXmm = snapToGrid(newXmm, gridMm);
        newYmm = snapToGrid(newYmm, gridMm);
      }

      onGeometryChange({ x: newXmm, y: newYmm });
    },

    onPanResponderRelease: () => {
      setDragging(false);
    },
  });

  // Resize pan responder (right edge handle)
  const resizePan = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      isResizing.current = true;
      resizeStart.current = { x: evt.nativeEvent.pageX, w: geometry.w };
    },
    onPanResponderMove: (_, g) => {
      let newW = resizeStart.current.w + pxToMm(g.dx, mmScale);
      newW = Math.max(10, Math.min(paperWidthMm - geometry.x, newW));
      if (snapEnabled) newW = snapToGrid(newW, gridMm);
      onGeometryChange({ w: newW });
    },
    onPanResponderRelease: () => { isResizing.current = false; },
  });

  const px = {
    x: mmToPx(geometry.x, mmScale),
    y: mmToPx(geometry.y, mmScale),
    w: mmToPx(geometry.w, mmScale),
    h: mmToPx(geometry.h, mmScale),
  };

  return (
    <View
      style={[
        styles.block,
        {
          left:   px.x,
          top:    px.y,
          width:  px.w,
          minHeight: px.h,
        },
        isSelected && styles.blockSelected,
        dragging   && styles.blockDragging,
        locked     && styles.blockLocked,
        { borderColor: meta.color + (isSelected ? 'ff' : '88') },
      ]}
      {...panResponder.panHandlers}
    >
      {/* Block content preview */}
      <BlockContentPreview data={data} width={px.w} />

      {/* Type badge */}
      <View style={[styles.blockBadge, { backgroundColor: meta.color + 'dd' }]}>
        <Text style={styles.blockBadgeText}>{meta.icon}</Text>
      </View>

      {/* Lock indicator */}
      {locked && (
        <View style={styles.lockIcon}>
          <Text style={styles.lockIconText}>🔒</Text>
        </View>
      )}

      {/* Selected handles */}
      {isSelected && !locked && (
        <>
          {/* Resize handle (right edge) */}
          <View
            style={styles.resizeHandle}
            {...resizePan.panHandlers}
          >
            <View style={styles.resizeHandleLine} />
          </View>

          {/* Geometry label */}
          <View style={styles.geoLabel} pointerEvents="none">
            <Text style={styles.geoLabelText}>
              {geometry.x.toFixed(1)},{geometry.y.toFixed(1)} mm  {geometry.w.toFixed(1)}×{geometry.h.toFixed(1)}
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//  Block content preview (simplified visual)
// ─────────────────────────────────────────────────────────────

function BlockContentPreview({ data, width }: { data: any; width: number }) {
  switch (data.type) {
    case 'text':
      return (
        <Text
          style={[
            styles.previewText,
            data.bold && { fontWeight: '700' },
            data.invert && { color: '#faf8f3', backgroundColor: '#1a1510' },
            { fontSize: 7 + (data.size - 1) * 2, textAlign: data.align },
          ]}
          numberOfLines={2}
        >
          {data.variable ? `{${data.variable}}` : data.content}
        </Text>
      );

    case 'barcode':
      return (
        <View style={styles.previewBarcode}>
          <View style={styles.previewBarLines}>
            {Array.from({ length: 18 }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.previewBar,
                  { backgroundColor: i % 3 === 0 ? '#1a1510' : '#faf8f3', height: Math.min(data.height * 0.2, 20) },
                ]}
              />
            ))}
          </View>
          <Text style={styles.previewBarcodeLabel} numberOfLines={1}>
            {data.variable ? `{${data.variable}}` : data.data.slice(0, 20)}
          </Text>
        </View>
      );

    case 'qrcode':
      return (
        <View style={styles.previewQR}>
          <View style={[styles.previewQRBox, { width: data.size * 4, height: data.size * 4 }]}>
            {/* 3×3 finder pattern simulation */}
            {[0,1,2].map(r => (
              <View key={r} style={{ flexDirection: 'row' }}>
                {[0,1,2].map(c => (
                  <View key={c} style={{
                    width: data.size * 4 / 3, height: data.size * 4 / 3,
                    backgroundColor: (r === 0 || r === 2 || c === 0 || c === 2 || (r===1&&c===1)) ? '#1a1510' : '#faf8f3',
                  }} />
                ))}
              </View>
            ))}
          </View>
          <Text style={styles.previewQRLabel} numberOfLines={1}>
            {data.variable ? `{${data.variable}}` : data.data.slice(0, 16) + (data.data.length > 16 ? '…' : '')}
          </Text>
        </View>
      );

    case 'image':
      return (
        <View style={[styles.previewImage, { width: width - 8 }]}>
          <Text style={styles.previewImageIcon}>🖼</Text>
          <Text style={styles.previewImageLabel} numberOfLines={1}>
            {data.source ? data.source.split('/').pop()?.slice(0, 20) ?? 'Imagem' : 'Sem fonte'}
          </Text>
        </View>
      );

    case 'divider':
      return (
        <View style={styles.previewDivider}>
          <View style={[
            styles.previewDividerLine,
            data.style === 'dashed' && { borderStyle: 'dashed' },
            data.style === 'dotted' && { borderStyle: 'dotted' },
          ]} />
          {data.style === 'double' && <View style={[styles.previewDividerLine, { marginTop: 1 }]} />}
        </View>
      );

    case 'row':
      return (
        <View style={styles.previewRow}>
          {data.cells.map((c: any, i: number) => (
            <Text
              key={i}
              style={[styles.previewRowCell, { flex: c.width, textAlign: c.align, fontWeight: c.bold ? '700' : '400' }]}
              numberOfLines={1}
            >
              {c.variable ? `{${c.variable}}` : c.text}
            </Text>
          ))}
        </View>
      );

    case 'spacer':
      return (
        <View style={styles.previewSpacer}>
          <Text style={styles.previewSpacerText}>↕ {data.lines} linhas</Text>
        </View>
      );

    default:
      return <View style={styles.previewGeneric} />;
  }
}

// ─────────────────────────────────────────────────────────────
//  Grid overlay
// ─────────────────────────────────────────────────────────────

function GridOverlay({ w, h, gridMm, mmScale }: {
  w: number; h: number; gridMm: number; mmScale: number;
}) {
  const step = mmToPx(gridMm, mmScale);
  const hLines: number[] = [];
  const vLines: number[] = [];

  for (let y = step; y < h; y += step) hLines.push(y);
  for (let x = step; x < w; x += step) vLines.push(x);

  const majorStep = step * 5; // 10mm major grid

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {hLines.map((y, i) => (
        <View
          key={`h${i}`}
          style={[
            styles.gridLine,
            { top: y, left: 0, right: 0, height: 1 },
            y % majorStep < 1 && styles.gridLineMajor,
          ]}
        />
      ))}
      {vLines.map((x, i) => (
        <View
          key={`v${i}`}
          style={[
            styles.gridLine,
            { left: x, top: 0, bottom: 0, width: 1 },
            x % majorStep < 1 && styles.gridLineMajor,
          ]}
        />
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//  Rulers
// ─────────────────────────────────────────────────────────────

function RulerRight({ h, mmScale, canvasHeightMm }: { h: number; mmScale: number; canvasHeightMm: number }) {
  const marks: number[] = [];
  for (let mm = 0; mm <= canvasHeightMm; mm += 10) marks.push(mm);

  return (
    <View style={[styles.rulerRight, { height: h }]}>
      {marks.map(mm => (
        <View key={mm} style={[styles.rulerRightMark, { top: mmToPx(mm, mmScale) - 1 }]}>
          <View style={styles.rulerRightTick} />
          <Text style={styles.rulerRightLabel}>{mm}</Text>
        </View>
      ))}
    </View>
  );
}

function RulerBottom({ w, mmScale, paperWidthMm }: { w: number; mmScale: number; paperWidthMm: number }) {
  const marks: number[] = [];
  for (let mm = 0; mm <= paperWidthMm; mm += 5) marks.push(mm);

  return (
    <View style={[styles.rulerBottom, { width: w }]}>
      {marks.map(mm => (
        <View key={mm} style={[styles.rulerBottomMark, { left: mmToPx(mm, mmScale) - 1 }]}>
          <View style={styles.rulerBottomTick} />
          {mm % 10 === 0 && <Text style={styles.rulerBottomLabel}>{mm}</Text>}
        </View>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────────────────────

const PAPER_BG  = '#faf8f3';
const INK       = '#1a1510';
const INK_LIGHT = '#9a8e80';

const styles = StyleSheet.create({
  outerScroll:       { flex: 1, backgroundColor: '#111120' },
  outerContent:      { alignItems: 'center', paddingVertical: 16, paddingHorizontal: 8 },

  paperMeta:         { marginBottom: 8 },
  paperMetaText:     { color: '#666', fontSize: 11, textAlign: 'center' },

  canvasShadow:      { flexDirection: 'row', shadowColor: '#000', shadowOffset: { width: 2, height: 4 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 10 },

  paper:             { backgroundColor: PAPER_BG, overflow: 'hidden', position: 'relative' },

  edgeMarker:        { position: 'absolute', top: 0, bottom: 0, width: 2, opacity: 0.15, backgroundColor: INK },
  edgeLeft:          { left: 0 },
  edgeRight:         { right: 0 },

  emptyHint:         { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  emptyHintIcon:     { fontSize: 32, marginBottom: 8 },
  emptyHintText:     { color: INK_LIGHT, fontSize: 14, fontWeight: '600' },
  emptyHintSub:      { color: INK_LIGHT, fontSize: 11, marginTop: 4, textAlign: 'center', paddingHorizontal: 20 },

  // Block
  block:             {
    position: 'absolute',
    borderWidth: 1,
    borderStyle: 'dashed',
    backgroundColor: 'rgba(250,248,243,0.6)',
    padding: 3,
    minHeight: 16,
  },
  blockSelected:     { borderStyle: 'solid', borderWidth: 2, backgroundColor: 'rgba(250,248,243,0.95)', zIndex: 100 },
  blockDragging:     { opacity: 0.8, zIndex: 200 },
  blockLocked:       { opacity: 0.7 },

  blockBadge:        { position: 'absolute', top: 1, left: 1, borderRadius: 3, paddingHorizontal: 3, paddingVertical: 1 },
  blockBadgeText:    { fontSize: 8, color: '#fff' },

  lockIcon:          { position: 'absolute', top: 2, right: 2 },
  lockIconText:      { fontSize: 8 },

  resizeHandle:      { position: 'absolute', right: 0, top: 0, bottom: 0, width: 12, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  resizeHandleLine:  { width: 3, height: '80%', backgroundColor: '#7c6ef0', borderRadius: 2, opacity: 0.8 },

  geoLabel:          { position: 'absolute', bottom: -14, left: 0, backgroundColor: '#7c6ef0dd', borderRadius: 3, paddingHorizontal: 3, paddingVertical: 1 },
  geoLabelText:      { fontSize: 8, color: '#fff', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },

  // Content previews
  previewText:       { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 9, color: INK, lineHeight: 13 },
  previewBarcode:    { alignItems: 'center', paddingVertical: 2 },
  previewBarLines:   { flexDirection: 'row', gap: 1 },
  previewBar:        { width: 3, backgroundColor: INK },
  previewBarcodeLabel:{ fontSize: 7, color: INK, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginTop: 2 },
  previewQR:         { alignItems: 'center', paddingVertical: 2 },
  previewQRBox:      { overflow: 'hidden' },
  previewQRLabel:    { fontSize: 7, color: INK_LIGHT, marginTop: 2, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  previewImage:      { height: 22, backgroundColor: '#e8e4d8', borderRadius: 2, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 4 },
  previewImageIcon:  { fontSize: 11 },
  previewImageLabel: { fontSize: 8, color: INK_LIGHT },
  previewDivider:    { paddingVertical: 4 },
  previewDividerLine:{ borderTopWidth: 1, borderTopColor: INK, opacity: 0.4 },
  previewRow:        { flexDirection: 'row' },
  previewRowCell:    { fontSize: 8, color: INK, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  previewSpacer:     { height: 12, alignItems: 'center', justifyContent: 'center' },
  previewSpacerText: { fontSize: 8, color: INK_LIGHT, fontStyle: 'italic' },
  previewGeneric:    { height: 12, backgroundColor: '#e8e4d8' },

  // Grid
  gridLine:          { position: 'absolute', backgroundColor: '#c8c4b4', opacity: 0.3 },
  gridLineMajor:     { opacity: 0.6, backgroundColor: '#a8a498' },

  // Rulers
  rulerRight:        { width: 28, backgroundColor: '#f0ede4', borderLeftWidth: 1, borderLeftColor: '#d4cfc0', position: 'relative' },
  rulerRightMark:    { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'center' },
  rulerRightTick:    { width: 6, height: 1, backgroundColor: '#888' },
  rulerRightLabel:   { fontSize: 7, color: '#888', marginLeft: 2 },

  rulerBottom:       { height: 20, backgroundColor: '#f0ede4', borderTopWidth: 1, borderTopColor: '#d4cfc0', position: 'relative' },
  rulerBottomMark:   { position: 'absolute', top: 0, bottom: 0 },
  rulerBottomTick:   { width: 1, height: 6, backgroundColor: '#888' },
  rulerBottomLabel:  { fontSize: 7, color: '#888', marginTop: 7, marginLeft: -6 },
});
