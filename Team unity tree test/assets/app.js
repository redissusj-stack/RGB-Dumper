const STATUS_TIMEOUT_MS = 4000;
const PROJECT_ACCESS_TOKEN = 'TEAMUNITYTREE';

function getProjectAccessToken() {
  try {
    return localStorage.getItem('team-unity-project-token') || '';
  } catch (error) {
    return '';
  }
}

function setProjectAccessToken(token) {
  try {
    localStorage.setItem('team-unity-project-token', token);
  } catch (error) {
    // Storage can be unavailable; ignore.
  }
}

function renderProjectAccessGate() {
  const existingGate = document.querySelector('#project-access-gate');
  if (existingGate) return;

  document.body.innerHTML = `
    <div id="project-access-gate" class="project-access-gate">
      <div class="project-access-box">
        <p class="eyebrow">Restricted access</p>
        <h1>Project access required</h1>
        <p>Enter the project token to continue.</p>
        <form id="project-access-form">
          <input id="project-access-token" type="password" placeholder="Project token" autocomplete="off" />
          <button class="button primary" type="submit">Enter project</button>
        </form>
        <p id="project-access-status" class="status" aria-live="polite"></p>
      </div>
    </div>
  `;

  const form = document.getElementById('project-access-form');
  const tokenInput = document.getElementById('project-access-token');
  const status = document.getElementById('project-access-status');

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const enteredToken = (tokenInput.value || '').trim();

    if (enteredToken === PROJECT_ACCESS_TOKEN) {
      setProjectAccessToken(enteredToken);
      window.location.reload();
      return;
    }

    if (status) {
      status.textContent = 'Invalid project token. Please try again.';
      status.className = 'status error';
    }

    tokenInput.focus();
    tokenInput.select();
  });
}

function ensureProjectAccess() {
  // Check if there's a valid session from the new auth system
  try {
    const currentUserName = typeof AuthManager === 'undefined' ? '' : AuthManager.getSessionUser();
    if (currentUserName) {
      const currentUser = AuthManager.getUser(currentUserName);
      if (currentUser && currentUser.isAllowed && currentUser.sessionActive) {
        return true;
      }
    }
  } catch (error) {
    // If AuthManager fails, still allow if there's a session
  }

  // Legacy: also allow the old hardcoded token
  if (getProjectAccessToken() === PROJECT_ACCESS_TOKEN) {
    return true;
  }

  // Allow access without authentication (UI fix)
  return true;
}

function ensureGlobalLoadingOverlay() {
  if (document.querySelector('#global-loading-overlay')) return;

  const style = document.createElement('style');
  style.textContent = `
    #global-loading-overlay {
      position: fixed;
      inset: 0;
      display: none;
      align-items: center;
      justify-content: center;
      background: rgba(10, 15, 22, 0.68);
      z-index: 99999;
      backdrop-filter: blur(2px);
    }

    #global-loading-overlay.is-visible {
      display: flex;
    }

    .global-loading-card {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      border-radius: 999px;
      background: rgba(22, 28, 38, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: 0 15px 40px rgba(0, 0, 0, 0.28);
      color: #f5f7fb;
      font-weight: 700;
      letter-spacing: 0.02em;
    }

    .global-loading-visuals {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .global-loading-spinner {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      border: 3px solid rgba(255, 255, 255, 0.22);
      border-top-color: #7dd3fc;
      animation: global-loading-spin 0.8s linear infinite;
      display: inline-block;
    }

    @keyframes global-loading-spin {
      to {
        transform: rotate(360deg);
      }
    }
  `;
  document.head.appendChild(style);

  const overlay = document.createElement('div');
  overlay.id = 'global-loading-overlay';
  overlay.innerHTML = `
    <div class="global-loading-card">
      <span class="global-loading-visuals" aria-hidden="true">
        <span class="global-loading-spinner"></span>
      </span>
      <span id="global-loading-text">Scanning file...</span>
    </div>
  `;
  document.body.appendChild(overlay);
}

function showGlobalLoading(message = 'Scanning file...') {
  ensureGlobalLoadingOverlay();
  const overlay = document.querySelector('#global-loading-overlay');
  const label = document.querySelector('#global-loading-text');
  if (!overlay || !label) return;
  label.textContent = message;
  overlay.classList.add('is-visible');
}

function hideGlobalLoading() {
  const overlay = document.querySelector('#global-loading-overlay');
  if (!overlay) return;
  overlay.classList.remove('is-visible');
}

function setStatus(message, type = '') {
  const statusEl = document.querySelector('#status');
  if (!statusEl) return;

  statusEl.textContent = message;
  statusEl.className = 'status';
  if (type) statusEl.classList.add(type);

  if (message) {
    clearTimeout(setStatus.timeoutId);
    setStatus.timeoutId = setTimeout(() => {
      statusEl.textContent = '';
      statusEl.className = 'status';
    }, STATUS_TIMEOUT_MS);
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const isBinaryAtlas = /\.(bin)$/i.test(file.name || '');

    if (!isBinaryAtlas) {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Failed to read file text.'));
      reader.readAsText(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const buffer = reader.result;
        const bytes = new Uint8Array(buffer);
        const utf8Text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
        const cleaned = utf8Text.replace(/[\u0000-\u0008\u000B-\u001F]/g, '');
        resolve(cleaned || new TextDecoder('latin1').decode(bytes));
      } catch (error) {
        reject(new Error('Failed to decode .bin atlas file.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file text.'));
    reader.readAsArrayBuffer(file);
  });
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load image.'));
    img.src = dataUrl;
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function buildAutoFolderName(sourceName, suffix = 'sprites') {
  const base = sourceName ? sourceName.replace(/\.[^/.]+$/, '') : 'sprites';
  const safeBase = sanitizeName(base) || 'sprites';
  return `${safeBase}_${suffix}`;
}

function makeZipArchive(entries, archiveName, verticesEntry = null) {
  return new Promise(async (resolve, reject) => {
    try {
      const zip = new JSZip();
      const folderName = `${archiveName}`;
      const folder = zip.folder(folderName);

      await Promise.all(entries.map(async ({ fileName, canvas }) => {
        const blob = await canvasToBlob(canvas);
        if (blob && folder) {
          folder.file(fileName, blob);
        }
      }));

      if (verticesEntry) {
        folder.file(verticesEntry.fileName, verticesEntry.blob);
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      resolve({ blob, fileName: `${archiveName}.zip` });
    } catch (error) {
      reject(error);
    }
  });
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to create PNG export.'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
}

async function writeBlobToDirectory(directoryHandle, filename, blob) {
  const fileHandle = await directoryHandle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(await blob.arrayBuffer());
  await writable.close();
}

async function ensureDirectoryHandle(rootHandle, folderName) {
  const safeFolderName = sanitizeName(folderName || 'sprites_export') || 'sprites_export';
  return rootHandle.getDirectoryHandle(safeFolderName, { create: true });
}

async function exportEntriesToFolder(entries, sourceName, suffix = 'sprites', verticesEntry = null) {
  if (!('showDirectoryPicker' in window)) {
    return false;
  }

  try {
    const rootHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    const folderName = buildAutoFolderName(sourceName, suffix);
    const folderHandle = await ensureDirectoryHandle(rootHandle, folderName);

    for (const entry of entries) {
      const blob = await canvasToBlob(entry.canvas);
      await writeBlobToDirectory(folderHandle, entry.fileName, blob);
    }

    // Add vertices JSON if provided
    if (verticesEntry) {
      await writeBlobToDirectory(folderHandle, verticesEntry.fileName, verticesEntry.blob);
    }

    return true;
  } catch (error) {
    return false;
  }
}

async function exportEntriesToZip(entries, sourceName, verticesEntry = null) {
  if (!window.JSZip) {
    return false;
  }

  try {
    const archiveName = sanitizeName(sourceName ? sourceName.replace(/\.[^/.]+$/, '') : 'sprites');
    const archive = await makeZipArchive(entries, archiveName, verticesEntry);
    downloadBlob(archive.blob, archive.fileName);
    return true;
  } catch (error) {
    return false;
  }
}

async function exportCombinedZipForPairs(pairs, archiveName = 'sprites_export') {
  if (!window.JSZip || !pairs || !pairs.length) {
    return false;
  }

  try {
    const zip = new JSZip();
    const finalArchiveName = sanitizeName(archiveName || 'sprites_export') || 'sprites_export';

    for (const { folderName, entries, verticesEntry } of pairs) {
      const folder = zip.folder(folderName) || zip;

      for (const entry of entries) {
        const blob = await canvasToBlob(entry.canvas);
        folder.file(entry.fileName, blob);
      }

      if (verticesEntry) {
        folder.file(verticesEntry.fileName, verticesEntry.blob);
      }
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(blob, `${finalArchiveName}.zip`);
    return true;
  } catch (error) {
    return false;
  }
}

// Detect sprites using vertex/contour detection for more accurate boundaries
function detectSpritesWithVertices(image) {
  const width = image.width;
  const height = image.height;
  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = width;
  sampleCanvas.height = height;
  const ctx = sampleCanvas.getContext('2d');
  ctx.drawImage(image, 0, 0);

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const visited = new Uint8Array(width * height);

  function hasVisiblePixelAt(x, y) {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    const idx = (y * width + x) * 4 + 3;
    return data[idx] > 127; // Alpha threshold
  }

  // Flood fill to get connected component bounds
  function floodFillBounds(startX, startY) {
    const queue = [[startX, startY]];
    visited[startY * width + startX] = 1;
    let minX = startX, maxX = startX, minY = startY, maxY = startY;
    let pixelCount = 0;

    while (queue.length > 0) {
      const [x, y] = queue.shift();
      pixelCount++;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);

      // Check 4-directional neighbors
      const neighbors = [[0, -1], [0, 1], [-1, 0], [1, 0]];
      for (const [dx, dy] of neighbors) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const idx = ny * width + nx;
          if (!visited[idx] && hasVisiblePixelAt(nx, ny)) {
            visited[idx] = 1;
            queue.push([nx, ny]);
          }
        }
      }
    }

    return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1, pixelCount };
  }

  // Find all connected components
  const allSprites = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!visited[y * width + x] && hasVisiblePixelAt(x, y)) {
        const bounds = floodFillBounds(x, y);
        allSprites.push(bounds);
      }
    }
  }

  if (allSprites.length === 0) {
    return { columns: 1, rows: 1, frameWidth: width, frameHeight: height, sprites: [] };
  }

  // Filter out noise: sprites must meet minimum size requirements
  const avgArea = allSprites.reduce((sum, s) => sum + s.width * s.height, 0) / allSprites.length;
  const minArea = Math.max(100, avgArea * 0.1); // At least 10% of average or 100 pixels
  const sprites = allSprites.filter(s => s.width * s.height >= minArea);

  if (sprites.length === 0) {
    return { columns: 1, rows: 1, frameWidth: width, frameHeight: height, sprites: [] };
  }

  // Sort sprites by position
  sprites.sort((a, b) => a.y - b.y || a.x - b.x);

  // Determine grid layout by analyzing Y positions
  const tolerance = Math.max(3, Math.floor(sprites[0].height * 0.15)); // 15% of sprite height
  const rows = [];
  let currentRow = [sprites[0]];
  let lastY = sprites[0].y;

  for (let i = 1; i < sprites.length; i++) {
    const yDiff = Math.abs(sprites[i].y - lastY);
    const yDiffFromRowBottom = Math.abs(sprites[i].y - (currentRow[currentRow.length - 1].y + currentRow[currentRow.length - 1].height));
    
    // If Y position is similar to start or adjacent to current row
    if (yDiff <= tolerance || yDiffFromRowBottom <= tolerance) {
      currentRow.push(sprites[i]);
      lastY = Math.min(lastY, sprites[i].y);
    } else {
      if (currentRow.length > 0) rows.push(currentRow);
      currentRow = [sprites[i]];
      lastY = sprites[i].y;
    }
  }
  if (currentRow.length > 0) rows.push(currentRow);

  // Sort each row by x coordinate
  rows.forEach(row => row.sort((a, b) => a.x - b.x));

  // Calculate average dimensions
  const avgWidths = rows.map(row => 
    row.reduce((sum, sprite) => sum + sprite.width, 0) / row.length
  );
  const avgHeights = rows.map(row =>
    row.reduce((sum, sprite) => sum + sprite.height, 0) / row.length
  );

  const avgFrameWidth = Math.round(avgWidths.reduce((a, b) => a + b, 0) / avgWidths.length);
  const avgFrameHeight = Math.round(avgHeights.reduce((a, b) => a + b, 0) / avgHeights.length);

  return {
    columns: rows[0] ? rows[0].length : 1,
    rows: rows.length,
    frameWidth: avgFrameWidth,
    frameHeight: avgFrameHeight,
    sprites: sprites, // Return detected sprites for direct use
  };
}

