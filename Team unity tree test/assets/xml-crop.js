function sanitizeSpriteName(name) {
  return String(name || '')
    .replace(/\\.[^.\\/]+$/, '')
    .replace(/[^a-zA-Z0-9_\-\.]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    || 'sprite';
}

function normalizeSpriteFileName(name) {
  const cleaned = sanitizeSpriteName(name);
  return cleaned.endsWith('.png') ? cleaned.slice(0, -4) : cleaned;
}

function parseAtlasEntries(xmlText) {
  if (!xmlText || !String(xmlText).trim()) {
    return [];
  }

  const xml = String(xmlText);

  const readNode = (node) => {
    const name = node.getAttribute('name') || node.getAttribute('n') || node.getAttribute('frameName') || '';
    if (!name) return null;

    const x = parseInt(node.getAttribute('x') || '0', 10);
    const y = parseInt(node.getAttribute('y') || '0', 10);
    const width = parseInt(node.getAttribute('w') || node.getAttribute('width') || '0', 10);
    const height = parseInt(node.getAttribute('h') || node.getAttribute('height') || '0', 10);
    const frameWidth = parseInt(node.getAttribute('oW') || node.getAttribute('frameWidth') || node.getAttribute('w') || node.getAttribute('width') || '0', 10);
    const frameHeight = parseInt(node.getAttribute('oH') || node.getAttribute('frameHeight') || node.getAttribute('h') || node.getAttribute('height') || '0', 10);
    const frameX = parseInt(node.getAttribute('frameX') || '0', 10);
    const frameY = parseInt(node.getAttribute('frameY') || '0', 10);
    const rotationValue = node.getAttribute('r') || node.getAttribute('rotated') || node.getAttribute('rotation') || '';
    const rotated = ['y', 'true', '1', 'yes'].includes(String(rotationValue).toLowerCase());

    const sourceWidth = width > 0 ? width : frameWidth;
    const sourceHeight = height > 0 ? height : frameHeight;
    const outputWidth = frameWidth > 0 ? frameWidth : sourceWidth;
    const outputHeight = frameHeight > 0 ? frameHeight : sourceHeight;

    return {
      name,
      x: Number.isFinite(x) ? x : 0,
      y: Number.isFinite(y) ? y : 0,
      width: sourceWidth,
      height: sourceHeight,
      rotated,
      frameX: Number.isFinite(frameX) ? frameX : 0,
      frameY: Number.isFinite(frameY) ? frameY : 0,
      originalWidth: outputWidth,
      originalHeight: outputHeight,
    };
  };

  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const document = parser.parseFromString(xml, 'application/xml');
    const documentRoot = document.documentElement;

    if (documentRoot) {
      const nodes = Array.from(documentRoot.querySelectorAll('SubTexture, sprite, frame'));
      return nodes.map(readNode).filter(Boolean);
    }
  }

  const entries = [];
  const tagPattern = /<(?:SubTexture|sprite|frame)\b([^>]*)>/gi;

  for (const match of xml.matchAll(tagPattern)) {
    const attrs = match[1] || '';
    const attributePattern = /(\w+)=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
    const properties = {};
    let attrMatch;

    while ((attrMatch = attributePattern.exec(attrs)) !== null) {
      properties[attrMatch[1]] = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? '';
    }

    const name = properties.name || properties.n || properties.frameName || '';
    if (!name) continue;

    const x = parseInt(properties.x || '0', 10);
    const y = parseInt(properties.y || '0', 10);
    const width = parseInt(properties.w || properties.width || '0', 10);
    const height = parseInt(properties.h || properties.height || '0', 10);
    const frameWidth = parseInt(properties.oW || properties.frameWidth || properties.w || properties.width || '0', 10);
    const frameHeight = parseInt(properties.oH || properties.frameHeight || properties.h || properties.height || '0', 10);
    const frameX = parseInt(properties.frameX || '0', 10);
    const frameY = parseInt(properties.frameY || '0', 10);
    const rotationValue = properties.r || properties.rotated || properties.rotation || '';
    const rotated = ['y', 'true', '1', 'yes'].includes(String(rotationValue).toLowerCase());
    const sourceWidth = width > 0 ? width : frameWidth;
    const sourceHeight = height > 0 ? height : frameHeight;
    const outputWidth = frameWidth > 0 ? frameWidth : sourceWidth;
    const outputHeight = frameHeight > 0 ? frameHeight : sourceHeight;

    entries.push({
      name,
      x: Number.isFinite(x) ? x : 0,
      y: Number.isFinite(y) ? y : 0,
      width: sourceWidth,
      height: sourceHeight,
      rotated,
      frameX: Number.isFinite(frameX) ? frameX : 0,
      frameY: Number.isFinite(frameY) ? frameY : 0,
      originalWidth: outputWidth,
      originalHeight: outputHeight,
    });
  }

  return entries;
}

function buildSpriteCanvas(image, entry) {
  const sourceWidth = Math.max(1, Math.round(entry.width));
  const sourceHeight = Math.max(1, Math.round(entry.height));
  const outputWidth = Math.max(1, Math.round(entry.originalWidth || sourceWidth));
  const outputHeight = Math.max(1, Math.round(entry.originalHeight || sourceHeight));

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = outputWidth;
  canvas.height = outputHeight;

  const sourceX = Math.max(0, Math.round(entry.x));
  const sourceY = Math.max(0, Math.round(entry.y));

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (entry.rotated) {
    ctx.save();
    ctx.translate(sourceWidth / 2, sourceHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      -sourceHeight / 2,
      -sourceWidth / 2,
      sourceWidth,
      sourceHeight
    );
    ctx.restore();
    return canvas;
  }

  ctx.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    outputWidth,
    outputHeight
  );

  return canvas;
}

function cropSpriteFromAtlas(image, xmlText, options = {}) {
  const entries = parseAtlasEntries(xmlText);
  const { onProgress } = options;

  return entries.map((entry, index) => {
    const canvas = buildSpriteCanvas(image, entry);

    if (onProgress) onProgress(index + 1, entries.length, entry.name);

    return {
      name: entry.name,
      canvas,
      width: canvas.width,
      height: canvas.height,
      x: Math.max(0, Math.round(entry.x)),
      y: Math.max(0, Math.round(entry.y)),
    };
  });
}

if (typeof module !== 'undefined') {
  module.exports = {
    parseAtlasEntries,
    cropSpriteFromAtlas,
    normalizeSpriteFileName,
    sanitizeSpriteName,
  };
}
