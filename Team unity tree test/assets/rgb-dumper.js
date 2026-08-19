(() => {
  class BinReader {
    constructor(buffer) { this.data = new DataView(buffer); this.offset = 0; this.decoder = new TextDecoder('ascii'); }
    ensure(size) { if (this.offset + size > this.data.byteLength) throw new Error('The file ended unexpectedly.'); }
    align(size) { this.offset += (size - (this.offset % size)) % size; this.ensure(0); }
    read(size, method) { this.align(size); this.ensure(size); const value = this.data[method](this.offset, true); this.offset += size; return value; }
    uint8() { return this.read(1, 'getUint8'); }
    uint16() { return this.read(2, 'getUint16'); }
    uint32() { return this.read(4, 'getUint32'); }
    int16() { return this.read(2, 'getInt16'); }
    int32() { return this.read(4, 'getInt32'); }
    float() { return this.read(4, 'getFloat32'); }
    string() {
      const length = this.uint32() - 1;
      this.ensure(length);
      const value = this.decoder.decode(new Uint8Array(this.data.buffer, this.offset, length));
      this.offset += length;
      this.offset += length % 4 === 0 ? 4 : 4 - length % 4;
      this.ensure(0);
      return value;
    }
    dataValue() { return { immediate: this.uint8(), value: this.float() }; }
    dataXY() { return { immediate: this.uint8(), x: this.float(), y: this.float() }; }
    dataString() { return { immediate: this.uint8(), string: this.string() }; }
    dataRGB() { return { immediate: this.uint8(), red: this.uint8(), green: this.uint8(), blue: this.uint8() }; }
    frame() { return { time: this.float(), pos: this.dataXY(), scale: this.dataXY(), rotation: this.dataValue(), opacity: this.dataValue(), sprite: this.dataString(), rgb: this.dataRGB() }; }
    layer() {
      const layer = { name: this.string(), type: this.int32(), blend: this.uint32(), parent: this.int16(), id: this.int16(), src: this.int16(), width: this.uint16(), height: this.uint16(), anchorX: this.float(), anchorY: this.float(), unknown: this.string(), frames: [] };
      const count = this.uint32();
      if (count > 100000) throw new Error('The file contains too many frames.');
      for (let index = 0; index < count; index += 1) layer.frames.push(this.frame());
      return layer;
    }
    animation() {
      const animation = { name: this.string(), width: this.uint16(), height: this.uint16(), loopOffset: this.float(), centered: this.uint32(), layers: [] };
      const count = this.uint32();
      if (count > 10000) throw new Error('The file contains too many layers.');
      for (let index = 0; index < count; index += 1) animation.layers.push(this.layer());
      return animation;
    }
    parse() {
      const sourceCount = this.uint32();
      if (sourceCount > 10000) throw new Error('The file contains too many sources.');
      for (let index = 0; index < sourceCount; index += 1) this.string(), this.uint16(), this.uint16(), this.uint16();
      const animationCount = this.uint32();
      if (animationCount > 10000) throw new Error('The file contains too many animations.');
      const animations = [];
      for (let index = 0; index < animationCount; index += 1) animations.push(this.animation());
      return animations;
    }
  }

  const fileInput = document.getElementById('rgb-file-input');
  if (!fileInput) return;
  const dropZone = document.getElementById('rgb-drop-zone');
  const status = document.getElementById('rgb-status');
  const results = document.getElementById('rgb-results');
  const grid = document.getElementById('rgb-grid');
  const tableBody = document.getElementById('rgb-table-body');
  const animationFilter = document.getElementById('rgb-animation-filter');
  const search = document.getElementById('rgb-search');
  const state = { rows: [], log: '' };

  const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character]));
  const hex = (red, green, blue) => `#${[red, green, blue].map(value => value.toString(16).padStart(2, '0')).join('').toUpperCase()}`;

  async function copyHex(value, sprite) {
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(value);
      else {
        const helper = document.createElement('textarea');
        helper.value = value;
        helper.style.position = 'fixed';
        helper.style.opacity = '0';
        document.body.appendChild(helper);
        helper.select();
        document.execCommand('copy');
        helper.remove();
      }
      status.textContent = `${value} copied for ${sprite}.`;
    } catch (error) {
      status.textContent = `Could not copy ${value}.`;
    }
  }

  function render() {
    const selectedAnimation = animationFilter.value.toLowerCase();
    const query = search.value.trim().toLowerCase();
    const rows = state.rows.filter(row => (!selectedAnimation || row.animation.toLowerCase() === selectedAnimation) && (!query || `${row.sprite} ${row.layer}`.toLowerCase().includes(query)));
    grid.replaceChildren();
    tableBody.replaceChildren();
    if (!rows.length) {
      tableBody.innerHTML = '<tr><td colspan="6">No matching RGB values.</td></tr>';
      return;
    }
    rows.forEach(row => {
      const color = `rgb(${row.red}, ${row.green}, ${row.blue})`;
      const value = hex(row.red, row.green, row.blue);
      const tile = document.createElement('div');
      tile.className = `rgb-tile${(row.red * 299 + row.green * 587 + row.blue * 114) / 1000 > 165 ? ' light-label' : ''}`;
      tile.style.backgroundColor = color;
      tile.tabIndex = 0;
      tile.setAttribute('role', 'button');
      tile.title = `Copy ${value}`;
      tile.innerHTML = `${escapeHtml(row.sprite)}<small>${value}</small>`;
      tile.addEventListener('click', () => copyHex(value, row.sprite));
      tile.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); copyHex(value, row.sprite); }
      });
      grid.appendChild(tile);
      const tableRow = document.createElement('tr');
      tableRow.innerHTML = `<td>${escapeHtml(row.animation)}</td><td>${escapeHtml(row.layer)}</td><td><span class="rgb-swatch" style="background:${color}"></span>${escapeHtml(row.sprite)}</td><td>${row.red}</td><td>${row.green}</td><td>${row.blue}</td>`;
      tableBody.appendChild(tableRow);
    });
  }

  function loadFile(file) {
    if (!file) return;
    status.textContent = `Reading ${file.name}...`;
    file.arrayBuffer().then(buffer => {
      const animations = new BinReader(buffer).parse();
      state.rows = [];
      animations.forEach(animation => animation.layers.forEach(layer => layer.frames.forEach(frame => {
        const { red, green, blue } = frame.rgb;
        if ((red === 0 && green === 0 && blue === 0) || (red === 255 && green === 255 && blue === 255)) return;
        state.rows.push({ animation: animation.name, layer: layer.name, sprite: frame.sprite.string, red, green, blue });
      })));
      state.log = state.rows.map(row => `${row.sprite}: R=${row.red}, G=${row.green}, B=${row.blue}`).join('\n');
      animationFilter.replaceChildren(new Option('All animations', ''));
      animations.forEach(animation => animationFilter.appendChild(new Option(animation.name, animation.name)));
      if (animations.length) animationFilter.value = animations[0].name;
      results.hidden = false;
      status.textContent = state.rows.length ? `${file.name} loaded successfully.` : `${file.name} has no non-default RGB values.`;
      render();
    }).catch(error => { results.hidden = true; status.textContent = `Could not read this file: ${error.message}`; });
  }

  fileInput.addEventListener('change', event => loadFile(event.target.files[0]));
  ['dragenter', 'dragover'].forEach(name => dropZone.addEventListener(name, event => { event.preventDefault(); dropZone.classList.add('dragging'); }));
  ['dragleave', 'drop'].forEach(name => dropZone.addEventListener(name, event => { event.preventDefault(); dropZone.classList.remove('dragging'); }));
  dropZone.addEventListener('drop', event => loadFile(event.dataTransfer.files[0]));
  animationFilter.addEventListener('change', render);
  search.addEventListener('input', render);
  document.getElementById('rgb-download').addEventListener('click', () => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([state.log], { type: 'text/plain;charset=utf-8' }));
    link.download = 'rgb_log.txt';
    link.click();
    URL.revokeObjectURL(link.href);
  });
})();