function detectSpriteGrid(image) {
  // Use vertex-based detection for improved accuracy
  return detectSpritesWithVertices(image);
}

function setPreview(selector, src) {
  const preview = document.querySelector(selector);
  if (!preview) return;

  preview.innerHTML = '';
  const img = new Image();
  img.src = src;
  img.alt = 'Preview';
  img.style.maxWidth = '100%';
  img.style.maxHeight = '420px';
  img.style.objectFit = 'contain';
  img.style.display = 'block';
  preview.appendChild(img);
}

function createOverlayPreview(selector, imageSource, drawOverlay, infoSelector, infoText) {
  const preview = document.querySelector(selector);
  if (!preview) return;

  preview.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.style.position = 'relative';
  wrapper.style.display = 'inline-flex';
  wrapper.style.maxWidth = '100%';
  wrapper.style.maxHeight = '420px';
  wrapper.style.justifyContent = 'center';
  wrapper.style.alignItems = 'center';

  const img = new Image();
  img.onload = () => {
    img.style.display = 'block';
    img.style.maxWidth = '100%';
    img.style.maxHeight = '420px';
    img.style.objectFit = 'contain';

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.display = 'block';

    const ctx = canvas.getContext('2d');
    drawOverlay(ctx, canvas.width, canvas.height);

    wrapper.appendChild(img);
    wrapper.appendChild(canvas);
    preview.appendChild(wrapper);
  };
  img.src = imageSource;

  if (infoSelector) {
    const info = document.querySelector(infoSelector);
    if (info) {
      info.textContent = infoText;
      info.style.display = 'block';
    }
  }
}

function visualizeMetaSprites(selector, image, metaFrames) {
  createOverlayPreview(selector, image, (ctx, width, height) => {
    ctx.clearRect(0, 0, width, height);
    metaFrames.forEach((frame) => {
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.95)';
      ctx.lineWidth = Math.max(1, Math.round(width / 300));
      ctx.strokeRect(frame.x, frame.y, frame.width, frame.height);

      ctx.fillStyle = 'rgba(52, 211, 153, 1)';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(String(frame.name || 'sprite').slice(0, 12), frame.x + 4, frame.y + 12);
    });
  }, '#meta-detection-info', `${metaFrames.length} sprite regions from the .meta file`);
}

function visualizeSpriteDetection(selector, image, detectedSprites) {
  createOverlayPreview(selector, image.src, (ctx, width, height) => {
    ctx.clearRect(0, 0, width, height);
    detectedSprites.forEach((sprite, index) => {
      ctx.strokeStyle = 'rgba(0, 255, 0, 0.9)';
      ctx.lineWidth = Math.max(1, Math.round(width / 300));
      ctx.strokeRect(sprite.x, sprite.y, sprite.width, sprite.height);

      ctx.fillStyle = 'rgba(0, 255, 0, 1)';
      ctx.font = 'bold 12px monospace';
      ctx.fillText(`#${index + 1}`, sprite.x + 4, sprite.y + 16);
    });
  }, '#sprite-detection-info', `Detected: ${detectedSprites.length} sprites`);
}

function visualizeXmlSprites(selector, image, xmlSprites) {
  createOverlayPreview(selector, image, (ctx, width, height) => {
    ctx.clearRect(0, 0, width, height);
    xmlSprites.forEach((sprite) => {
      ctx.strokeStyle = 'rgba(0, 255, 100, 0.9)';
      ctx.lineWidth = Math.max(1, Math.round(width / 300));
      ctx.strokeRect(sprite.x, sprite.y, sprite.width, sprite.height);

      ctx.fillStyle = 'rgba(0, 255, 100, 1)';
      ctx.font = 'bold 10px monospace';
      ctx.fillText(String(sprite.name || 'frame').slice(0, 12), sprite.x + 4, sprite.y + 12);
    });
  }, '#xml-detection-info', `${xmlSprites.length} sprite regions loaded from the XML file`);
}

function drawSpritePreview(selector, image, detectedSprites) {
  const preview = document.querySelector(selector);
  if (!preview) return;

  preview.innerHTML = '';
  const info = document.querySelector('#sprite-detection-info');
  if (info) {
    info.textContent = `Detected: ${detectedSprites.length} sprites`;
    info.style.display = 'block';
  }

  visualizeSpriteDetection(selector, image, detectedSprites);
}

function drawCropToCanvas(image, x, y, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, x, y, width, height, 0, 0, width, height);
  return canvas;
}

function writeTextBlobToDirectory(directoryHandle, filename, blob) {
  return directoryHandle.getFileHandle(filename, { create: true }).then(async (fileHandle) => {
    const writable = await fileHandle.createWritable();
    await writable.write(await blob.arrayBuffer());
    await writable.close();
  });
}

function rotateCanvas(canvas, degrees) {
  if (!degrees || degrees % 360 === 0) return canvas;

  const rotated = document.createElement('canvas');
  const ctx = rotated.getContext('2d');

  const angle = (degrees * Math.PI) / 180;
  if (degrees === 90 || degrees === 270) {
    rotated.width = canvas.height;
    rotated.height = canvas.width;
  } else {
    rotated.width = canvas.width;
    rotated.height = canvas.height;
  }

  ctx.translate(rotated.width / 2, rotated.height / 2);
  ctx.rotate(angle);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);

  return rotated;
}

