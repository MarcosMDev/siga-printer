import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  useWindowDimensions,
  Platform,
} from 'react-native';

import type { PrintPreviewBuilder } from './PrintPreviewBuilder';
import type {
  PreviewElement,
  PreviewText,
  PreviewBarcode,
  PreviewQRCode,
  PreviewImage,
  PreviewDivider,
  PreviewFeed,
  PreviewCut,
  PreviewSection,
  PreviewTableRow,
} from './PreviewRenderer';
import type { PrinterProfile, PrintOrientation } from '../types';

// ─────────────────────────────────────────────────────────────
//  PrintPreview component
//
//  Renders a realistic thermal-paper preview of what will be
//  printed. Displays overflow warnings, truncation markers
//  and paper metrics inline.
//
//  Usage:
//    <PrintPreview builder={myBuilder} />
//
//    // Or with external control:
//    const builder = new PrintPreviewBuilder({ profile, orientation });
//    builder.text('Hello').barcode('123').cut();
//    <PrintPreview builder={builder} showRuler showMetrics />
// ─────────────────────────────────────────────────────────────

export interface PrintPreviewProps {
  builder:      PrintPreviewBuilder;
  /** Scale factor for paper width (default: fits screen width) */
  scale?:       number;
  /** Show ruler with mm markers (default: true) */
  showRuler?:   boolean;
  /** Show paper metrics bar (length estimate, overflow count) */
  showMetrics?: boolean;
  /** Highlight overflow elements in red (default: true) */
  highlightOverflow?: boolean;
  /** Show a cut mark line (default: true) */
  showCutMark?: boolean;
  /** ScrollView style override */
  style?:       any;
}

// Thermal paper color (warm white)
const PAPER_BG     = '#faf8f3';
const PAPER_BORDER = '#e8e4d8';
const PAPER_SHADOW = '#d4cfc0';
const INK_COLOR    = '#1a1510';
const INK_MUTED    = '#4a4540';
const OVERFLOW_BG  = '#fff0f0';
const OVERFLOW_BORDER = '#ff4444';
const WARNING_COLOR   = '#cc2200';
const TRUNC_COLOR     = '#ff6600';