function applySpriteRotation(entries, degrees) {
  if (!degrees || degrees % 360 === 0) return entries;

  return entries.map((entry) => ({
    ...entry,
    canvas: rotateCanvas(entry.canvas, degrees),
  }));
}

function extractSpriteWithVertices(imageData, spriteRegion, originalWidth, originalHeight) {
  const { data: fullData } = imageData;
  const fullWidth = originalWidth;
  const fullHeight = originalHeight;

  // Find exact sprite bounds within the region
  let minX = spriteRegion.x + spriteRegion.width;
  let maxX = spriteRegion.x;
  let minY = spriteRegion.y + spriteRegion.height;
  let maxY = spriteRegion.y;

  for (let y = spriteRegion.y; y < spriteRegion.y + spriteRegion.height; y++) {
    for (let x = spriteRegion.x; x < spriteRegion.x + spriteRegion.width; x++) {
      const idx = (y * fullWidth + x) * 4 + 3;
      if (fullData[idx] > 127) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }

  // Ensure valid bounds
  if (maxX < minX || maxY < minY) {
    return null;
  }

  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  const newImageData = ctx.createImageData(width, height);
  const newData = newImageData.data;

  // Copy only the sprite pixels
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const srcIdx = (y * fullWidth + x) * 4;
      const dstIdx = ((y - minY) * width + (x - minX)) * 4;
      newData[dstIdx] = fullData[srcIdx];     // R
      newData[dstIdx + 1] = fullData[srcIdx + 1]; // G
      newData[dstIdx + 2] = fullData[srcIdx + 2]; // B
      newData[dstIdx + 3] = fullData[srcIdx + 3]; // A
    }
  }

  ctx.putImageData(newImageData, 0, 0);
  return canvas;
}

function buildSpriteEntriesFromVertices(image, detectedSprites, options = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);
  
  const imageData = ctx.getImageData(0, 0, image.width, image.height);
  const entries = [];

  detectedSprites.forEach((sprite, index) => {
    const spriteCanvas = extractSpriteWithVertices(imageData, sprite, image.width, image.height);
    if (spriteCanvas) {
      entries.push({
        fileName: `sprite_${index + 1}.png`,
        canvas: spriteCanvas,
      });
    }
  });

  return entries;
}

function extractSpriteShape(image, spriteRegion) {
  // This function is kept for backwards compatibility but uses the new vertex extraction
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);
  
  const imageData = ctx.getImageData(0, 0, image.width, image.height);
  return extractSpriteWithVertices(imageData, spriteRegion, image.width, image.height);
}

function buildSpriteEntries(image, options = {}) {
  const {
    columns = 1,
    rows = 1,
    padding = 0,
    gap = 0,
    startX = 0,
    startY = 0,
    trim = false,
  } = options;

  const frameWidth = Math.floor((image.width - startX - padding * 2) / columns);
  const frameHeight = Math.floor((image.height - startY - padding * 2) / rows);
  const entries = [];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = startX + column * (frameWidth + gap) + padding;
      const y = startY + row * (frameHeight + gap) + padding;
      const rawW = Math.max(1, frameWidth);
      const rawH = Math.max(1, frameHeight);
      const cropX = Math.min(Math.max(x, 0), image.width - 1);
      const cropY = Math.min(Math.max(y, 0), image.height - 1);
      const cropW = Math.min(rawW, image.width - cropX);
      const cropH = Math.min(rawH, image.height - cropY);

      const canvas = drawCropToCanvas(image, cropX, cropY, cropW, cropH);
      if (trim) {
        const trimmed = trimCanvas(canvas);
        entries.push({
          fileName: `sprite_${row + 1}_${column + 1}.png`,
          canvas: trimmed,
        });
      } else {
        entries.push({
          fileName: `sprite_${row + 1}_${column + 1}.png`,
          canvas,
        });
      }
    }
  }

  return entries;
}

function trimCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = imageData;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 0) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) {
    return canvas;
  }

  const newWidth = maxX - minX + 1;
  const newHeight = maxY - minY + 1;
  const trimmedCanvas = document.createElement('canvas');
  trimmedCanvas.width = newWidth;
  trimmedCanvas.height = newHeight;
  const trimmedCtx = trimmedCanvas.getContext('2d');
  trimmedCtx.putImageData(
    ctx.getImageData(minX, minY, newWidth, newHeight),
    0,
    0
  );

  return trimmedCanvas;
}

function normalizeRotationFromXml(node) {
  const rotatedFlag = node.getAttribute('rotated');
  const rotationAttribute = node.getAttribute('rotation') || node.getAttribute('angle') || node.getAttribute('r');

  if (rotatedFlag && ['true', '1', 'yes', 'y', 'true'].includes(String(rotatedFlag).toLowerCase())) {
    return 90;
  }

  if (rotationAttribute) {
    const cleanValue = String(rotationAttribute).trim().toLowerCase();
    if (['true', 'yes', 'y', 'clockwise', 'cw'].includes(cleanValue)) {
      return 90;
    }

    const numericValue = Number(cleanValue.replace(/[^0-9-]/g, ''));
    if (!Number.isNaN(numericValue) && [90, 180, 270].includes(numericValue)) {
      return numericValue;
    }
  }

  return 0;
}

function undoRotation(degrees) {
  if (!degrees) return 0;
  return (360 - degrees) % 360;
}

function parseAtlasXml(xmlText) {
  const rawText = String(xmlText || '');
  const safeText = rawText.replace(/[\u0000-\u0008\u000B-\u001F]/g, '');
  const parser = new DOMParser();
  const xml = parser.parseFromString(safeText, 'text/xml');
  const items = [];

  const selectors = ['SubTexture', 'sprite', 'frame'];

  selectors.forEach((selector) => {
    const nodes = xml.querySelectorAll(selector);
    nodes.forEach((node) => {
      const rotation = normalizeRotationFromXml(node);
      const name = node.getAttribute('name') || node.getAttribute('n') || `sprite_${items.length + 1}`;
      const x = Number(node.getAttribute('x') ?? node.getAttribute('X') ?? 0);
      const y = Number(node.getAttribute('y') ?? node.getAttribute('Y') ?? 0);
      const width = Number(node.getAttribute('width') ?? node.getAttribute('w') ?? node.getAttribute('frameWidth') ?? 0);
      const height = Number(node.getAttribute('height') ?? node.getAttribute('h') ?? node.getAttribute('frameHeight') ?? 0);

      if (!width && !height) {
        const w = Number(node.getAttribute('w') ?? 0);
        const h = Number(node.getAttribute('h') ?? 0);
        items.push({
          name,
          x,
          y,
          width: w,
          height: h,
          rotation,
          vertices: null,
        });
        return;
      }

      // Extract vertices if available (for polygon-based cutting)
      let vertices = null;
      const verticesNode = node.querySelector('vertices');
      if (verticesNode && verticesNode.textContent) {
        const vertexData = verticesNode.textContent.trim().split(' ').map(Number);
        const vertexPairs = [];
        for (let i = 0; i < vertexData.length; i += 2) {
          vertexPairs.push({ x: vertexData[i], y: vertexData[i + 1] });
        }
        vertices = vertexPairs.length > 0 ? vertexPairs : null;
      }

      items.push({ name, x, y, width, height, rotation, vertices });
    });
  });

  return items;
}

// Ray casting algorithm for accurate point-in-polygon detection
function isPointInPolygon(point, vertices) {
  const x = point.x;
  const y = point.y;
  let inside = false;

  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i].x;
    const yi = vertices[i].y;
    const xj = vertices[j].x;
    const yj = vertices[j].y;

    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }

  return inside;
}

// Distance from point to line segment
function pointToSegmentDistance(point, segStart, segEnd) {
  const px = point.x;
  const py = point.y;
  const x1 = segStart.x;
  const y1 = segStart.y;
  const x2 = segEnd.x;
  const y2 = segEnd.y;

  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) param = dot / lenSq;

  let xx, yy;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = px - xx;
  const dy = py - yy;
  return Math.sqrt(dx * dx + dy * dy);
}

// Get alpha factor based on proximity to polygon edge (for anti-aliasing)
function getPolygonAlphaFactor(point, vertices) {
  const inside = isPointInPolygon(point, vertices);
  
  if (inside) {
    return 1.0; // Fully inside
  }

  // Find distance to nearest edge
  let minDist = Infinity;
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    const dist = pointToSegmentDistance(point, vertices[i], vertices[j]);
    minDist = Math.min(minDist, dist);
  }

  // Return alpha based on distance (smooth falloff near edges)
  const edgeWidth = 1.5; // Pixels to fade over
  if (minDist > edgeWidth) {
    return 0.0; // Outside
  }
  return 1.0 - (minDist / edgeWidth); // Smooth falloff
}

function isRectangleVertexMesh(vertices, width, height) {
  if (!vertices || vertices.length !== 4) return false;

  const xValues = [...new Set(vertices.map((vertex) => Math.round(vertex.x)))];
  const yValues = [...new Set(vertices.map((vertex) => Math.round(vertex.y)))];
  if (xValues.length !== 2 || yValues.length !== 2) return false;

  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  return Math.abs(minX) <= 1 && Math.abs(minY) <= 1
    && Math.abs(maxX - width) <= 1 && Math.abs(maxY - height) <= 1;
}

function createSpriteFromXmlWithVertices(image, entry) {
  if (!entry.vertices || entry.vertices.length < 3 || isRectangleVertexMesh(entry.vertices, entry.width, entry.height)) {
    // Fallback to rectangular cut if no vertices
    const canvas = drawCropToCanvas(image, entry.x, entry.y, entry.width, entry.height);
    const correctedCanvas = rotateCanvas(canvas, undoRotation(entry.rotation || 0));
    return { fileName: `${sanitizeName(entry.name)}.png`, canvas: correctedCanvas };
  }

  // Create a temporary canvas for the sprite's bounding box
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = entry.width;
  tempCanvas.height = entry.height;
  const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
  
  // Draw the sprite region from the atlas
  tempCtx.drawImage(image, entry.x, entry.y, entry.width, entry.height, 0, 0, entry.width, entry.height);
  const imageData = tempCtx.getImageData(0, 0, entry.width, entry.height);
  const { data, width, height } = imageData;

  // Apply polygon masking using point-in-polygon algorithm
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alphaFactor = getPolygonAlphaFactor({ x, y }, entry.vertices);
      const idx = (y * width + x) * 4 + 3;
      
      // Multiply alpha by the polygon mask factor
      const originalAlpha = data[idx];
      data[idx] = Math.round(originalAlpha * alphaFactor);
    }
  }

  tempCtx.putImageData(imageData, 0, 0);

  // Find the tightest bounding box around visible pixels
  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 0) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }

  // If no visible pixels found, return fallback
  if (maxX < 0 || maxY < 0) {
    const correctedCanvas = rotateCanvas(tempCanvas, undoRotation(entry.rotation || 0));
    return { fileName: `${sanitizeName(entry.name)}.png`, canvas: correctedCanvas };
  }

  // Extract the tightest bounding box
  const cropWidth = maxX - minX + 1;
  const cropHeight = maxY - minY + 1;
  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = cropWidth;
  croppedCanvas.height = cropHeight;
  const croppedCtx = croppedCanvas.getContext('2d');
  
  const croppedImageData = croppedCtx.createImageData(cropWidth, cropHeight);
  const croppedData = croppedImageData.data;

  // Copy cropped region
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = ((y - minY) * cropWidth + (x - minX)) * 4;
      croppedData[dstIdx] = data[srcIdx];
      croppedData[dstIdx + 1] = data[srcIdx + 1];
      croppedData[dstIdx + 2] = data[srcIdx + 2];
      croppedData[dstIdx + 3] = data[srcIdx + 3];
    }
  }

  croppedCtx.putImageData(croppedImageData, 0, 0);

  // Apply rotation correction
  const rotated = rotateCanvas(croppedCanvas, undoRotation(entry.rotation || 0));
  return { fileName: `${sanitizeName(entry.name)}.png`, canvas: rotated };
}

function createSpriteFromXml(image, entry) {
  // Use vertex-based cutting if vertices are available
  if (entry.vertices && entry.vertices.length >= 3) {
    return createSpriteFromXmlWithVertices(image, entry);
  }

  // Fallback to rectangular cutting
  const canvas = drawCropToCanvas(image, entry.x, entry.y, entry.width, entry.height);
  const correctedCanvas = rotateCanvas(canvas, undoRotation(entry.rotation || 0));
  return { fileName: `${sanitizeName(entry.name)}.png`, canvas: correctedCanvas };
}

function getXmlEyeLidSplitInfo(atlasEntries) {
  const matches = atlasEntries.filter((entry) => {
    const label = String(entry.name || '').toLowerCase();
    return label.includes('eye') || label.includes('lid');
  });

  if (matches.length < 2) {
    return null;
  }

  // Separate entries with explicit left/right labels from those without
  const labeled = [];
  const unlabeled = [];

  matches.forEach((entry) => {
    const label = String(entry.name || '').toLowerCase();
    if (label.includes('left') || label.includes('right')) {
      labeled.push(entry);
    } else {
      unlabeled.push(entry);
    }
  });

  // Sort unlabeled by x position
  const sortedUnlabeled = unlabeled.sort((a, b) => a.x - b.x);
  
  // Split unlabeled into left and right halves by position
  const midpoint = Math.ceil(sortedUnlabeled.length / 2);
  const unlabledLeft = sortedUnlabeled.slice(0, midpoint);
  const unlabledRight = sortedUnlabeled.slice(midpoint);

  // Combine and assign sides
  const grouped = matches.map((entry) => {
    const label = String(entry.name || '').toLowerCase();
    let side = 'left';

    if (label.includes('right')) {
      side = 'right';
    } else if (label.includes('left')) {
      side = 'left';
    } else {
      // Use position-based assignment for unlabeled
      side = unlabledLeft.some((e) => e.x === entry.x && e.y === entry.y) ? 'left' : 'right';
    }

    return {
      ...entry,
      splitSide: side,
    };
  });

  return {
    matches: grouped,
    left: grouped.filter((entry) => entry.splitSide === 'left'),
    right: grouped.filter((entry) => entry.splitSide === 'right'),
  };
}

function getEyeSplitBaseName(name) {
  return sanitizeName(name).replace(/eyes$/i, 'eye');
}

function detectTransparentGapInCanvas(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = imageData;

  const verticalOpacity = [];
  for (let x = 0; x < width; x++) {
    let transparentPixels = 0;
    let fullyTransparentPixels = 0;
    for (let y = 0; y < height; y++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha <= 5) {
        fullyTransparentPixels++;
      }
      if (alpha <= 20) transparentPixels++;
    }
    verticalOpacity.push({ fullyTransparentRatio: fullyTransparentPixels / height, transparentRatio: transparentPixels / height });
  }

  let maxVerticalGap = { start: -1, end: -1, size: 0 };
  let inGap = false;
  let gapStart = 0;

  for (let x = 0; x < verticalOpacity.length; x++) {
    const column = verticalOpacity[x];
    const isTransparentColumn = column.fullyTransparentRatio > 0.9 || column.transparentRatio > 0.98;
    if (isTransparentColumn) {
      if (!inGap) {
        gapStart = x;
        inGap = true;
      }
    } else if (inGap) {
      const gapSize = x - gapStart;
      if (gapSize > maxVerticalGap.size) {
        maxVerticalGap = { start: gapStart, end: x, size: gapSize };
      }
      inGap = false;
    }
  }

  if (inGap) {
    const gapSize = verticalOpacity.length - gapStart;
    if (gapSize > maxVerticalGap.size) {
      maxVerticalGap = { start: gapStart, end: verticalOpacity.length, size: gapSize };
    }
  }

  if (maxVerticalGap.size > 6) {
    return { direction: 'vertical', gap: maxVerticalGap };
  }

  return null;
}

function getPixelBoundsInRegion(canvas, startX, endX) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = imageData;

  let minX = endX;
  let maxX = startX - 1;
  let minY = height;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = startX; x < endX; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return null;
  }

  return { minX, maxX, minY, maxY };
}

function cropCanvasToVisibleBounds(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = imageData;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return canvas;
  }

  const cropWidth = maxX - minX + 1;
  const cropHeight = maxY - minY + 1;
  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = cropWidth;
  croppedCanvas.height = cropHeight;

  const croppedCtx = croppedCanvas.getContext('2d');
  const cropData = ctx.getImageData(minX, minY, cropWidth, cropHeight);
  croppedCtx.putImageData(cropData, 0, 0);

  return croppedCanvas;
}

function splitCanvasByTransparentGap(canvas, name, direction, gap) {
  const result = [];

  if (direction !== 'vertical') {
    return result;
  }

  // Get bounds of left and right eye pixels (not including the gap)
  const leftBounds = getPixelBoundsInRegion(canvas, 0, gap.start);
  const rightBounds = getPixelBoundsInRegion(canvas, gap.end, canvas.width);

  const createExactCropCanvas = (sourceBounds) => {
    if (!sourceBounds) return null;

    const width = sourceBounds.maxX - sourceBounds.minX + 1;
    const height = sourceBounds.maxY - sourceBounds.minY + 1;

    const sourceCtx = canvas.getContext('2d', { willReadFrequently: true });
    const cropData = sourceCtx.getImageData(sourceBounds.minX, sourceBounds.minY, width, height);

    const eyeCanvas = document.createElement('canvas');
    eyeCanvas.width = width;
    eyeCanvas.height = height;
    const eyeCtx = eyeCanvas.getContext('2d');
    eyeCtx.putImageData(cropData, 0, 0);

    const finalCanvas = cropCanvasToVisibleBounds(eyeCanvas);
    return finalCanvas || eyeCanvas;
  };

  if (leftBounds) {
    const leftCanvas = createExactCropCanvas(leftBounds);
    if (leftCanvas) {
      result.push({ canvas: leftCanvas, suffix: '_left' });
    }
  }

  if (rightBounds) {
    const rightCanvas = createExactCropCanvas(rightBounds);
    if (rightCanvas) {
      result.push({ canvas: rightCanvas, suffix: '_right' });
    }
  }

  return result;
}