export function PrintPreview({
  builder,
  scale,
  showRuler   = true,
  showMetrics = true,
  highlightOverflow = true,
  style,
}: PrintPreviewProps) {
  const { width: screenWidth } = useWindowDimensions();
  const elements = builder.getElements();
  const profile  = builder.renderer_['profile'] as PrinterProfile;
  const orientation = builder.renderer_['orientation'] as PrintOrientation;

  // Paper width in pixels: fill available space with some margin
  const paperPx = scale
    ? profile.paperWidth * scale
    : Math.min(screenWidth - 32, 360); // max 360px for 80mm paper

  // mm-to-px scale
  const mmToPx = paperPx / profile.paperWidth;

  // Estimated content height in px (for landscape container sizing)
  const contentHeightPx = Math.max(
    builder.estimatedLengthMm * mmToPx,
    paperPx,
  );

  const metrics = useMemo(() => ({
    overflowCount:     builder.overflowCount,
    hasOverflow:       builder.hasOverflow,
    estimatedLengthMm: builder.estimatedLengthMm,
    elementCount:      elements.length,
  }), [elements]);

  // ── Portrait content (shared between both orientations) ──────
  const paperContent = (
    <View style={styles.paperContent}>
      {elements.map((el, i) => (
        <ElementRenderer
          key={i}
          element={el}
          paperPx={paperPx}
          mmToPx={mmToPx}
          highlightOverflow={highlightOverflow}
        />
      ))}
      {elements.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Nenhum conteúdo adicionado</Text>
          <Text style={styles.emptySubText}>
            Use o editor ao lado para montar sua impressão
          </Text>
        </View>
      )}
    </View>
  );

  // ── Landscape: portrait paper strip, content rotated 90° CW inside ─
  // Physical thermal paper always comes out portrait (|). In landscape mode
  // the content bitmap is rotated 90° before printing — so the preview shows
  // a portrait strip with content visually sideways (as it looks on the paper
  // before you rotate the paper to read it).
  //
  // Pre-rotation view:  width=contentHeightPx, height=paperPx
  // After 90° CW:       visual width=paperPx, visual height=contentHeightPx
  // Positioning:        left = -offset, top = offset
  //                     where offset = (contentHeightPx - paperPx) / 2
  if (orientation === 'landscape') {
    const offset = (contentHeightPx - paperPx) / 2;
    return (
      <View style={[styles.container, style]}>
        {showMetrics && (
          <MetricsBar
            profile={profile}
            orientation={orientation}
            overflowCount={metrics.overflowCount}
            estimatedLengthMm={metrics.estimatedLengthMm}
            elementCount={metrics.elementCount}
          />
        )}

        {/* Landscape hint */}
        <View style={styles.landscapeHint}>
          <Text style={styles.landscapeHintText}>
            ↕ Paisagem — papel vertical, conteúdo girado 90°
          </Text>
        </View>

        <ScrollView
          horizontal={false}
          showsVerticalScrollIndicator
          contentContainerStyle={styles.scrollContent}
        >
          {/* Portrait container: width=paperPx, height=contentHeightPx */}
          <View style={{ width: paperPx, height: contentHeightPx }}>
            {/* Pre-rotation: wide+short → after 90° CW: narrow+tall = portrait */}
            <View style={[
              styles.paper,
              {
                position: 'absolute',
                width:  contentHeightPx,
                height: paperPx,
                left: -offset,
                top:   offset,
                transform: [{ rotate: '90deg' }],
              },
            ]}>
              <View style={[styles.paperEdge, styles.paperEdgeTop]} />
              {showRuler && <Ruler widthPx={paperPx} mmToPx={mmToPx} />}
              {paperContent}
              <View style={[styles.paperEdge, styles.paperEdgeBottom]} />
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── Portrait (default) ───────────────────────────────────────
  return (
    <View style={[styles.container, style]}>
      {showMetrics && (
        <MetricsBar
          profile={profile}
          orientation={orientation}
          overflowCount={metrics.overflowCount}
          estimatedLengthMm={metrics.estimatedLengthMm}
          elementCount={metrics.elementCount}
        />
      )}

      <ScrollView
        horizontal={false}
        showsVerticalScrollIndicator
        contentContainerStyle={styles.scrollContent}
      >
        <View style={[styles.paper, { width: paperPx }]}>
          <View style={[styles.paperEdge, styles.paperEdgeTop]} />
          {showRuler && <Ruler widthPx={paperPx} mmToPx={mmToPx} />}
          {paperContent}
          <View style={[styles.paperEdge, styles.paperEdgeBottom]} />
        </View>
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//  Metrics bar
// ─────────────────────────────────────────────────────────────

function MetricsBar({
  profile, orientation, overflowCount, estimatedLengthMm, elementCount,
}: {
  profile:           PrinterProfile;
  orientation:       PrintOrientation;
  overflowCount:     number;
  estimatedLengthMm: number;
  elementCount:      number;
}) {
  return (
    <View style={styles.metricsBar}>
      <MetricChip
        label="Papel"
        value={`${profile.paperWidth}mm`}
        color="#7c6ef0"
      />
      <MetricChip
        label="Orientação"
        value={orientation === 'portrait' ? '↕ Retrato' : '↔ Paisagem'}
        color="#0ea5e9"
      />
      <MetricChip
        label="Comprimento"
        value={`~${Math.round(estimatedLengthMm)}mm`}
        color="#10b981"
      />
      <MetricChip
        label="Blocos"
        value={String(elementCount)}
        color="#f59e0b"
      />
      {overflowCount > 0 && (
        <MetricChip
          label="Overflow"
          value={`${overflowCount} ⚠`}
          color="#ef4444"
          highlight
        />
      )}
    </View>
  );
}

function MetricChip({
  label, value, color, highlight,
}: {
  label:      string;
  value:      string;
  color:      string;
  highlight?: boolean;
}) {
  return (
    <View style={[
      styles.metricChip,
      highlight && styles.metricChipHighlight,
    ]}>
      <Text style={[styles.metricLabel, { color: highlight ? '#ef4444' : '#888' }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: highlight ? '#ef4444' : color }]}>{value}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//  Ruler
// ─────────────────────────────────────────────────────────────

function Ruler({ widthPx, mmToPx }: { widthPx: number; mmToPx: number }) {
  const totalMm = Math.floor(widthPx / mmToPx);
  const marks: number[] = [];
  for (let mm = 0; mm <= totalMm; mm += 5) marks.push(mm);

  return (
    <View style={[styles.ruler, { width: widthPx }]}>
      {marks.map(mm => (
        <View
          key={mm}
          style={[styles.rulerMark, { left: mm * mmToPx }]}
        >
          <View style={[styles.rulerTick, mm % 10 === 0 && styles.rulerTickLong]} />
          {mm % 10 === 0 && (
            <Text style={styles.rulerLabel}>{mm}</Text>
          )}
        </View>
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//  Element renderer — dispatches to specific renderers
// ─────────────────────────────────────────────────────────────

function ElementRenderer({
  element, paperPx, mmToPx, highlightOverflow,
}: {
  element:          PreviewElement;
  paperPx:          number;
  mmToPx:           number;
  highlightOverflow:boolean;
}) {
  const overflowStyle = highlightOverflow && element.overflow
    ? styles.overflowHighlight
    : null;

  switch (element.type) {
    case 'text':
      return <TextElement el={element} overflowStyle={overflowStyle} />;
    case 'barcode':
      return <BarcodeElement el={element} paperPx={paperPx} overflowStyle={overflowStyle} />;
    case 'qrcode':
      return <QRCodeElement el={element} overflowStyle={overflowStyle} />;
    case 'image':
      return <ImageElement el={element} paperPx={paperPx} overflowStyle={overflowStyle} mmToPx={mmToPx} />;
    case 'divider':
      return <DividerElement el={element} />;
    case 'feed':
      return <FeedElement el={element} />;
    case 'cut':
      return <CutElement el={element} paperPx={paperPx} />;
    case 'section':
      return <SectionElement el={element} />;
    case 'table':
      return <TableElement el={element} overflowStyle={overflowStyle} />;
    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────
//  Individual element renderers
// ─────────────────────────────────────────────────────────────

function TextElement({ el, overflowStyle }: { el: PreviewText; overflowStyle: any }) {
  const size  = el.options?.size ?? 1;
  const bold  = el.options?.bold;
  const align = el.options?.align ?? 'left';
  const inv   = el.options?.invert;
  const under = el.options?.underline;

  const fontSize  = 9 + (size - 1) * 5; // 9px normal, 14px size2, 19px size3…
  const lineHeight = fontSize * 1.3;

  if (!el.content) {
    return <View style={{ height: lineHeight * 0.4 }} />;
  }

  return (
    <View style={[
      styles.textEl,
      overflowStyle,
      inv && styles.textInverted,
    ]}>
      <Text
        style={[
          styles.paperText,
          {
            fontSize,
            lineHeight,
            fontWeight: bold ? '700' : '400',
            textAlign:  align,
            textDecorationLine: under ? 'underline' : 'none',
            color: inv ? PAPER_BG : INK_COLOR,
          },
        ]}
        numberOfLines={0}
      >
        {el.content}
      </Text>
      {el.overflow && (
        <OverflowTag message={`Overflow: ${el.content.length} chars (máx ~${Math.floor(42 / el.charWidth)})`} />
      )}
    </View>
  );
}

function BarcodeElement({
  el, paperPx, overflowStyle,
}: { el: PreviewBarcode; paperPx: number; overflowStyle: any }) {
  const height = Math.min((el.options?.height ?? 50) * 0.35, 60);
  const align  = el.options?.align ?? 'center';

  return (
    <View style={[styles.barcodeEl, overflowStyle]}>
      {!el.validData && (
        <View style={styles.validationError}>
          <Text style={styles.validationErrorText}>⚠ {el.validationMessage}</Text>
        </View>
      )}
      {/* Barcode simulation — alternating black bars */}
      <View style={{ alignItems: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start' }}>
        <BarcodeVisual data={el.data} height={height} paperPx={paperPx} />
        {(el.options?.hriPosition === 'below' || !el.options?.hriPosition) && (
          <Text style={styles.barcodeHRI}>{el.data}</Text>
        )}
      </View>
      {el.overflow && <OverflowTag message="Barcode pode exceder largura do papel" />}
    </View>
  );
}

function BarcodeVisual({
  data, height, paperPx,
}: { data: string; height: number; paperPx: number }) {
  // Render a convincing barcode simulation using thin/thick bars
  // seeded from the data string for visual consistency
  const BAR_COUNT = 60;
  const barWidth  = (paperPx * 0.65) / BAR_COUNT;

  const bars: boolean[] = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    const charCode = data.charCodeAt(i % data.length) ?? 65;
    // Create a pseudo-random but deterministic pattern
    bars.push(((charCode * 17 + i * 31) % 7) > 2);
  }

  return (
    <View style={{ flexDirection: 'row', height }}>
      {bars.map((black, i) => (
        <View
          key={i}
          style={{
            width: barWidth,
            height,
            backgroundColor: black ? INK_COLOR : PAPER_BG,
          }}
        />
      ))}
    </View>
  );
}

function QRCodeElement({ el, overflowStyle }: { el: PreviewQRCode; overflowStyle: any }) {
  const size = (el.options?.size ?? 4) * 5; // visual size in px
  const align = el.options?.align ?? 'center';

  return (
    <View style={[styles.qrEl, overflowStyle, { alignItems: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start' }]}>
      {/* QR Code visual simulation */}
      <View style={[styles.qrBox, { width: size, height: size }]}>
        <QRVisual size={size} data={el.data} />
      </View>
      <Text style={styles.qrLabel} numberOfLines={1}>
        {el.data.length > 30 ? el.data.slice(0, 30) + '…' : el.data}
      </Text>
      {el.overflow && (
        <OverflowTag message={`QR ~${Math.round(el.estimatedDots / 8)}mm excede papel`} />
      )}
    </View>
  );
}

function QRVisual({ size, data }: { size: number; data: string }) {
  // 9×9 module grid simulation (just for visual)
  const GRID = 9;
  const cell = size / GRID;

  return (
    <View style={{ width: size, height: size, backgroundColor: PAPER_BG }}>
      {Array.from({ length: GRID }).map((_, row) => (
        <View key={row} style={{ flexDirection: 'row' }}>
          {Array.from({ length: GRID }).map((_, col) => {
            // Finder pattern corners
            const isFinderTL = row < 3 && col < 3;
            const isFinderTR = row < 3 && col >= GRID - 3;
            const isFinderBL = row >= GRID - 3 && col < 3;
            const isFinder   = isFinderTL || isFinderTR || isFinderBL;

            // Data pattern (pseudo-random from data)
            const code   = data.charCodeAt((row * GRID + col) % data.length) ?? 0;
            const isData = !isFinder && ((code + row * 3 + col * 7) % 3 !== 0);

            return (
              <View
                key={col}
                style={{
                  width: cell,
                  height: cell,
                  backgroundColor: (isFinder || isData) ? INK_COLOR : PAPER_BG,
                }}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

function ImageElement({
  el, paperPx, overflowStyle, mmToPx,
}: { el: PreviewImage; paperPx: number; overflowStyle: any; mmToPx: number }) {
  const targetW  = Math.min(el.printWidthDots / 8 * mmToPx, paperPx);
  const align    = el.options?.align ?? 'center';

  const isLocalAsset = typeof el.source === 'number';
  const isBase64     = typeof el.source === 'string' && el.source.startsWith('data:');
  const isUri        = typeof el.source === 'string';

  return (
    <View style={[styles.imageEl, overflowStyle, {
      alignItems: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
    }]}>
      {isLocalAsset || isBase64 || isUri ? (
        <Image
          source={isLocalAsset
            ? el.source as number
            : { uri: el.source as string }
          }
          style={[styles.previewImage, { width: targetW, height: targetW * 0.3 }]}
          resizeMode="contain"
        />
      ) : (
        <View style={[styles.imagePlaceholder, { width: targetW }]}>
          <Text style={styles.imagePlaceholderText}>🖼 Imagem</Text>
          <Text style={styles.imagePlaceholderSub}>{targetW.toFixed(0)}px</Text>
        </View>
      )}
      {el.overflow && (
        <OverflowTag message={`Imagem ${el.printWidthDots}px excede ${el.options?.width ?? 'auto'} dots`} />
      )}
    </View>
  );
}

function DividerElement({ el }: { el: PreviewDivider }) {
  const style = el.options?.style ?? 'line';

  let lineStyle: any = styles.dividerLine;

  switch (style) {
    case 'double':
      return (
        <View style={styles.dividerEl}>
          <View style={styles.dividerLine} />
          <View style={{ height: 2 }} />
          <View style={styles.dividerLine} />
        </View>
      );
    case 'dashed':
      lineStyle = styles.dividerDashed; break;
    case 'dotted':
      lineStyle = styles.dividerDotted; break;
    case 'empty':
      return <View style={{ height: 8 }} />;
  }

  return (
    <View style={styles.dividerEl}>
      <View style={lineStyle} />
    </View>
  );
}

function FeedElement({ el }: { el: PreviewFeed }) {
  return (
    <View style={[styles.feedEl, { height: el.lines * 6 }]}>
      {el.lines > 1 && (
        <Text style={styles.feedLabel}>↕ {el.lines} linhas</Text>
      )}
    </View>
  );
}

function CutElement({ el, paperPx }: { el: PreviewCut; paperPx: number }) {
  const isPartial = el.options?.mode === 'partial';

  return (
    <View style={[styles.cutEl, { width: paperPx }]}>
      <View style={styles.cutLineContainer}>
        <View style={[styles.cutLine, isPartial && styles.cutLinePartial]} />
        <View style={styles.cutScissor}>
          <Text style={styles.cutScissorIcon}>✂</Text>
        </View>
        {isPartial && (
          <View style={styles.cutGap} />
        )}
      </View>
      <Text style={styles.cutLabel}>
        {isPartial ? 'Corte parcial' : 'Corte completo'}
      </Text>
    </View>
  );
}

function SectionElement({ el }: { el: PreviewSection }) {
  const title = el.options.uppercase
    ? el.options.title.toUpperCase()
    : el.options.title;

  return (
    <View style={styles.sectionEl}>
      <View style={styles.dividerLine} />
      <Text style={[
        styles.sectionTitle,
        el.options.bold !== false && styles.sectionTitleBold,
      ]}>
        {title}
      </Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

function TableElement({
  el, overflowStyle,
}: { el: PreviewTableRow; overflowStyle: any }) {
  return (
    <View style={[styles.tableEl, overflowStyle]}>
      <View style={styles.tableRow}>
        {el.renderedCells.map((cell, i) => {
          const align = el.options.cells[i]?.align ?? 'left';
          const bold  = el.options.cells[i]?.bold;
          const trunc = el.truncatedCells[i];

          return (
            <Text
              key={i}
              style={[
                styles.tableCell,
                { textAlign: align, flex: el.options.cells[i].width },
                bold && styles.tableCellBold,
                trunc && styles.tableCellTrunc,
              ]}
              numberOfLines={1}
            >
              {cell}
              {trunc && <Text style={styles.truncMark}> ⚠</Text>}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//  Overflow tag
// ─────────────────────────────────────────────────────────────

function OverflowTag({ message }: { message: string }) {
  return (
    <View style={styles.overflowTag}>
      <Text style={styles.overflowTagText}>⚠ {message}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#1a1a2e' },
  scrollContent:    { alignItems: 'center', paddingVertical: 16 },

  // Landscape hint bar
  landscapeHint:    { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#0f0f1a', borderBottomWidth: 1, borderBottomColor: '#2a2a3e' },
  landscapeHintText:{ fontSize: 11, color: '#7c6ef0' },

  // Metrics
  metricsBar:       { flexDirection: 'row', flexWrap: 'wrap', padding: 8, gap: 6, backgroundColor: '#0f0f1a', borderBottomWidth: 1, borderBottomColor: '#2a2a3e' },
  metricChip:       { backgroundColor: '#1e1e2e', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, alignItems: 'center', minWidth: 56 },
  metricChipHighlight: { backgroundColor: '#2a0a0a', borderWidth: 1, borderColor: '#ef4444' },
  metricLabel:      { fontSize: 9, color: '#666', marginBottom: 1 },
  metricValue:      { fontSize: 12, fontWeight: '700' },

  // Paper
  paper:            {
    backgroundColor: PAPER_BG,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    minHeight: 200,
  },
  paperEdge:        { height: 6, backgroundColor: PAPER_SHADOW },
  paperEdgeTop:     { borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  paperEdgeBottom:  { borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  paperContent:     { paddingHorizontal: 8, paddingVertical: 6 },

  // Ruler
  ruler:            { height: 20, backgroundColor: '#f0ede4', borderBottomWidth: 1, borderBottomColor: PAPER_BORDER, position: 'relative', overflow: 'hidden' },
  rulerMark:        { position: 'absolute', bottom: 0, alignItems: 'center' },
  rulerTick:        { width: 1, height: 4, backgroundColor: '#bbb' },
  rulerTickLong:    { height: 8, backgroundColor: '#888' },
  rulerLabel:       { fontSize: 7, color: '#999', marginTop: 1 },

  // Text
  textEl:           { marginVertical: 1 },
  textInverted:     { backgroundColor: INK_COLOR, paddingHorizontal: 2 },
  paperText:        { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: INK_COLOR },

  // Barcode
  barcodeEl:        { marginVertical: 6 },
  barcodeHRI:       { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 9, color: INK_COLOR, marginTop: 2, textAlign: 'center' },

  // QR
  qrEl:             { marginVertical: 6 },
  qrBox:            { borderWidth: 1, borderColor: INK_COLOR },
  qrLabel:          { fontSize: 8, color: INK_MUTED, marginTop: 2, textAlign: 'center', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },

  // Image
  imageEl:          { marginVertical: 4 },
  previewImage:     { resizeMode: 'contain' },
  imagePlaceholder: { height: 40, backgroundColor: '#f0ede4', borderWidth: 1, borderColor: PAPER_BORDER, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  imagePlaceholderText: { color: INK_MUTED, fontSize: 11 },
  imagePlaceholderSub:  { color: '#aaa', fontSize: 9 },

  // Divider
  dividerEl:        { marginVertical: 3 },
  dividerLine:      { height: 1, backgroundColor: INK_COLOR, opacity: 0.4 },
  dividerDashed:    { height: 1, borderTopWidth: 1, borderColor: INK_COLOR, borderStyle: 'dashed', opacity: 0.4 },
  dividerDotted:    { height: 1, borderTopWidth: 1, borderColor: INK_COLOR, borderStyle: 'dotted', opacity: 0.4 },

  // Feed
  feedEl:           { alignItems: 'center', justifyContent: 'center' },
  feedLabel:        { fontSize: 8, color: '#bbb', fontStyle: 'italic' },

  // Cut
  cutEl:            { marginVertical: 8, alignItems: 'center' },
  cutLineContainer: { width: '100%', flexDirection: 'row', alignItems: 'center' },
  cutLine:          { flex: 1, height: 1, borderTopWidth: 1, borderColor: '#555', borderStyle: 'dashed' },
  cutLinePartial:   { flex: 0.75, borderColor: '#888' },
  cutGap:           { flex: 0.25 },
  cutScissor:       { marginHorizontal: 4 },
  cutScissorIcon:   { fontSize: 14, color: '#555', transform: [{ rotate: '90deg' }] },
  cutLabel:         { fontSize: 9, color: '#888', marginTop: 3, fontStyle: 'italic' },

  // Section
  sectionEl:        { marginVertical: 2 },
  sectionTitle:     { textAlign: 'center', fontSize: 10, color: INK_COLOR, marginVertical: 2, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  sectionTitleBold: { fontWeight: '700' },

  // Table
  tableEl:          { marginVertical: 1 },
  tableRow:         { flexDirection: 'row' },
  tableCell:        { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 9, color: INK_COLOR },
  tableCellBold:    { fontWeight: '700' },
  tableCellTrunc:   { color: TRUNC_COLOR },
  truncMark:        { color: TRUNC_COLOR, fontSize: 8 },

  // Overflow
  overflowHighlight:{ backgroundColor: OVERFLOW_BG, borderLeftWidth: 3, borderLeftColor: OVERFLOW_BORDER },
  overflowTag:      { backgroundColor: '#fff0f0', borderRadius: 3, paddingHorizontal: 4, paddingVertical: 2, marginTop: 2, alignSelf: 'flex-start' },
  overflowTagText:  { fontSize: 9, color: WARNING_COLOR, fontWeight: '600' },

  // Validation
  validationError:     { backgroundColor: '#fff3cd', borderRadius: 3, padding: 4, marginBottom: 4 },
  validationErrorText: { fontSize: 9, color: '#856404' },

  // Empty
  emptyState:       { padding: 32, alignItems: 'center' },
  emptyText:        { color: INK_MUTED, fontSize: 14, fontWeight: '600' },
  emptySubText:     { color: '#aaa', fontSize: 11, marginTop: 4, textAlign: 'center' },
});