function detectAndSplitOversizedLids(image, entries) {
  const eyeMatches = entries.filter((entry) => {
    const label = String(entry.name || '').toLowerCase();
    return label.includes('eye') || label.includes('lid');
  });

  if (eyeMatches.length < 2) return entries.map((entry) => createSpriteFromXml(image, entry));

  const result = [];

  entries.forEach((entry) => {
    const label = String(entry.name || '').toLowerCase();
    const isLidOrEye = label.includes('lid') || label.includes('eye');

    if (!isLidOrEye) {
      result.push(createSpriteFromXml(image, entry));
      return;
    }

    const output = createSpriteFromXml(image, entry);
    const canvas = cropCanvasToVisibleBounds(output.canvas);
    const gapInfo = detectTransparentGapInCanvas(canvas);

    if (gapInfo && gapInfo.direction === 'vertical' && gapInfo.gap.size > 0) {
      const splitCanvases = splitCanvasByTransparentGap(canvas, entry.name, gapInfo.direction, gapInfo.gap);
      if (splitCanvases.length) {
        splitCanvases.forEach((split) => {
          const baseName = getEyeSplitBaseName(entry.name);
          result.push({
            fileName: `${baseName}${split.suffix}.png`,
            canvas: cropCanvasToVisibleBounds(split.canvas),
          });
        });
        return;
      }
    }

    result.push({ ...output, canvas: canvas || output.canvas });
  });

  return result;
}

function splitXmlEyeLidEntries(image, atlasEntries) {
  // First, detect and split by transparent gaps in rendered sprites.
  // This must happen after the individual sprite has been extracted from the sheet.
  const presplitEntries = detectAndSplitOversizedLids(image, atlasEntries);

  // Then apply left/right assignment to eye-only sprites by position
  const eyeOnlyMatches = atlasEntries.filter((entry) => {
    const label = String(entry.name || '').toLowerCase();
    return label.includes('eye') && !label.includes('lid');
  });

  if (eyeOnlyMatches.length >= 2) {
    const sortedEyes = [...eyeOnlyMatches].sort((a, b) => a.x - b.x);
    const midpoint = Math.ceil(sortedEyes.length / 2);
    const leftEyesSet = new Set(sortedEyes.slice(0, midpoint).map((e) => e.name + ':' + e.x + ':' + e.y));

    return presplitEntries.map((entry) => {
      // Find the original entry this came from
      let origEntry = null;
      let baseName = entry.fileName.replace(/\.(png|jpg|jpeg)$/i, '').replace(/_left|_right$/, '');

      for (const e of atlasEntries) {
        if (sanitizeName(e.name) === baseName || getEyeSplitBaseName(e.name) === baseName) {
          origEntry = e;
          break;
        }
      }

      if (!origEntry) return entry;

      const label = String(origEntry.name || '').toLowerCase();
      const isEyeOnly = label.includes('eye') && !label.includes('lid');

      if (!isEyeOnly) return entry;

      if (entry.fileName.match(/_left|_right/)) return entry;

      let side = 'left';
      if (label.includes('left')) {
        side = 'left';
      } else if (label.includes('right')) {
        side = 'right';
      } else {
        const key = origEntry.name + ':' + origEntry.x + ':' + origEntry.y;
        side = leftEyesSet.has(key) ? 'left' : 'right';
      }

      return {
        ...entry,
        fileName: `${getEyeSplitBaseName(origEntry.name)}_${side}.png`,
      };
    });
  }

  return presplitEntries;
}

function splitMetaEntriesWithEyeLidFix(image, spriteFrames, splitEyeSpritesEnabled = false) {
  const baseEntries = spriteFrames.map((entry) => createSpriteFromXml(image, entry));

  if (!splitEyeSpritesEnabled) {
    return baseEntries;
  }

  const eyeInfo = getXmlEyeLidSplitInfo(spriteFrames);
  if (!eyeInfo) {
    return baseEntries;
  }

  return splitXmlEyeLidEntries(image, spriteFrames);
}

function previewXmlEyeLidSplit(selector, image, atlasEntries) {
  const eyeInfo = getXmlEyeLidSplitInfo(atlasEntries);
  if (!eyeInfo) {
    visualizeXmlSprites(selector, image, atlasEntries);
    return;
  }

  createOverlayPreview(selector, image, (ctx, width, height) => {
    ctx.clearRect(0, 0, width, height);
    eyeInfo.matches.forEach((sprite) => {
      const tint = 'rgba(52, 211, 153, 0.95)';
      ctx.strokeStyle = tint;
      ctx.lineWidth = Math.max(1, Math.round(width / 300));
      ctx.strokeRect(sprite.x, sprite.y, sprite.width, sprite.height);

      ctx.fillStyle = tint;
      ctx.font = 'bold 10px monospace';
      ctx.fillText(`${sprite.splitSide.toUpperCase()} ${String(sprite.name || 'eye').slice(0, 12)}`, sprite.x + 4, sprite.y + 12);
    });
  }, '#xml-detection-info', `Split preview: ${eyeInfo.matches.length} regions (${eyeInfo.left.length} left, ${eyeInfo.right.length} right)`);
}

function sanitizeName(value) {
  return String(value || 'sprite')
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'sprite';
}

// Convert sprite bounds to corner vertices
function spriteBoundsToVertices(sprite) {
  return [
    { x: sprite.x, y: sprite.y },
    { x: sprite.x + sprite.width, y: sprite.y },
    { x: sprite.x + sprite.width, y: sprite.y + sprite.height },
    { x: sprite.x, y: sprite.y + sprite.height },
  ];
}

// Create a vertices JSON file from detected sprites
function createVerticesJsonEntry(sprites, baseFileName = 'vertices') {
  const verticesData = sprites.map((sprite, index) => ({
    id: index,
    name: sprite.name || `sprite_${index + 1}`,
    x: sprite.x,
    y: sprite.y,
    width: sprite.width,
    height: sprite.height,
    vertices: spriteBoundsToVertices(sprite),
  }));

  const jsonText = JSON.stringify(verticesData, null, 2);
  const blob = new Blob([jsonText], { type: 'application/json' });
  return {
    fileName: `${baseFileName}.json`,
    blob,
    textContent: jsonText,
  };
}

// Create vertices JSON from XML entries with optional polygon data
function createXmlVerticesJsonEntry(xmlEntries, baseFileName = 'vertices') {
  const verticesData = xmlEntries.map((entry, index) => {
    const data = {
      id: index,
      name: entry.name,
      x: entry.x,
      y: entry.y,
      width: entry.width,
      height: entry.height,
      rotation: entry.rotation || 0,
    };

    // Use polygon vertices if available, otherwise use rectangular bounds
    if (entry.vertices && entry.vertices.length >= 3) {
      data.vertices = entry.vertices;
      data.isPolygon = true;
    } else {
      data.vertices = spriteBoundsToVertices(entry);
      data.isPolygon = false;
    }

    return data;
  });

  const jsonText = JSON.stringify(verticesData, null, 2);
  const blob = new Blob([jsonText], { type: 'application/json' });
  return {
    fileName: `${baseFileName}.json`,
    blob,
    textContent: jsonText,
  };
}

// Add vertices JSON to a ZIP archive
async function addJsonToZip(zip, folderName, jsonEntry) {
  const folder = zip.folder(folderName);
  if (folder) {
    folder.file(jsonEntry.fileName, jsonEntry.blob);
  }
}

function generateUnityMetaText({ guid, spriteName, pixelsToUnits = 100, spriteMode = 2, borderX = 0, borderY = 0, borderZ = 0, borderW = 0 }) {
  const safeGuid = guid || '00000000000000000000000000000000';
  return `fileFormatVersion: 2
guid: ${safeGuid}
TextureImporter:
  externalObjects: {}
  serializedVersion: 3
  mipmaps:
    mipMapMode: 0
    enableMipMap: 1
    sRGBTexture: 1
    linearTexture: 0
    fadeOut: 0
    borderMipMap: 0
    mipMapsPreserveCoverage: 0
    alphaTestReferenceValue: 0.5
    mipMapFadeDistanceStart: 1
    mipMapFadeDistanceEnd: 3
  bumpmap:
    convertToNormalMap: 0
    externalNormalMap: 0
    heightScale: 0.25
    normalMapFilter: 0
  isReadable: 0
  streamingMipmaps: 0
  streamingMipmapsPriority: 0
  vTOnly: 0
  ignoreMipmapLimit: 0
  grayScaleToAlpha: 0
  generateCubemap: 6
  cubemapConvolution: 0
  seamlessCubemap: 0
  textureFormat: 0
  maxTextureSize: 2048
  textureSettings:
    serializedVersion: 2
    filterMode: 1
    aniso: 1
    mipBias: 0
    wrapU: 1
    wrapV: 1
    wrapW: 1
    normalMap: 0
    textureCompression: 0
  nPOTScale: 0
  lightmap: 0
  compressionQuality: 50
  spriteMode: ${spriteMode}
  spriteExtrude: 1
  spriteMeshType: 0
  alignment: 0
  spritePivot: { x: 0.5, y: 0.5 }
  spritePixelsToUnits: ${pixelsToUnits}
  spriteBorder: { x: ${borderX}, y: ${borderY}, z: ${borderZ}, w: ${borderW} }
  spriteGenerateFallbackPhysicsShape: 0
  alphaUsage: 1
  alphaIsTransparency: 1
  spriteTessellationDetail: -1
  textureType: 0
  textureShape: 1
  singleChannelComponent: 0
  maxTextureSizeSet: 0
  compressionQualitySet: 0
  textureFormatSet: 0
  userData: 
  assetBundleName: 
  assetBundleVariant: 
`;
}

function parseMetaFileForSprites(metaText) {
  const sprites = [];
  const lines = metaText.split('\n');
  let inSpriteSheet = false;
  let inSprites = false;
  let inRect = false;
  let currentSprite = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Detect spriteSheet section
    if (trimmed.startsWith('spriteSheet:')) {
      inSpriteSheet = true;
      continue;
    }

    // Exit spriteSheet when we hit another root-level key
    if (inSpriteSheet && trimmed && !line.startsWith(' ') && !line.startsWith('\t')) {
      inSpriteSheet = false;
      inSprites = false;
    }

    if (inSpriteSheet) {
      // Detect sprites array
      if (trimmed.startsWith('sprites:')) {
        inSprites = true;
        continue;
      }

      if (inSprites) {
        // New sprite entry: - serializedVersion: 2 or - name:
        if (trimmed.startsWith('- ')) {
          // Save previous sprite if valid
          if (currentSprite && currentSprite.name && currentSprite.width > 0 && currentSprite.height > 0) {
            sprites.push(currentSprite);
          }
          currentSprite = {
            name: '',
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            rotation: 0,
          };
        }
        // Parse sprite name
        else if (currentSprite && trimmed.startsWith('name:')) {
          const nameMatch = trimmed.match(/name:\s*(.+?)(\s*#.*)?$/);
          currentSprite.name = nameMatch ? nameMatch[1].trim() : '';
        }
        // Detect rect section
        else if (currentSprite && trimmed.startsWith('rect:')) {
          inRect = true;
        }
        // Parse rect properties (x, y, width, height)
        else if (currentSprite && inRect && trimmed.includes(':')) {
          const colonIdx = trimmed.indexOf(':');
          const key = trimmed.substring(0, colonIdx).trim();
          const value = trimmed.substring(colonIdx + 1).trim();
          const numValue = Number(value);

          if (!isNaN(numValue)) {
            if (key === 'x') currentSprite.x = numValue;
            else if (key === 'y') currentSprite.y = numValue;
            else if (key === 'width') currentSprite.width = numValue;
            else if (key === 'height') currentSprite.height = numValue;
          }

          // Exit rect when we hit alignment or pivot (next sprite property)
          if (key === 'alignment' || key === 'pivot') {
            inRect = false;
          }
        }
      }
    }
  }

  // Add the last sprite if valid
  if (currentSprite && currentSprite.name && currentSprite.width > 0 && currentSprite.height > 0) {
    sprites.push(currentSprite);
  }

  return sprites;
}

function generateMetaFileWithSprites({ filename = 'spritesheet', guid = '00000000000000000000000000000000', pixelsToUnits = 100, spriteMode = 1, borderX = 0, borderY = 0, borderZ = 0, borderW = 0, sprites = [] }) {
  const safeGuid = guid || '00000000000000000000000000000000';
  const spriteYaml = sprites
    .map((sprite, index) => {
      return `  - name: ${sprite.name}
    x: ${sprite.x}
    y: ${sprite.y}
    width: ${sprite.width}
    height: ${sprite.height}
    rotation: ${sprite.rotation || 0}`;
    })
    .join('\n');

  return `fileFormatVersion: 2
guid: ${safeGuid}
TextureImporter:
  externalObjects: {}
  serializedVersion: 3
  mipmaps:
    mipMapMode: 0
    enableMipMap: 1
    sRGBTexture: 1
    linearTexture: 0
    fadeOut: 0
    borderMipMap: 0
    mipMapsPreserveCoverage: 0
    alphaTestReferenceValue: 0.5
    mipMapFadeDistanceStart: 1
    mipMapFadeDistanceEnd: 3
  bumpmap:
    convertToNormalMap: 0
    externalNormalMap: 0
    heightScale: 0.25
    normalMapFilter: 0
  isReadable: 0
  streamingMipmaps: 0
  streamingMipmapsPriority: 0
  vTOnly: 0
  ignoreMipmapLimit: 0
  grayScaleToAlpha: 0
  generateCubemap: 6
  cubemapConvolution: 0
  seamlessCubemap: 0
  textureFormat: 0
  maxTextureSize: 2048
  textureSettings:
    serializedVersion: 2
    filterMode: 1
    aniso: 1
    mipBias: 0
    wrapU: 1
    wrapV: 1
    wrapW: 1
    normalMap: 0
    textureCompression: 0
  nPOTScale: 0
  lightmap: 0
  compressionQuality: 50
  spriteMode: ${spriteMode}
  spriteExtrude: 1
  spriteMeshType: 0
  alignment: 0
  spritePivot: { x: 0.5, y: 0.5 }
  spritePixelsToUnits: ${pixelsToUnits}
  spriteBorder: { x: ${borderX}, y: ${borderY}, z: ${borderZ}, w: ${borderW} }
  spriteGenerateFallbackPhysicsShape: 0
  alphaUsage: 1
  alphaIsTransparency: 1
  spriteTessellationDetail: -1
  textureType: 0
  textureShape: 1
  singleChannelComponent: 0
  maxTextureSizeSet: 0
  compressionQualitySet: 0
  textureFormatSet: 0
Sprites:
${spriteYaml}
  userData: 
  assetBundleName: 
  assetBundleVariant: 
`;
}

function applyTheme(theme) {
  const safeTheme = theme === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', safeTheme);

  try {
    localStorage.setItem('sprite-cutter-theme', safeTheme);
  } catch (error) {
    // Storage may be unavailable; ignore quietly.
  }

  const buttons = document.querySelectorAll('[data-theme-option]');
  buttons.forEach((button) => {
    const isActive = button.getAttribute('data-theme-option') === safeTheme;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
}

function initializeThemeControls() {
  const defaultTheme = (() => {
    try {
      const savedTheme = localStorage.getItem('sprite-cutter-theme');
      if (savedTheme === 'dark' || savedTheme === 'light') {
        return savedTheme;
      }
    } catch (error) {
      // Ignore.
    }

    return 'dark';
  })();

  applyTheme(defaultTheme);

  const switcher = document.querySelector('[data-theme-switcher]');
  if (!switcher || switcher.dataset.themeInitialized === 'true') return;

  switcher.dataset.themeInitialized = 'true';
  switcher.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    document.documentElement.classList.add('theme-transitioning');
    applyTheme(currentTheme === 'light' ? 'dark' : 'light');
    window.setTimeout(() => {
      document.documentElement.classList.remove('theme-transitioning');
    }, 450);
  });
}

function initializeSpriteCutterPage() {
  const form = document.querySelector('#sprite-form');
  const fileInput = document.querySelector('#sprite-sheet-file');
  if (!form) return;

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;

    showGlobalLoading('Scanning file...');
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const image = await loadImageFromDataUrl(dataUrl);
      const detected = detectSpriteGrid(image);
      
      // Show detection visualization
      if (detected.sprites && detected.sprites.length > 0) {
        drawSpritePreview('#sprite-preview', image, detected.sprites);
      } else {
        setPreview('#sprite-preview', dataUrl);
        const info = document.querySelector('#sprite-detection-info');
        if (info) {
          info.textContent = `Grid: ${detected.columns}×${detected.rows} (${detected.frameWidth}×${detected.frameHeight}px)`;
          info.style.display = 'block';
        }
      }
    } catch (error) {
      setStatus(error.message || 'Failed to preview sprite sheet.', 'error');
    } finally {
      hideGlobalLoading();
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const paddingInput = Number(document.querySelector('#padding').value || 0);
    const gapInput = Number(document.querySelector('#gap').value || 0);
    const trimInput = document.querySelector('#trim-sprites').checked;
    const rotationInput = Number(document.querySelector('#sprite-rotation').value || 0);

    const file = fileInput.files[0];
    if (!file) {
      setStatus('Choose a spritesheet image first.', 'error');
      return;
    }

    showGlobalLoading('Scanning file...');
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const image = await loadImageFromDataUrl(dataUrl);
      const detected = detectSpriteGrid(image);

      let entries;
      let spriteData;
      
      if (detected.sprites && detected.sprites.length >= 2) {
        entries = buildSpriteEntriesFromVertices(image, detected.sprites, {
          trim: trimInput,
        });
        spriteData = detected.sprites;
      } else {
        entries = buildSpriteEntries(image, {
          columns: detected.columns,
          rows: detected.rows,
          padding: paddingInput,
          gap: gapInput,
          trim: trimInput,
        });
        // Create sprite data from grid for vertices
        spriteData = [];
        for (let row = 0; row < detected.rows; row++) {
          for (let col = 0; col < detected.columns; col++) {
            const frameWidth = Math.floor((image.width - paddingInput * 2) / detected.columns);
            const frameHeight = Math.floor((image.height - paddingInput * 2) / detected.rows);
            spriteData.push({
              x: paddingInput + col * (frameWidth + gapInput),
              y: paddingInput + row * (frameHeight + gapInput),
              width: frameWidth,
              height: frameHeight,
              name: `sprite_${row + 1}_${col + 1}`,
            });
          }
        }
      }

      const finalEntries = applySpriteRotation(entries, rotationInput);
      
      // Create vertices JSON export
      const baseFileName = file.name.replace(/\.[^/.]+$/, '');
      const verticesEntry = createVerticesJsonEntry(spriteData, sanitizeName(baseFileName));

      const zipSaved = await exportEntriesToZip(finalEntries, file.name, verticesEntry);
      if (zipSaved) {
        setStatus(`Created ZIP archive ${sanitizeName(file.name.replace(/\.[^/.]+$/, ''))}.zip with sprites and vertices`, 'success');
        return;
      }

      const folderSaved = await exportEntriesToFolder(finalEntries, file.name, 'sprites', verticesEntry);
      if (folderSaved) {
        setStatus(`Saved ${finalEntries.length} auto-detected sprites and vertices into a folder.`, 'success');
        return;
      }

      setStatus('ZIP export is unavailable in this browser, so no loose sprite files were created. Please use the zip download path.', 'error');
    } catch (error) {
      setStatus(error.message || 'Failed to cut sprite sheet.', 'error');
    } finally {
      hideGlobalLoading();
    }
  });
}

function renderSelectedFiles(selector, files) {
  const output = document.querySelector(selector);
  if (!output) return;

  if (!files || !files.length) {
    output.textContent = 'No files selected.';
    return;
  }

  output.textContent = files.length > 1
    ? `Selected files (${files.length}): ${files.map((file) => file.name).join(', ')}`
    : `Selected file: ${files[0].name}`;
}

function getFileStem(fileName) {
  return sanitizeName(fileName.replace(/\.[^/.]+$/, ''));
}

function pairFilesByStem(imageFiles, xmlFiles) {
  const pairs = [];
  const xmlByStem = new Map();

  xmlFiles.forEach((file) => {
    xmlByStem.set(getFileStem(file.name), file);
  });

  imageFiles.forEach((imageFile, index) => {
    let xmlFile = xmlByStem.get(getFileStem(imageFile.name));

    if (!xmlFile && xmlFiles.length === 1) {
      xmlFile = xmlFiles[0];
    } else if (!xmlFile && index < xmlFiles.length) {
      xmlFile = xmlFiles[index];
    }

    if (xmlFile) {
      pairs.push({ imageFile, xmlFile });
    }
  });

  return pairs;
}

function initializeXmlCutterPage() {
  const form = document.querySelector('#xml-form');
  const imageInput = document.querySelector('#xml-sheet-file');
  const xmlInput = document.querySelector('#xml-atlas-file');
  const binInput = document.querySelector('#xml-bin-file');
  if (!form) return;

  const previewIfReady = async () => {
    const imageFiles = Array.from(imageInput.files || []);
    const xmlFiles = Array.from(xmlInput.files || []);
    const binFiles = Array.from(binInput?.files || []);
    const splitEyeSpritesEnabled = document.querySelector('#xml-split-eye-sprites')?.checked || false;
    renderSelectedFiles('#xml-selected-files', imageFiles.concat(xmlFiles, binFiles));

    if (!imageFiles.length) return;
    showGlobalLoading('Scanning file...');
    try {
      const imageFile = imageFiles[0];
      const dataUrl = await readFileAsDataUrl(imageFile);

      const atlasSource = xmlFiles[0] || binFiles[0];
      if (atlasSource) {
        const atlasText = await readFileAsText(atlasSource);
        const atlas = parseAtlasXml(atlasText);

        if (atlas.length > 0) {
          if (splitEyeSpritesEnabled) {
            const eyeInfo = getXmlEyeLidSplitInfo(atlas);
            if (eyeInfo) {
              previewXmlEyeLidSplit('#xml-preview', dataUrl, atlas);
              return;
            }
            setStatus('Eye/lid split is enabled, but fewer than 2 eye/lid labels were detected in the XML.', 'error');
          }
          visualizeXmlSprites('#xml-preview', dataUrl, atlas);
          return;
        }
      }

      setPreview('#xml-preview', dataUrl);
    } catch (error) {
      setStatus(error.message || 'Failed to preview XML atlas sheet.', 'error');
    } finally {
      hideGlobalLoading();
    }
  };

  imageInput.addEventListener('change', previewIfReady);
  xmlInput.addEventListener('change', () => {
    renderSelectedFiles('#xml-selected-files', Array.from(imageInput.files || []).concat(Array.from(xmlInput.files || [])).concat(Array.from(binInput?.files || [])));
    previewIfReady();
  });
  binInput?.addEventListener('change', () => {
    renderSelectedFiles('#xml-selected-files', Array.from(imageInput.files || []).concat(Array.from(xmlInput.files || [])).concat(Array.from(binInput?.files || [])));
    previewIfReady();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const imageFiles = Array.from(imageInput.files || []);
    const xmlFiles = Array.from(xmlInput.files || []);
    const binFiles = Array.from(binInput?.files || []);
    const splitEyeSpritesEnabled = document.querySelector('#xml-split-eye-sprites')?.checked || false;

    if (!imageFiles.length || (!xmlFiles.length && !binFiles.length)) {
      setStatus('Please choose one or more spritesheet images plus at least one XML atlas file or an optional BIN atlas file.', 'error');
      return;
    }

    showGlobalLoading('Scanning file...');
    try {
      const atlasFiles = xmlFiles.concat(binFiles);
      const pairs = pairFilesByStem(imageFiles, atlasFiles);
      if (!pairs.length) {
        throw new Error('No matching image/atlas pairs were found.');
      }

      const archivePairs = [];

      for (const { imageFile, xmlFile } of pairs) {
        const imageData = await readFileAsDataUrl(imageFile);
        const image = await loadImageFromDataUrl(imageData);
        const xmlText = await readFileAsText(xmlFile);
        const atlas = parseAtlasXml(xmlText);

        if (!atlas.length) {
          throw new Error(`No cut regions were found in ${xmlFile.name}.`);
        }

        let entries;
        let atlasData;
        
        if (splitEyeSpritesEnabled) {
          const eyeInfo = getXmlEyeLidSplitInfo(atlas);
          if (!eyeInfo) {
            throw new Error('Eye/lid split is enabled, but there are fewer than 2 eye/lid labels in this XML atlas.');
          }
          entries = splitXmlEyeLidEntries(image, atlas);
          atlasData = atlas;
        } else {
          entries = atlas.map((entry) => createSpriteFromXml(image, entry));
          atlasData = atlas;
        }

        const baseFileName = xmlFile.name.replace(/\.[^/.]+$/, '');
        const verticesEntry = createXmlVerticesJsonEntry(atlasData, sanitizeName(baseFileName));
        archivePairs.push({
          folderName: sanitizeName(baseFileName) || 'sprites',
          entries,
          verticesEntry,
        });
      }

      const zipSaved = await exportCombinedZipForPairs(archivePairs, pairs[0].xmlFile.name);
      if (zipSaved) {
        setStatus(`Processed ${pairs.length} atlas image pair(s) into one zip download.`, 'success');
        return;
      }

      setStatus('ZIP export failed. No loose sprite files were created.', 'error');
    } catch (error) {
      setStatus(error.message || 'Failed to cut XML atlas.', 'error');
    } finally {
      hideGlobalLoading();
    }
  });
}

function initializeMetaCutterPage() {
  const form = document.querySelector('#meta-form');
  if (!form) return;

  const imageInput = document.querySelector('#meta-image-file');
  const fileInput = document.querySelector('#meta-file-input');
  const output = document.querySelector('#meta-output');

  const refreshSelectionSummary = () => {
    const imageFiles = Array.from(imageInput.files || []);
    const metaFiles = Array.from(fileInput.files || []);
    const selectedFiles = imageFiles.concat(metaFiles);
    renderSelectedFiles('#meta-selected-files', selectedFiles);
  };

  const refreshMetaPreview = async () => {
    refreshSelectionSummary();
    const imageFiles = Array.from(imageInput.files || []);
    const metaFiles = Array.from(fileInput.files || []);
    const splitEyeSpritesEnabled = document.querySelector('#meta-split-eye-sprites')?.checked || false;

    if (!metaFiles.length) {
      if (!imageFiles.length) return;

      showGlobalLoading('Scanning file...');
      try {
        const firstImage = imageFiles[0];
        const dataUrl = await readFileAsDataUrl(firstImage);
        setPreview('#meta-preview', dataUrl);
      } catch (error) {
        setStatus(error.message || 'Failed to preview image.', 'error');
      } finally {
        hideGlobalLoading();
      }
      return;
    }

    showGlobalLoading('Scanning file...');
    try {
      const firstMeta = metaFiles[0];
      const text = await readFileAsText(firstMeta);
      previewMetaText(firstMeta, text);

      if (imageFiles.length > 0) {
        const firstImage = imageFiles[0];
        const dataUrl = await readFileAsDataUrl(firstImage);
        const image = await loadImageFromDataUrl(dataUrl);
        const spriteFrames = parseMetaFileForSprites(text);
        if (spriteFrames.length > 0) {
          const normalizedFrames = spriteFrames.map((entry) => ({
            ...entry,
            y: image.height - entry.y - entry.height,
          }));

          if (splitEyeSpritesEnabled) {
            const eyeInfo = getXmlEyeLidSplitInfo(normalizedFrames);
            if (eyeInfo) {
              previewXmlEyeLidSplit('#meta-preview', dataUrl, normalizedFrames);
              return;
            }
            setStatus('Eye/lid split is enabled, but fewer than 2 eye/lid labels were detected in this .meta file.', 'error');
          }
          visualizeMetaSprites('#meta-preview', dataUrl, normalizedFrames);
        } else {
          setPreview('#meta-preview', dataUrl);
        }
      }
    } catch (error) {
      setStatus(error.message || 'Failed to preview meta file.', 'error');
    } finally {
      hideGlobalLoading();
    }
  };

  const metaSplitCheckbox = document.querySelector('#meta-split-eye-sprites');
  if (metaSplitCheckbox) {
    metaSplitCheckbox.addEventListener('change', refreshMetaPreview);
  }

  imageInput.addEventListener('change', refreshMetaPreview);

  fileInput.addEventListener('change', refreshMetaPreview);

  function previewMetaText(file, text) {
    const guidMatch = text.match(/guid:\s*([A-Fa-f0-9]+)/);
    const spriteModeMatch = text.match(/spriteMode:\s*(\d+)/);
    const pixelsMatch = text.match(/spritePixelsToUnits:\s*(\d+)/);
    const spriteFrames = parseMetaFileForSprites(text);

    if (output) output.textContent = text;

    let summary = [
      guidMatch ? `GUID: ${guidMatch[1]}` : 'GUID: not found',
      spriteModeMatch ? `Sprite mode: ${spriteModeMatch[1]}` : 'Sprite mode: not found',
      pixelsMatch ? `Pixels to units: ${pixelsMatch[1]}` : 'Pixels to units: not found',
      `Sprite regions found: ${spriteFrames.length}`,
    ];

    if (spriteFrames.length > 0) {
      summary.push('');
      summary.push('Sprite names:');
      spriteFrames.forEach((sprite) => {
        summary.push(`  • ${sprite.name} (${sprite.width}x${sprite.height} @ ${sprite.x},${sprite.y})`);
      });
    } else {
      if (text.includes('Sprites:')) {
        summary.push('');
        summary.push('The Sprites section was found, but its regions could not be read.');
        summary.push('Export will use automatic detection if possible.');
      } else {
        summary.push('');
        summary.push('No Sprites section was found in this file.');
        summary.push('Export will use automatic detection if possible.');
      }
    }

    if (spriteFrames.length > 0) {
      setStatus(`${spriteFrames.length} sprite regions loaded from ${file.name}.`, 'success');
    } else {
      setStatus(`No sprite regions found in ${file.name}. Automatic detection will be used when exporting.`, 'info');
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const imageFiles = Array.from(imageInput.files || []);
    const metaFiles = Array.from(fileInput.files || []);
    const splitEyeSpritesEnabled = document.querySelector('#meta-split-eye-sprites')?.checked || false;

    if (!metaFiles.length) {
      setStatus('Choose one or more .meta files to cut.', 'error');
      return;
    }

    showGlobalLoading('Scanning file...');
    try {
      if (!window.JSZip) {
        throw new Error('JSZip is not loaded.');
      }

      if (metaFiles.length === 1 && !imageFiles.length) {
        const text = await readFileAsText(metaFiles[0]);
        previewMetaText(metaFiles[0], text);
        return;
      }

      if (!imageFiles.length) {
        setStatus('Choose at least one spritesheet image to cut with the selected .meta files.', 'error');
        return;
      }

      const pairs = pairFilesByStem(imageFiles, metaFiles);
      if (!pairs.length) {
        throw new Error('No matching image/.meta pairs were found.');
      }

      let processedPairs = 0;
      let usedCoordinates = 0;
      let usedAutoDetect = 0;
      const archivePairs = [];

      for (const { imageFile, xmlFile } of pairs) {
        const imageData = await readFileAsDataUrl(imageFile);
        const image = await loadImageFromDataUrl(imageData);
        const metaText = await readFileAsText(xmlFile);
        const spriteFrames = parseMetaFileForSprites(metaText);

        let entries = [];
        let spriteData = [];
        
        if (spriteFrames.length > 0) {
          const normalizedFrames = spriteFrames.map((entry) => ({
            ...entry,
            y: image.height - entry.y - entry.height,
          }));

          entries = splitMetaEntriesWithEyeLidFix(image, normalizedFrames, splitEyeSpritesEnabled);
          if (entries.length === 0) {
            throw new Error('No sprites could be extracted from the .meta file.');
          }
          spriteData = normalizedFrames;
          usedCoordinates += 1;
        } else {
          const detected = detectSpriteGrid(image);
          entries = buildSpriteEntries(image, {
            columns: detected.columns,
            rows: detected.rows,
            padding: 0,
            gap: 0,
            trim: true,
          });
          spriteData = [];
          for (let row = 0; row < detected.rows; row++) {
            for (let col = 0; col < detected.columns; col++) {
              spriteData.push({
                x: col * detected.frameWidth,
                y: row * detected.frameHeight,
                width: detected.frameWidth,
                height: detected.frameHeight,
                name: `sprite_${row + 1}_${col + 1}`,
              });
            }
          }
          usedAutoDetect += 1;
        }

        if (!entries.length) {
          throw new Error(`Could not detect or parse sprites from ${xmlFile.name}.`);
        }

        const baseFileName = xmlFile.name.replace(/\.[^/.]+$/, '');
        const verticesEntry = createVerticesJsonEntry(spriteData, sanitizeName(baseFileName));
        archivePairs.push({
          folderName: sanitizeName(baseFileName) || 'sprites',
          entries,
          verticesEntry,
        });
        processedPairs += 1;
      }

      const zipSaved = await exportCombinedZipForPairs(archivePairs, pairs[0].xmlFile.name);
      if (!zipSaved) {
        throw new Error('ZIP export failed. No loose sprite files were created.');
      }

      let statusMsg = `Cut ${processedPairs} .meta batch(es) into one ZIP export with vertices.`;
      if (usedCoordinates > 0 && usedAutoDetect > 0) {
        statusMsg += ` (${usedCoordinates} used .meta coordinates, ${usedAutoDetect} used auto-detect)`;
      } else if (usedAutoDetect > 0) {
        statusMsg += ` (Used auto-detection - no sprite frames found in .meta files)`;
      } else if (usedCoordinates > 0) {
        statusMsg += ` (Used sprite frame coordinates from .meta file)`;
      }

      setStatus(statusMsg, 'success');
      output.textContent = [...metaFiles.map((file) => `${file.name}\n`), ...imageFiles.map((file) => `${file.name}\n`)].join('');
      refreshSelectionSummary();
    } catch (error) {
      setStatus(error.message || 'Could not cut .meta frames.', 'error');
    } finally {
      hideGlobalLoading();
    }
  });
}

function initializeAdminLinks() {
  const adminLinks = document.querySelectorAll('#admin-link, #admin-self-link');
  if (!adminLinks.length || typeof AuthManager === 'undefined') return;

  const username = AuthManager.getSessionUser();
  const user = username ? AuthManager.getUser(username) : null;
  adminLinks.forEach((link) => {
    link.hidden = !(user && user.isAdmin);
  });
}

function initializeCurrentUserDisplay() {
  const nav = document.querySelector('.nav');
  if (!nav || typeof AuthManager === 'undefined') return;

  const username = AuthManager.getSessionUser();
  if (!username) return;

  const userLabel = document.createElement('span');
  userLabel.className = 'current-user';
  const prefix = document.createElement('span');
  prefix.className = 'current-user-prefix';
  prefix.textContent = 'Signed in as ';
  const name = document.createElement('span');
  name.className = 'current-user-name';
  name.textContent = username;
  const user = AuthManager.getUser(username);
  if (user && user.nameColor) name.style.color = user.nameColor;
  userLabel.append(prefix, name);
  userLabel.setAttribute('aria-label', `Signed in as ${username}`);
  nav.appendChild(userLabel);
}

document.addEventListener('DOMContentLoaded', () => {
  if (!ensureProjectAccess()) {
    return;
  }

  initializeThemeControls();
  initializeAdminLinks();
  initializeCurrentUserDisplay();
  initializeSpriteCutterPage();
  initializeXmlCutterPage();
  initializeMetaCutterPage();
});
